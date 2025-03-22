import MessageResponse from "../Types/MessageResponse";
import ChessAnalysis from "../Types/ChessAnalysis";
import axios, { AxiosError } from "axios";

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
      analyzePosition(request.fen, request.playerColor, request.moveHistory)
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

const CHESS_ANALYSIS_PROMPT = `You are an elite chess grandmaster focused on finding the optimal moves against famous chess players. Your task is to analyze chess positions with grandmaster-level precision and provide:
1. The single best move in standard chess notation (e.g., "e5-e6" or "Nf3")
2. Concise reasoning explaining why this move is optimal

Your analysis must be formatted to match this interface:
{
  "evaluation": number,  // Position evaluation in centipawns (positive favors you, negative favors opponent)
  "bestMove": string,   // The single best move in the position (e.g., "e5-e6" or "Nf3")
  "depth": number,      // Depth of calculation (5 minimum)
  "moveReasoning": string // Brief explanation of why this is the best move
}

When analyzing positions:
- Calculate at least 5 moves deep
- Identify tactical opportunities and positional advantages
- Consider Magnus Carlsen's known tendencies in similar positions
- Focus on practical winning chances rather than theoretical evaluations

When provided with game history:
- Identify the opponent's last move from the position changes
- Consider how the opponent is playing (aggressive, defensive, positional)
- Adapt your recommendations to counter the opponent's strategy
- Reference specific moves in the history when relevant to your analysis

When the game is starting (initial position), provide the user with strong opening options such as:
- Queen's Gambit
- Ruy Lopez
- English Opening
- Sicilian Defense
- King's Indian Defense
- French Defense
- Caro-Kann

Include the first move of each opening and a brief strength/characteristic of that opening against a famous grandmaster style.

You will receive positions in FEN notation, possibly with previous positions for context. Respond ONLY with the structured analysis that matches the interface - no introduction or additional commentary.
Your response must be ONLY a valid JSON object with the exact structure shown, with no additional text, markdown formatting, or explanation before or after. The entire response must be parsable as JSON.`;

const analyzePosition = async (
  fen: string,
  playerColor: "white" | "black",
  moveHistory: string[] = []
): Promise<ChessAnalysis> => {
  // Create a more structured context from the game history
  let historyContext = "";

  if (moveHistory.length > 1) {
    // Extract the last few positions for context (not too many to avoid token limits)
    const relevantHistory = moveHistory.slice(-Math.min(5, moveHistory.length));

    // Create a more meaningful representation of position changes
    historyContext = "Game history:\n";

    for (let i = 0; i < relevantHistory.length; i++) {
      // Add move number and FEN
      historyContext += `Move ${
        moveHistory.length - relevantHistory.length + i + 1
      }: ${relevantHistory[i]}\n`;

      // If not the last move, try to describe what changed between positions
      if (i < relevantHistory.length - 1) {
        historyContext += "→ ";
      }
    }
  }

  // Build user message with current game state
  const userMessage = `
  Analyze this specific chess position: ${fen}
  I am playing as ${playerColor}.
  Current player to move: ${fen.split(" ")[1] === "w" ? "White" : "Black"}
  
  ${historyContext}
  
  Return ONLY a JSON object with evaluation, bestMove, depth, and moveReasoning fields.
  `;

  try {
    console.log("Sending analysis request with context:", userMessage);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

    const response = await axios.post(
      "https://api.studio.nebius.ai/v1/chat/completions",
      {
        model: "meta-llama/Meta-Llama-3.1-70B-Instruct-fast",
        max_tokens: 500,
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

    // Safely parse JSON with error handling
    let responseData;
    try {
      const content = response.data.choices[0].message.content.trim();
      // Attempt to fix common JSON issues like trailing commas
      const sanitizedContent = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      responseData = JSON.parse(sanitizedContent);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      console.log("Raw response:", response.data.choices[0].message.content);

      // Fallback response if parsing fails
      return {
        evaluation: 0,
        bestMove: "Unable to parse response",
        moveReasoning:
          "The analysis engine returned an invalid response. Please try again.",
        depth: 0,
      };
    }

    console.log("Analysis response", responseData);

    // Validate the response has all required fields
    const analysis: ChessAnalysis = {
      evaluation: responseData.evaluation || 0,
      bestMove: responseData.bestMove || "Unknown",
      moveReasoning: responseData.moveReasoning || "No reasoning provided",
      depth: responseData.depth || 0,
    };

    return analysis;
  } catch (error: unknown) {
    console.error("Error analyzing position:", error);
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      console.error("Error response data:", axiosError.response.data);
      console.error("Error response status:", axiosError.response.status);
    } else if (axiosError.request) {
      console.error("No response received:", axiosError.request);
    } else {
      console.error("Error setting up request:", axiosError.message);
    }

    throw new Error(`Failed to analyze position: ${axiosError.message}`);
  }
};
