import MessageResponse from "../Types/MessageResponse";
import ChessAnalysis from "../Types/ChessAnalysis";
import axios, { AxiosError } from "axios";

let isActive: boolean = false;

interface ChessMove {
  player: "white" | "black";
  number: number;
  notation: string;
}

interface AlternativeMove {
  move: string;
  reasoning?: string;
  evaluation?: number;
}

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

// Basic move validator function
const validateMove = (fen: string, moveNotation: string): boolean => {
  try {
    // Parse FEN to get the board state
    const boardPart = fen.split(" ")[0];
    const ranks = boardPart.split("/");

    // Convert to a 2D array for easier processing
    const board: string[][] = [];
    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
      const rank = ranks[rankIndex];
      const row: string[] = [];

      for (const char of rank) {
        if (/^\d$/.test(char)) {
          // Empty squares
          const emptyCount = parseInt(char);
          for (let i = 0; i < emptyCount; i++) {
            row.push("");
          }
        } else {
          // Piece
          row.push(char);
        }
      }

      board.push(row);
    }

    // Handle the specific case of bishop moves, which are often problematic
    if (moveNotation.startsWith("B") && !moveNotation.includes("x")) {
      // Extract destination square
      const destSquare = moveNotation.substring(1);
      const destFile = destSquare.charCodeAt(0) - 97; // 'a' -> 0
      const destRank = 8 - parseInt(destSquare[1]); // '1' -> 7

      // Is white's turn?
      const isWhiteTurn = fen.includes(" w ");
      const bishopChar = isWhiteTurn ? "B" : "b";

      // Find all bishops of the current player
      const bishops: [number, number][] = [];
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          if (board[r][f] === bishopChar) {
            bishops.push([r, f]);
          }
        }
      }

      // Check if any bishop can reach the destination
      let canReach = false;
      for (const [bishopRank, bishopFile] of bishops) {
        // Bishops move diagonally, so the difference in rank and file must be equal
        if (
          Math.abs(bishopRank - destRank) === Math.abs(bishopFile - destFile)
        ) {
          // Check if the path is clear
          const rankStep = bishopRank < destRank ? 1 : -1;
          const fileStep = bishopFile < destFile ? 1 : -1;

          let pathClear = true;
          let r = bishopRank + rankStep;
          let f = bishopFile + fileStep;

          while (r !== destRank && f !== destFile) {
            if (r < 0 || r >= 8 || f < 0 || f >= 8) {
              pathClear = false;
              break;
            }

            if (board[r][f] !== "") {
              pathClear = false;
              break;
            }

            r += rankStep;
            f += fileStep;
          }

          // Final check of destination square
          if (pathClear && board[destRank][destFile] === "") {
            canReach = true;
            break;
          }
        }
      }

      if (!canReach) {
        console.warn(`No bishop can reach ${destSquare} in this position`);
        return false;
      }
      return true;
    }

    // For other move types, assume valid for now
    return true;
  } catch (error) {
    console.error("Error validating move:", error);
    return true; // Default to allowing the move in case of validator error
  }
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

// Helper function to validate FEN string
const validateFen = (fen: string) => {
  // Basic FEN validation
  const parts = fen.split(" ");

  if (parts.length !== 6) {
    return { valid: false, error: "FEN must have 6 parts" };
  }

  // Validate board part
  const boardPart = parts[0];
  const ranks = boardPart.split("/");

  if (ranks.length !== 8) {
    return { valid: false, error: "Board must have 8 ranks" };
  }

  // Validate each rank
  for (const rank of ranks) {
    let sum = 0;
    for (const char of rank) {
      if (/^\d$/.test(char)) {
        sum += parseInt(char);
      } else if (/^[prnbqkPRNBQK]$/.test(char)) {
        sum += 1;
      } else {
        return { valid: false, error: `Invalid character in rank: ${char}` };
      }
    }

    if (sum !== 8) {
      return { valid: false, error: `Rank does not have 8 squares: ${rank}` };
    }
  }

  // Check for exactly one white king and one black king
  const whiteKingCount = (boardPart.match(/K/g) || []).length;
  const blackKingCount = (boardPart.match(/k/g) || []).length;

  if (whiteKingCount !== 1) {
    return {
      valid: false,
      error: `There must be exactly one white king, found ${whiteKingCount}`,
    };
  }

  if (blackKingCount !== 1) {
    return {
      valid: false,
      error: `There must be exactly one black king, found ${blackKingCount}`,
    };
  }

  // Validate turn
  if (parts[1] !== "w" && parts[1] !== "b") {
    return { valid: false, error: "Turn must be 'w' or 'b'" };
  }

  // Validate castling
  if (!/^(-|[KQkq]+)$/.test(parts[2])) {
    return { valid: false, error: "Invalid castling rights" };
  }

  // Validate en passant
  if (!/^(-|[a-h][36])$/.test(parts[3])) {
    return { valid: false, error: "Invalid en passant square" };
  }

  // Validate halfmove clock
  if (!/^\d+$/.test(parts[4])) {
    return { valid: false, error: "Halfmove clock must be a number" };
  }

  // Validate fullmove number
  if (!/^\d+$/.test(parts[5])) {
    return { valid: false, error: "Fullmove number must be a number" };
  }

  return { valid: true, error: null };
};

// Helper function to analyze pawn structure
const analyzePawnStructure = (ranks: string[]): string => {
  if (!ranks || ranks.length === 0) {
    return "Pawn structure: Unable to analyze";
  }

  try {
    // Count pawns by file for both colors
    const whitePawnFiles: string[] = [];
    const blackPawnFiles: string[] = [];

    for (let rank = 0; rank < 8; rank++) {
      if (!ranks[rank]) continue;

      for (const char of ranks[rank]) {
        if (/^\d$/.test(char)) {
          continue;
        } else {
          if (char === "P") {
            whitePawnFiles.push(String.fromCharCode(97 + rank)); // Convert to file letter (a-h)
          } else if (char === "p") {
            blackPawnFiles.push(String.fromCharCode(97 + rank));
          }
        }
      }
    }

    // Identify doubled pawns
    const whiteDoubledPawns = findDoubledPawns(whitePawnFiles);
    const blackDoubledPawns = findDoubledPawns(blackPawnFiles);

    // Identify isolated pawns (pawns with no friendly pawns on adjacent files)
    const whiteIsolatedPawns = findIsolatedPawns(whitePawnFiles);
    const blackIsolatedPawns = findIsolatedPawns(blackPawnFiles);

    let analysis = "Pawn structure analysis:";
    let hasFeatures = false;

    if (whiteDoubledPawns.length > 0) {
      analysis += `\n- White has doubled pawns on files: ${whiteDoubledPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (blackDoubledPawns.length > 0) {
      analysis += `\n- Black has doubled pawns on files: ${blackDoubledPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (whiteIsolatedPawns.length > 0) {
      analysis += `\n- White has isolated pawns on files: ${whiteIsolatedPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    if (blackIsolatedPawns.length > 0) {
      analysis += `\n- Black has isolated pawns on files: ${blackIsolatedPawns.join(
        ", "
      )}`;
      hasFeatures = true;
    }

    // If no special features found, provide basic pawn distribution
    if (!hasFeatures) {
      analysis +=
        "\n- Standard pawn structure with no doubled or isolated pawns";
      analysis += `\n- White pawns on files: ${
        [...new Set(whitePawnFiles)].sort().join(", ") || "none"
      }`;
      analysis += `\n- Black pawns on files: ${
        [...new Set(blackPawnFiles)].sort().join(", ") || "none"
      }`;
    }

    return analysis;
  } catch (error) {
    console.error("Error analyzing pawn structure:", error);
    return "Pawn structure: Error during analysis";
  }
};

// Helper function to find doubled pawns
const findDoubledPawns = (pawnFiles: string[]): string[] => {
  if (!pawnFiles || pawnFiles.length === 0) {
    return [];
  }

  try {
    const fileCounts: { [key: string]: number } = {};
    pawnFiles.forEach((file) => {
      fileCounts[file] = (fileCounts[file] || 0) + 1;
    });

    return Object.keys(fileCounts).filter((file) => fileCounts[file] > 1);
  } catch (error) {
    console.error("Error finding doubled pawns:", error);
    return [];
  }
};

// Helper function to find isolated pawns
const findIsolatedPawns = (pawnFiles: string[]): string[] => {
  if (!pawnFiles || pawnFiles.length === 0) {
    return [];
  }

  try {
    const uniqueFiles = [...new Set(pawnFiles)];
    return uniqueFiles.filter((file) => {
      const fileChar = file.charCodeAt(0);
      const prevFile = String.fromCharCode(fileChar - 1);
      const nextFile = String.fromCharCode(fileChar + 1);

      // Check if there are no pawns on adjacent files
      return (
        (fileChar <= 97 || !pawnFiles.includes(prevFile)) &&
        (fileChar >= 104 || !pawnFiles.includes(nextFile))
      );
    });
  } catch (error) {
    console.error("Error finding isolated pawns:", error);
    return [];
  }
};

// Function to create enhanced context for the analysis API
const createEnhancedContext = (
  fen: string,
  moveHistory: (string | ChessMove)[]
) => {
  // Use the complete move history
  const moves = moveHistory;

  // Create a structured representation of the game progression
  let context = "Game progression:\n";

  // Group moves by number for better readability
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];

    if (typeof move === "string") {
      context += `${i + 1}. ${move}\n`;
    } else if ("player" in move && move.player === "white") {
      context += `${move.number}. ${move.notation} `;
    } else if ("player" in move) {
      context += `${move.notation}\n`;
    }
  }

  // Add game phase estimation
  const pieces = fen.split(" ")[0];
  const pieceCount = pieces.replace(/[^A-Za-z]/g, "").length;

  let gamePhase = "opening";
  if (pieceCount <= 10) {
    gamePhase = "endgame";
  } else if (pieceCount <= 24) {
    gamePhase = "middlegame";
  }

  context += `\nEstimated game phase: ${gamePhase}`;

  // Add pawn structure analysis
  const ranks = fen.split(" ")[0].split("/");
  const pawnStructure = analyzePawnStructure(ranks);
  context += `\n${pawnStructure}`;

  return context;
};

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
