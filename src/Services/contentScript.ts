import ChessAnalysis from "../Types/ChessAnalysis";

// Initialize when content script loads
const initialize = () => {
    console.log("Chess Assistant for Lichess is initialized");
  
    // Global click handler to prevent sidebar from disappearing
    const documentClickHandler = (e: MouseEvent) => {
      // If the sidebar exists and is active, prevent default action
      if (sidebar && isActive) {
        // Only prevent if click was outside the sidebar
        if (sidebar && !sidebar.contains(e.target as Node)) {
          // Don't stop propagation completely, just prevent sidebar removal
          e.stopPropagation();
        }
      }
    };
  
    // Add click handler to document - using capture phase
    document.addEventListener("click", documentClickHandler, true);
  
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  
      if (request.type === "PING") {
        sendResponse({pong: true});
        return true;
      }
  
      if (request.type === "STATE_CHANGED") {
        if (request.isActive) {
          injectSidebar();
          startBoardObserver();
        } else {
          removeSidebar();
          stopBoardObserver();
        }
      }
      return true;
    });
  
    // Check if we're on Lichess
    if (window.location.hostname.includes("lichess.org")) {
      // Check if extension should be active
      chrome.storage.sync.get("isActive", (result) => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          return;
        }
  
        if (result.isActive) {
          injectSidebar();
          startBoardObserver();
        }
      });
    }
  };


const injectSidebar = () => {
    // TODO: Inject the sidebar
}

const removeSidebar = () => {
    // TODO: Remove the sidebar
}

const startBoardObserver = () => {
    // TODO: Start the board observer
}

const stopBoardObserver = () => {
    // TODO: Stop the board observer
}

const extractFen = () => {
    // TODO: Extract the FEN from the board
}

const analyzePosition = async () => {
    // TODO: Analyze the position
}

const updateSidebarWithAnalysis = (analysis: ChessAnalysis) => {
    // TODO: Update the sidebar
}


// Start initialization when document is ready
if (document.readyState === "complete") {
    initialize();
  } else {
    window.addEventListener("load", initialize);
  }
