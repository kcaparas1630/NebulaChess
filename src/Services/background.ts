import MessageResponse from "../Types/MessageResponse";
import ChessAnalysis from "../Types/ChessAnalysis";

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

const analyzePosition = async (fen: string) => {
    // TODO: Analyze the position
}
