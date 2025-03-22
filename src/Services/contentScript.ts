import ChessAnalysis from "../Types/ChessAnalysis";

let sidebar: HTMLElement | null = null;
let boardObserver: MutationObserver | null = null;
let currentFen: string | null = null;
const isActive: boolean = false;

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
      sendResponse({ pong: true });
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
  // Check if sidebar already exists
  if (sidebar) {
    console.log("Sidebar already exists, not injecting again");
    return;
  }

  console.log("Injecting chess assistant sidebar");

  // Create root element with a unique ID to avoid conflicts
  const container = document.createElement("div");
  const uniqueId = `chess-assistant-root-${Date.now()}`;
  container.id = "chess-assistant-root"; // Keep the original ID for compatibility
  container.setAttribute("data-instance-id", uniqueId); // Add a unique attribute

  // Create shadow DOM for isolation, doesn't conflict with Lichess styles
  const shadow = container.attachShadow({ mode: "open" });

  // create an inner container for react to render into
  const reactRoot = document.createElement("div");
  reactRoot.id = "react-root";

  // Append to shadow DOM
  shadow.appendChild(reactRoot);

  // Add some base styles
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    #react-root {
      width: 300px;
      height: 100vh;
      background-color: #2b2b2b;
      color: #ffffff;
      font-family: Arial, sans-serif;
      padding: 16px;
      box-sizing: border-box;
      overflow-y: auto;
      box-shadow: -2px 0 5px rgba(0,0,0,0.2);
    }
  `;
  shadow.appendChild(styleElement);

  // Position the sidebar on the right side of the page
  container.style.position = "fixed";
  container.style.right = "0";
  container.style.top = "0";
  container.style.height = "100vh";
  container.style.zIndex = "9999";

  // Prevent clicks from propagating to lichess elements
  container.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Append to the document body
  document.body.appendChild(container);

  // Store reference to the sidebar
  sidebar = container;

  // Import and load the React sidebar component
  // Add a timestamp to avoid caching issues
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(`sidebar.js?t=${Date.now()}`);
  script.type = "module";

  // Add error handling for script loading
  script.onerror = (error) => {
    console.error("Error loading sidebar script:", error);
  };

  script.onload = () => {
    console.log("Sidebar script loaded successfully");
    // Signal that the container is ready for React rendering
    // Add a small delay to ensure everything is properly loaded
    setTimeout(() => {
      window.postMessage(
        {
          type: "CHESS_ASSISTANT_CONTAINER_READY",
          instanceId: uniqueId,
        },
        "*"
      );
    }, 50);
  };

  document.body.appendChild(script);
};

const removeSidebar = () => {
  // TODO: Remove the sidebar
};

const startBoardObserver = () => {
  // if already observing
  if (boardObserver) return;

  extractFen();

  // Set up board observer for DOM changes
  boardObserver = new MutationObserver((mutations) => {
    // Only proceed if the changes are related to piece movements
    const hasPieceChanges = mutations.some((mutation) => {
      // Check if the mutation directly involves a piece element
      if (
        mutation.target instanceof HTMLElement &&
        mutation.target.tagName.toLowerCase() === "piece"
      ) {
        return true;
      }

      // Check if the mutation involves piece attributes (esp. style/transform)
      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLElement &&
        mutation.target.classList.contains("piece")
      ) {
        return true;
      }

      // Check if the mutation contains added/removed piece nodes
      if (mutation.type === "childList") {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.tagName.toLowerCase() === "piece" ||
              node.querySelector("piece"))
          ) {
            return true;
          }
        }

        // Check removed nodes
        for (const node of mutation.removedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.tagName.toLowerCase() === "piece" ||
              node.querySelector("piece"))
          ) {
            return true;
          }
        }
      }

      return false;
    });
    if (hasPieceChanges) {
      setTimeout(() => {
        const newFen = extractFen();
        if (newFen !== currentFen && newFen !== null) {
          currentFen = newFen;
          analyzeCurrentPosition(newFen);
        }
      }, 500);
    }
  });

  // Start observing the board
  boardObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
};

const stopBoardObserver = () => {
  // TODO: Stop the board observer
};

const extractFen = () => {
  // TODO: Extract the FEN from the board
};

const analyzePosition = async () => {
  // TODO: Analyze the position
};

const updateSidebarWithAnalysis = (analysis: ChessAnalysis) => {
  // TODO: Update the sidebar
};

// Start initialization when document is ready
if (document.readyState === "complete") {
  initialize();
} else {
  window.addEventListener("load", initialize);
}
