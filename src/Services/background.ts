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
chrome.runtime.onMessage.addListener((request, _sender, sendResponse: (response: MessageResponse) => void) => {
    if (request.type === "TOGGLE_ASSISTANT") {
        isActive = !isActive;
        
        // Store state in chrome.storage
        chrome.storage.sync.set({isActive: isActive}, () => {
            // Broadcast state change to all tabs
            chrome.tabs.query({url: "https://lichess.org/*"}, (tabs) => {
                if (tabs.length === 0) {
                    console.log("No Lichess tabs found");
                    sendResponse({success: true, isActive: isActive});
                    return;
                }
                
                let tabsProcessed = 0;
                
                tabs.forEach((tab) => {
                    if (tab.id) {
                        // Check if tab is ready before sending message
                        isTabReady(tab.id, (ready) => {
                            tabsProcessed++;
                            
                            if (ready) {
                                chrome.tabs.sendMessage(tab.id!, {type: "STATE_CHANGED", isActive: isActive}, (response) => {
                                    if (chrome.runtime.lastError) {
                                        console.log("Error sending message to tab:", chrome.runtime.lastError);
                                        console.log("Response:", response);
                                    }
                                });
                            } else {
                                console.log("Tab not ready:", tab.id);
                            }
                            
                            // If all tabs have been processed, send the response
                            if (tabsProcessed === tabs.length) {
                                sendResponse({success: true, isActive: isActive});
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
                sendResponse({success: true, isActive: isActive});
            }, 500);
        });
        return true;
    }

    if (request.type === "REQUEST_ANALYSIS") {
        console.log("Requesting analysis", request.fen);
        // Forward the request to Nebius AI API
        analyzePosition(request.fen)
        .then((analysis: ChessAnalysis) => {
            sendResponse({success: true, analysis: analysis});
        })
        .catch((error: Error) => {
            console.error("Error analyzing position:", error);
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
});


const isTabReady = (tabId: number, callback: (ready: boolean) => void) => {
    chrome.tabs.sendMessage(tabId, {type: "PING"}, (response) => {
        if (chrome.runtime.lastError) {
            console.log("Tab not ready:", chrome.runtime.lastError);
            callback(false);
            return;
        }
        callback(response && response.pong);
    });
}

const analyzePosition = async (fen: string): Promise<ChessAnalysis> => {
    try {
        const response = await axios.post('https://api.studio.nebius.ai/v1/chat/completions', {
            model: "meta-llama/Meta-Llama-3.1-70B-Instruct-fast",
            max_tokens: 1500,
            temperature: 0.6,
            top_p: 0.9,
            top_k: 50,
            messages: [
                {
                    role: "system",
                    content: `You are a smart, cunning chess grandmaster who is focused on achieving victory against Magnus Carlsen. You are tasked to analyze the chess game state with depth and precision, considering both immediate tactics and long-term strategy. Provide insightful next moves that exploit positional weaknesses, create dynamic imbalances, and maintain initiative. Include reasoning behind each suggestion, potential variations, and psychological factors that might affect your opponent. Your analysis should reflect grandmaster-level pattern recognition, calculation abilities, and strategic understanding so that the player you're assisting can win the game against the world champion.
                            When analyzing a move that the opponent made:

                           * Calculate at least 5 moves ahead to identify winning sequences
                           * Evaluate if the opponent's move creates tactical or positional weaknesses you can exploit
                           * Assess any hidden threats or strategic plans behind seemingly innocent moves
                           * Consider psychological patterns in Magnus's play style relevant to the position

                            When analyzing a move that the player made without asking your suggestion:

                            * Provide constructive feedback highlighting potential improvements or alternative approaches
                            * Evaluate the strengths and weaknesses of the chosen move
                            * Compliment thoughtful or particularly strong moves with specific praise explaining why the move was excellent
                            * Suggest follow-up plans that build upon their move to maintain or increase advantage`
                },
                {
                    role: "user",
                    content: `Analyze this chess position: ${fen}`
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_NEBIUS_API_KEY}`
            }
        });

        const data = response.data;
        console.log("Analysis response", data);
        const analysis: ChessAnalysis = {
            evaluation: data.choices[0].message.content,
            bestMove: data.choices[0].message.content,
            depth: 5
        }
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
}
