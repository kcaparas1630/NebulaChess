import ChessAnalysis from "../Types/ChessAnalysis";

let lastAnalysisTime = 0;
let analysisInProgress = false;
const MIN_ANALYSIS_INTERVAL = 2000; // Minimum 2 seconds between analyses
let analysisQueue: string | null = null;
let lastAnalyzedFenKey: string | null = null; // Track which positions we've analyzed
let sidebar: HTMLElement | null = null;
let boardObserver: MutationObserver | null = null;
let currentFen: string | null = null;
let isActive: boolean = false;
let playerColor: "white" | "black" | null = null;
let isPlayerTurn: boolean = false;
// eslint-disable-next-line prefer-const
let moveHistory: string[] = [];
let turnCount = 0;
let lastTurnPlayerColor: "white" | "black" | null = null;

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
      isActive = request.isActive;
      if (isActive) {
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
      isActive = result.isActive || false;
      if (isActive) {
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
      width: 20vw;
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
  if (sidebar && sidebar.parentNode) {
    sidebar.parentNode.removeChild(sidebar);
    sidebar = null;
  }
};

const startBoardObserver = () => {
  // if already observing
  if (boardObserver) return;

  // detect player color
  detectPlayerColor();

  const fen = extractFen();
  // analyze at the starting position.
  if (fen) {
    analyzeCurrentPosition(fen);
  }

  // Track last piece change time to prevent double-counting
  let lastPieceChangeTime = 0;
  const MIN_MOVE_INTERVAL = 300; // Minimum time between move detections (ms)
  // Set up board observer for DOM changes
  boardObserver = new MutationObserver((mutations) => {
    // Check for orientation changes (might indicate player color changed)
    const orientationChanged = mutations.some(
      (mutation) =>
        mutation.target instanceof HTMLElement &&
        mutation.target.classList.contains("orientation-changed")
    );

    if (orientationChanged) {
      detectPlayerColor();
    }

    // Check for last-move indicators (primary method)
    const hasLastMoveIndicator = mutations.some((mutation) => {
      if (mutation.type === "childList") {
        // Look for added nodes that have the "last-move" class
        return Array.from(mutation.addedNodes).some(
          (node) =>
            node instanceof HTMLElement &&
            (node.classList?.contains("last-move") ||
              node.querySelector?.(".last-move"))
        );
      }

      // Also check for attribute changes adding the "last-move" class
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class" &&
        mutation.target instanceof HTMLElement
      ) {
        return mutation.target.classList.contains("last-move");
      }

      return false;
    });

    // Fallback: Check for piece movements (backup method)
    const hasPieceChanges =
      !hasLastMoveIndicator &&
      mutations.some((mutation) => {
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

    // Process a move if either detection method triggers
    if (hasLastMoveIndicator || hasPieceChanges) {
      // Track last piece change time to prevent double-counting
      const now = Date.now();

      // Prevent multiple triggers for the same move
      if (now - lastPieceChangeTime < MIN_MOVE_INTERVAL) {
        return;
      }

      lastPieceChangeTime = now;
      // Use debug logging to help identify which detection method triggered
      console.log(
        `Move detected: lastMove=${hasLastMoveIndicator}, pieceChanges=${hasPieceChanges}`
      );

      // Add a slight delay to ensure the board has settled
      setTimeout(() => {
        const newFen = extractFen();
        if (newFen !== currentFen && newFen !== null) {
          currentFen = newFen;

          // Update turn tracking based on piece movements
          turnCount++;
          lastTurnPlayerColor = turnCount % 2 === 1 ? "white" : "black";
          isPlayerTurn =
            playerColor === (turnCount % 2 === 0 ? "white" : "black");

          updateMoveHistory(newFen);

          console.log(
            `Turn ${turnCount}: ${lastTurnPlayerColor}'s move just completed, isPlayerTurn: ${isPlayerTurn}`
          );

          // Only analyze positions when it's the player's turn to move
          // This way we analyze after the computer has made its move
          const isPlayerToMove =
            (playerColor === "white" && newFen.includes(" w ")) ||
            (playerColor === "black" && newFen.includes(" b "));

          if (isPlayerToMove) {
            console.log(
              "It's your turn - analyzing position for your move options"
            );
            analyzeCurrentPosition(newFen);
          } else if (turnCount <= 2) {
            // Also analyze the first couple of moves regardless of turn
            // This helps with opening suggestions
            analyzeCurrentPosition(newFen);
          }
        }
      }, 300);
    }
  });

  // Start observing the board with all necessary triggers
  boardObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"], // Focus on the attributes we care about
  });
};

const stopBoardObserver = () => {
  if (boardObserver) {
    boardObserver.disconnect();
    boardObserver = null;
  }
};

const extractFen = () => {
  const board: HTMLElement | null = document.querySelector("cg-board");
  if (!board) return null;

  // Get board dimensions dynamically
  const boardRect = board.getBoundingClientRect();
  const squareSize = boardRect.width / 8;

  // Initialize empty 8x8 board
  const boardArray: string[][] = Array(8)
    .fill("")
    .map(() => Array(8).fill(""));

  // Get all pieces
  const pieces = board.querySelectorAll("piece");

  // Process each piece
  pieces.forEach((piece) => {
    const transform = (piece as HTMLElement).style.transform;
    const matches = transform.match(/translate\((\d+)px(?:,\s*(\d+)px)?\)/);

    if (matches) {
      // Extract x, y coordinates
      const x = parseInt(matches[1]) / squareSize;
      const y = parseInt(String(matches[2] || 0)) / squareSize;

      // Get piece type and color
      const classes = piece.classList;
      let pieceChar = "";

      if (classes.contains("pawn")) pieceChar = "p";
      else if (classes.contains("knight")) pieceChar = "n";
      else if (classes.contains("bishop")) pieceChar = "b";
      else if (classes.contains("rook")) pieceChar = "r";
      else if (classes.contains("queen")) pieceChar = "q";
      else if (classes.contains("king")) pieceChar = "k";

      // Uppercase for white pieces
      if (classes.contains("white")) pieceChar = pieceChar.toUpperCase();

      // Place on board (y axis is flipped in chess notation)
      if (x >= 0 && x < 8 && y >= 0 && y < 8) {
        boardArray[Math.floor(y)][Math.floor(x)] = pieceChar;
      }
    }
  });

  // Convert board array to FEN
  let fen = "";
  for (let i = 0; i < 8; i++) {
    let emptyCount = 0;
    for (let j = 0; j < 8; j++) {
      if (boardArray[i][j] === "") {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += boardArray[i][j];
      }
    }
    if (emptyCount > 0) {
      fen += emptyCount;
    }
    if (i < 7) fen += "/";
  }

  let turn = "w";
  const messageDiv = document.querySelector(".message");
  if (messageDiv) {
    const messageText = messageDiv.textContent || "";
    if (messageText.includes("your turn")) {
      // It's the player's turn
      isPlayerTurn = true;
      turn = playerColor === "white" ? "w" : "b";
    } else {
      // It's the opponent's turn
      isPlayerTurn = false;
      turn = playerColor === "white" ? "b" : "w";
    }
  } else {
    // No message div found, use board observer data to determine turn
    if (lastTurnPlayerColor === playerColor) {
      // if the last move was made by the player, it's now the opponent's turn
      turn = playerColor === "white" ? "b" : "w";
      isPlayerTurn = false;
    } else {
      // if the last move was made by the opponent, it's now the player's turn
      turn = playerColor === "white" ? "w" : "b";
      isPlayerTurn = true;
    }
  }

  let castlingRights = "";

  // White kingside castling
  if (boardArray[7][4] === "K" && boardArray[7][7] === "R") {
    castlingRights += "K";
  }
  // White queenside castling
  if (boardArray[7][4] === "K" && boardArray[7][0] === "R") {
    castlingRights += "Q";
  }
  // Black kingside castling
  if (boardArray[0][4] === "k" && boardArray[0][7] === "r") {
    castlingRights += "k";
  }
  // Black queenside castling
  if (boardArray[0][4] === "k" && boardArray[0][0] === "r") {
    castlingRights += "q";
  }

  // If no castling rights, use "-"
  if (castlingRights === "") {
    castlingRights = "-";
  }

  // Count empty squares to estimate how many pieces have been captured
  let emptySquares = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (boardArray[i][j] === "") {
        emptySquares++;
      }
    }
  }

  // Roughly estimate the move number based on empty squares
  // Starting position has 32 empty squares (64 - 32 pieces)
  const emptySquaresInStart = 32;
  const capturedPieces = emptySquares - emptySquaresInStart;
  const estimatedMoveNumber = Math.max(1, Math.floor(capturedPieces / 2) + 1);

  // we'll use "-" for now
  const enPassant = "-";

  // Complete FEN with improved components
  fen += ` ${turn} ${castlingRights} ${enPassant} 0 ${estimatedMoveNumber}`;

  console.log("Extracted FEN:", fen);

  return fen;
};

const analyzeCurrentPosition = async (fen: string) => {
  // Extract just the board position part for tracking analyzed positions
  const fenBoardAndTurn = fen.split(" ").slice(0, 2).join(" ");

  // Skip if we've already analyzed this exact board position with the same turn
  if (fenBoardAndTurn === lastAnalyzedFenKey) {
    console.log("Already analyzed this position, skipping");
    return;
  }

  const now = Date.now();

  // If we're already analyzing or it's too soon since last analysis
  if (analysisInProgress) {
    // For computer games, we need to prioritize the latest position
    // Cancel any previous analysis request if possible
    analysisQueue = fen;
    console.log(
      "Analysis already in progress, will analyze latest position when done"
    );
    return;
  }

  // If it's too soon since the last analysis, but this is a player's turn after computer moved
  const computerJustMoved =
    (playerColor === "white" && fen.includes(" w ")) ||
    (playerColor === "black" && fen.includes(" b "));

  if (now - lastAnalysisTime < MIN_ANALYSIS_INTERVAL) {
    if (computerJustMoved) {
      // This is an important position to analyze - it's your turn after computer moved
      console.log("Computer just moved, prioritizing analysis");
      // Let it proceed despite the interval
    } else {
      // Just queue the request and set a timer
      analysisQueue = fen;
      console.log(
        `Too soon for analysis, waiting ${
          MIN_ANALYSIS_INTERVAL - (now - lastAnalysisTime)
        }ms`
      );
      return;
    }
  }

  // Mark that we're analyzing this position
  lastAnalyzedFenKey = fenBoardAndTurn;

  // We can perform analysis now
  analysisInProgress = true;
  lastAnalysisTime = now;

  // Only send analysis request if we know the player's color
  if (!playerColor) {
    detectPlayerColor(); // Make sure we have the color
  }

  console.log(
    `Analyzing position for ${playerColor} player, it's ${
      fen.includes(" w ") ? "white" : "black"
    }'s turn`
  );

  chrome.runtime.sendMessage(
    {
      type: "REQUEST_ANALYSIS",
      fen: fen,
      playerColor: playerColor || "white",
      moveHistory: moveHistory.slice(-6), // Only send the most recent positions
    },
    (response) => {
      // Mark that we're done with the analysis
      analysisInProgress = false;

      if (chrome.runtime.lastError) {
        console.error("Message error:", chrome.runtime.lastError);
        return;
      }
      console.log("Response success", response && response.success);
      if (response && response.success) {
        updateSidebarWithAnalysis(response.analysis);
      } else {
        console.error(
          "Analysis request failed",
          response?.error || "Unknown error"
        );
        // Show an error in the sidebar
        updateSidebarWithAnalysis({
          evaluation: 0,
          bestMove: "Analysis unavailable",
          moveReasoning: "Could not analyze the position. Try again later.",
          depth: 0,
        });
      }

      // Check if there's a queued analysis request
      if (analysisQueue) {
        const queuedFen = analysisQueue;
        analysisQueue = null;

        // Wait a bit before processing the queued request
        setTimeout(() => {
          analyzeCurrentPosition(queuedFen);
        }, 500);
      }
    }
  );
};

const updateSidebarWithAnalysis = (analysis: ChessAnalysis) => {
  // Send the analysis to React application in the sidebar
  console.log("Updating sidebar with analysis", analysis);
  window.postMessage(
    {
      type: "CHESS_ANALYSIS_RESULT",
      bestMove: analysis.bestMove,
      moveReasoning: analysis.moveReasoning,
    },
    "*"
  );
};

const detectPlayerColor = () => {
  // Check for "your turn" message to determine player color
  const messageDiv = document.querySelector(".message");
  if (messageDiv) {
    const messageText = messageDiv.textContent || "";
    if (messageText.includes("your turn")) {
      playerColor = "white";
    } else {
      playerColor = "black";
    }
    console.log(`Detected player color: ${playerColor} based on message text`);

    // Set initial turn state if this is first detection
    if (!lastTurnPlayerColor) {
      lastTurnPlayerColor = "white"; // Chess always starts with white
      isPlayerTurn = playerColor === "white";
    }
    return;
  }

  // In a new game, white always starts
  if (!playerColor) {
    // check board if starting position
    const board = document.querySelector("cg-board");
    if (board) {
      const pieces = board.querySelectorAll("piece");
      // If we have 32 pieces, it's starting position
      if (pieces.length === 32) {
        playerColor = "white"; // Default to white for new games
        isPlayerTurn = true;
      }
    }
  }

  console.log(`Player color detection result: ${playerColor}`);
};

// When you detect a move
const updateMoveHistory = (fen: string) => {
  moveHistory.push(fen);
  if (moveHistory.length > 50) moveHistory.shift();
};

// Start initialization when document is ready
if (document.readyState === "complete") {
  initialize();
} else {
  window.addEventListener("load", initialize);
}
