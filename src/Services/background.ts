import MessageResponse from "../Types/MessageResponse";
import ChessAnalysis from "../Types/ChessAnalysis";
import axios, { AxiosError } from "axios";
import ChessMove from "../Types/ChessMove";
import AlternativeMove from "../Types/AlternativeMoves";
import validateFen from "../Utils/ValidateFen";
import analyzePawnStructure from "../Utils/AnalyzePawnStructure";
import validateMove from "../Utils/ValidateMove";
import createEnhancedContext from "../Utils/CreateContext";

let isActive: boolean = false;


// Listen for Chrome Extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log("Chess Assistant for Lichess is installed");

  // Initialize default settings
  chrome.storage.sync.set({
    analysisDepth: 5,
    preferedStrategy: "balanced",
    autoAnalyze: true,
  });
});

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse: (response: MessageResponse) => void) => {
    if (request.type === "TOGGLE_ASSISTANT") {
      isActive = !isActive;

      // Store state in chrome.storage
      chrome.storage.sync.set({ isActive: isActive }, () => {
        // Broadcast state change to all tabs
        chrome.tabs.query({ url: "https://lichess.org/*" }, (tabs) => {
          if (tabs.length === 0) {
            console.log("No Lichess tabs found");
            sendResponse({ success: true, isActive: isActive });
            return;
          }

          let tabsProcessed = 0;

          tabs.forEach((tab) => {
            if (tab.id) {
              // Check if tab is ready before sending message
              isTabReady(tab.id, (ready) => {
                tabsProcessed++;

                if (ready) {
                  chrome.tabs.sendMessage(
                    tab.id!,
                    { type: "STATE_CHANGED", isActive: isActive },
                    (response) => {
                      if (chrome.runtime.lastError) {
                        console.log(
                          "Error sending message to tab:",
                          chrome.runtime.lastError
                        );
                        console.log("Response:", response);
                      }
                    }
                  );
                } else {
                  console.log("Tab not ready:", tab.id);
                }

                // If all tabs have been processed, send the response
                if (tabsProcessed === tabs.length) {
                  sendResponse({ success: true, isActive: isActive });
                }
              });
            } else {
              tabsProcessed++;
            }
          });
        });

        // In case the tabs query doesn't return in time, still send a response
        // This is a fallback and may cause duplicate responses, which the caller should handle
        setTimeout(() => {
          sendResponse({ success: true, isActive: isActive });
        }, 500);
      });
      return true;
    }

    if (request.type === "REQUEST_ANALYSIS") {
      console.log("Requesting analysis", request.fen);
      // Forward the request to Nebius AI API
      analyzePosition(
        request.fen,
        request.playerToMove,
        request.playerColor,
        request.moveHistory
      )
        .then((analysis: ChessAnalysis) => {
          sendResponse({ success: true, analysis: analysis });
        })
        .catch((error: Error) => {
          console.error("Error analyzing position:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  }
);

const isTabReady = (tabId: number, callback: (ready: boolean) => void) => {
  chrome.tabs.sendMessage(tabId, { type: "PING" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Tab not ready:", chrome.runtime.lastError);
      callback(false);
      return;
    }
    callback(response && response.pong);
  });
};

const CHESS_ANALYSIS_PROMPT = `You are an elite chess analyzer focused on finding optimal moves in chess positions. When presented with a chess position (in FEN notation), analyze it with precision and provide:

1. The single best move in standard algebraic notation
2. Alternative moves that are nearly as good (if any exist)
3. A brief position evaluation in centipawns

Your response must be formatted as:

{
  "evaluation": number,  // Position evaluation in centipawns (positive favors white)
  "bestMove": string,    // The single best move in standard algebraic notation
  "depth": number,       // Calculation depth (minimum 5)
  "alternatives": [      // Alternative strong moves, if any
    {
      "move": string,    // Alternative move in standard algebraic notation
      "evaluation": number  // Evaluation of this alternative
    }
  ]
}


When analyzing positions:
- Calculate at least 5 moves deep
- Prioritize tactical opportunities and material safety
- Consider positional factors after ensuring material is secure
- Verify all moves are legal in the given position

For opening positions, recommend strong opening options with their first moves.

Respond ONLY with the JSON object as specified above.`;

const analyzePosition = async (
  fen: string,
  playerToMove: "white" | "black",
  playerColor: "white" | "black",
  moveHistory: (string | ChessMove)[] = []
): Promise<ChessAnalysis> => {
  try {
    // Create a more structured context from the game history
    let historyContext = "";

    if (moveHistory.length > 0) {
      // Use the full move history instead of just recent moves
      // This ensures the AI has complete context of the game
      historyContext = createEnhancedContext(fen, moveHistory);
    } else {
      // If we don't have structured move history, create a basic context
      // Try to extract game phase information from the FEN
      const pieces = fen.split(" ")[0];
      const pieceCount = pieces.replace(/[^A-Za-z]/g, "").length;

      let gamePhase = "opening";
      if (pieceCount <= 10) {
        gamePhase = "endgame";
      } else if (pieceCount <= 24) {
        gamePhase = "middlegame";
      }

      historyContext = `Estimated game phase: ${gamePhase}`;

      // Add pawn structure analysis
      const ranks = fen.split(" ")[0].split("/");
      const pawnStructure = analyzePawnStructure(ranks);
      historyContext += `\n${pawnStructure}`;
    }

    console.log("History context:", historyContext);

    // Validate FEN string
    const isValidFen = validateFen(fen);
    if (!isValidFen.valid) {
      console.error("Invalid FEN string:", isValidFen.error);
      return {
        evaluation: 0,
        bestMove: "Invalid position",
        depth: 0,
        alternativeMoves: [],
      };
    }

    // Build user message with current game state
    const userMessage = `
    Analyze this specific chess position: ${fen}
    I am playing as ${playerColor}
    Current player to move: ${playerToMove}
    
    ${historyContext}
    
    Return ONLY a JSON object with these fields:
    - evaluation: A numerical evaluation of the position (positive favors white, negative favors black)
    - bestMove: The best move in algebraic notation (e.g., "e4" or "Nf3")
    - depth: The depth of analysis
    - alternativeMoves: An array of 1-2 alternative good moves, each with a "move" and "reasoning" property
    
    Format your response as clean, parseable JSON without markdown code blocks.
    `;

    console.log("Sending analysis request with context:", userMessage);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    const response = await axios.post(
      "https://api.studio.nebius.ai/v1/chat/completions",
      {
        model: "deepseek-ai/DeepSeek-V3",
        max_tokens: 5000,
        temperature: 0.6,
        top_p: 0.9,
        top_k: 50,
        messages: [
          {
            role: "system",
            content: CHESS_ANALYSIS_PROMPT,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_NEBIUS_API_KEY}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    try {
      const content = response.data.choices[0].message.content.trim();
      console.log("Raw AI response:", content);

      // More robust JSON extraction - handles both raw JSON and JSON in code blocks
      let sanitizedContent = content;

      // Remove markdown code blocks if present
      if (content.includes("```")) {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          sanitizedContent = jsonMatch[1].trim();
        }
      }

      // Try to extract JSON if the response isn't already valid JSON
      if (!sanitizedContent.startsWith("{")) {
        const jsonMatch = sanitizedContent.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          sanitizedContent = jsonMatch[1].trim();
        }
      }

      let responseData;
      try {
        responseData = JSON.parse(sanitizedContent);
        console.log("Parsed analysis response:", responseData);
      } catch (jsonError) {
        console.error(
          "JSON parsing error, trying fallback extraction:",
          jsonError
        );
        // Fallback: Use regex to extract key fields
        const extractField = (field: string) => {
          const regex = new RegExp(`"${field}"\\s*:\\s*"?([^",}]*)"?`, "i");
          const match = content.match(regex);
          return match ? match[1].trim() : null;
        };

        responseData = {
          evaluation: parseFloat(extractField("evaluation") || "0"),
          bestMove: extractField("bestMove") || "Unknown",
          alternativeMoves: extractField("alternativeMoves") || [],
          depth: parseInt(extractField("depth") || "0", 10),
        };
      }

      // Validate the move is physically possible
      const isValidMove = validateMove(fen, responseData.bestMove);
      if (!isValidMove) {
        console.warn(
          `AI suggested invalid move: ${responseData.bestMove} - replacing with fallback move`
        );
        responseData.bestMove = "Nc3";
      }

      // Validate alternative moves if present
      if (
        responseData.alternativeMoves &&
        Array.isArray(responseData.alternativeMoves)
      ) {
        responseData.alternativeMoves = responseData.alternativeMoves
          .filter(
            (move: AlternativeMove) =>
              move && typeof move === "object" && move.move
          )
          .map((move: AlternativeMove) => {
            // Validate each alternative move
            if (!validateMove(fen, move.move)) {
              console.warn(
                `Invalid alternative move: ${move.move} - removing from list`
              );
              return null;
            }
            return {
              move: move.move,
              evaluation: move.evaluation || null,
            };
          })
          .filter(Boolean); // Remove null entries
      } else {
        // If no alternative moves were provided, create an empty array
        responseData.alternativeMoves = [];
      }

      // Build the final analysis object
      const analysis: ChessAnalysis = {
        evaluation: responseData.evaluation || 0,
        bestMove: responseData.bestMove || "Unknown",
        depth: responseData.depth || 0,
        alternativeMoves: responseData.alternativeMoves || [],
      };

      return analysis;
    } catch (parseError) {
      console.error("Error processing response:", parseError);
      return {
        evaluation: 0,
        bestMove: "Unable to parse response",
        depth: 0,
        alternativeMoves: [],
      };
    }
  } catch (error: unknown) {
    console.error("Error analyzing position:", error);
    const axiosError = error as AxiosError;
    throw new Error(`Failed to analyze position: ${axiosError.message}`);
  }
};
