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
      analyzePosition(request.fen)
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

const CHESS_ANALYSIS_PROMPT = `You are an elite chess grandmaster focused on finding the optimal moves against Magnus Carlsen. Your task is to analyze chess positions with grandmaster-level precision and provide:
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

When the game is starting (initial position), provide the user with strong opening options such as:
- Queen's Gambit
- Ruy Lopez
- English Opening
- Sicilian Defense
- King's Indian Defense
- French Defense
- Caro-Kann

Include the first move of each opening and a brief strength/characteristic of that opening against Magnus Carlsen's style.

You will receive positions in FEN notation. Respond ONLY with the structured analysis that matches the interface - no introduction or additional commentary.`;

const analyzePosition = async (fen: string): Promise<ChessAnalysis> => {
  try {
    const response = await axios.post(
      "https://api.studio.nebius.ai/v1/chat/completions",
      {
        model: "meta-llama/Meta-Llama-3.1-70B-Instruct-fast",
        max_tokens: 1500,
        temperature: 0.6,
        top_p: 0.9,
        top_k: 50,
        messages: [
          {
            role: "system",
            content: CHESS_ANALYSIS_PROMPT
          },
          {
            role: "user",
            content: `Analyze this chess position: ${fen}`,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_NEBIUS_API_KEY}`,
        },
      }
    );

    const responseData = JSON.parse(response.data.choices[0].message.content);
    console.log("Analysis response", responseData);
    const analysis: ChessAnalysis = {
      evaluation: responseData.evaluation,
      bestMove: responseData.bestMove,
      moveReasoning: responseData.moveReasoning,
      depth: responseData.depth,
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
