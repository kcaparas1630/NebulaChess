// can't use import here since it's not a module. let's not complicate things.

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
// eslint-disable-next-line prefer-const
let moveHistory: string[] = [];
let previousMoveElementsCount: number = 0;
let turnCount: number = 0;
// eslint-disable-next-line prefer-const
let playerColor: "white" | "black" | null = null;
let lastCompleteFen: string | null = null;
let consecutiveMatchCount: number = 0;
const REQUIRED_MATCHES = 2; // Number of consecutive identical FEN readings required

const SIDEBAR_STYLES = `
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
    /* Base Card styles */
    .card {
      background: #333333;
      border-radius: 10px;
      padding: 16px;
      margin: 16px 0;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
    }

    .card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
      pointer-events: none;
    }

    /* Best Move Card styles (extends base card) */
    .best-move-card {
      border-left: 4px solid #4CAF50;
      background: linear-gradient(to right, #2a3a2a, #333333);
    }

    .best-move-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 30px;
      height: 30px;
      background: radial-gradient(circle at top right, rgba(76, 175, 80, 0.2), transparent 70%);
    }
    .alternative-move-card {
      border-left: 4px solid #2196F3;
      background: linear-gradient(to right, #2a2a3a, #333333);
      padding: 12px 16px;
    }
    .alternative-move-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 25px;
      height: 25px;
      background: radial-gradient(circle at top right, rgba(33, 150, 243, 0.15), transparent 70%);
    }
    .card-title {
      margin: 0 0 12px 0;
      font-size: 1.1rem;
      color: #ffffff;
      font-weight: 600;
      display: flex;
      align-items: center;
    }
    .card-title::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      background-color: #4CAF50;
      border-radius: 50%;
      margin-right: 8px;
    }
    .move-text {
      font-size: 1.3rem;
      font-weight: bold;
      color: #4CAF50;
      display: flex;
      align-items: center;
      letter-spacing: 0.5px;
    }
    .move-text.alternative {
      font-size: 1.1rem;
      color: #2196F3;
    }
    .eval-badge {
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.9rem;
      margin-left: 10px;
      font-weight: normal;
    }
    .eval-badge.positive {
      background-color: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
    }
    .eval-badge.negative {
      background-color: rgba(244, 67, 54, 0.2);
      color: #F44336;
    }
    .sidebar-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      background-color: #252525;
      background-image: 
        linear-gradient(to bottom, rgba(30, 30, 30, 0.8) 0%, rgba(30, 30, 30, 0) 100%),
        repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 10px);
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .sidebar-title {
      font-size: 1.25rem;
      color: #ffffff;
      margin: 0;
      font-weight: 600;
    }
    .chess-piece {
      margin-right: 8px;
      font-size: 1.4em;
      line-height: 1;
    }
  `;

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

  // Add some base styles
  const styleElement = document.createElement("style");
  styleElement.textContent = SIDEBAR_STYLES;
  shadow.appendChild(styleElement);

  // Append to shadow DOM
  shadow.appendChild(reactRoot);

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
  // Replace the single detection call with ensurePlayerColor
  ensurePlayerColor();

  const fen = extractFen();
  // Only analyze if we have both FEN and player color
  if (fen && playerColor) {
    analyzeCurrentPosition(fen);
  }

  // Track last piece change time to prevent double-counting
  let lastPieceChangeTime = 0;
  const MIN_MOVE_INTERVAL = 300; // Minimum time between move detections (ms)
  // Set up board observer for DOM changes
  boardObserver = new MutationObserver(() => {
    // Get all kwdb elements (move notation elements)
    const moveElements = document.querySelectorAll("kwdb");
    const currentMoveElementsCount = moveElements.length;

    // Check if board state has changed
    let boardChanged = false;

    if (currentMoveElementsCount === 0) {
      // Initial state of the board - need to check for piece movements
      // We'll use the FEN directly to check for changes
      const newFen = extractFen();
      if (newFen && newFen !== currentFen && currentFen !== null) {
        boardChanged = true;
        console.log("Board changed (initial position)");
      }
    } else if (currentMoveElementsCount !== previousMoveElementsCount) {
      // If the number of move elements has changed, a move was definitely made
      boardChanged = true;
      console.log(
        `Move elements changed: ${previousMoveElementsCount} -> ${currentMoveElementsCount}`
      );
    }

    // Update the counter for next time
    previousMoveElementsCount = currentMoveElementsCount;

    // Process the move if board changed
    if (boardChanged) {
      processPotentialMove();
    }
  });
  const processPotentialMove = () => {
    const now = Date.now();
    if (now - lastPieceChangeTime < MIN_MOVE_INTERVAL) return;
    lastPieceChangeTime = now;

    // First wait a bit for initial animations to settle
    setTimeout(() => {
      // Then use a polling approach to ensure the board is completely stable
      pollBoardUntilStable();
    }, 300);
  };

  // Start observing with optimized configuration
  boardObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
};

const stopBoardObserver = () => {
  if (boardObserver) {
    boardObserver.disconnect();
    boardObserver = null;
  }
};

// New polling function to wait until the board is stable
const pollBoardUntilStable = () => {
  // Reset consecutive match counter when starting a new poll cycle
  consecutiveMatchCount = 0;

  const pollInterval = 100; // Check every 100ms
  const maxPolls = 10; // Maximum number of polls (1 second total)
  let pollCount = 0;

  const pollFn = () => {
    pollCount++;
    const currentFenSnapshot = extractFen();

    // Debug logging
    console.log(
      `Poll ${pollCount}: extracted FEN: ${currentFenSnapshot?.substring(
        0,
        20
      )}...`
    );

    if (!currentFenSnapshot) {
      if (pollCount < maxPolls) {
        setTimeout(pollFn, pollInterval);
      } else {
        console.error("Failed to extract valid FEN after maximum polls");
      }
      return;
    }

    if (currentFenSnapshot === lastCompleteFen) {
      consecutiveMatchCount++;
      console.log(
        `FEN matched previous reading (${consecutiveMatchCount}/${REQUIRED_MATCHES})`
      );

      if (consecutiveMatchCount >= REQUIRED_MATCHES) {
        // We have a stable board! Process it
        processFinalFen(currentFenSnapshot);
        return;
      }
    } else {
      // Different FEN - reset counter and save new value
      console.log("FEN changed, resetting stability counter");
      consecutiveMatchCount = 1;
      lastCompleteFen = currentFenSnapshot;
    }

    // Continue polling if we haven't reached stability and haven't hit max polls
    if (pollCount < maxPolls) {
      setTimeout(pollFn, pollInterval);
    } else {
      // We've hit max polls, use the last FEN we got
      console.warn("Reached maximum polls without stability, using last FEN");
      if (lastCompleteFen) {
        processFinalFen(lastCompleteFen);
      }
    }
  };

  // Start polling
  pollFn();
};

// Process the final, stable FEN
const processFinalFen = (newFen: string) => {
  if (!newFen || newFen === currentFen) return;

  // Validate the FEN thoroughly
  if (!validateFen(newFen)) {
    console.error("Invalid FEN detected:", newFen);
    return;
  }

  currentFen = newFen;
  const isWhiteTurn = newFen.includes(" w ");
  turnCount++;

  // Add debug logging
  console.log("Processing stable FEN:", newFen);
  updateMoveHistory(newFen);
  console.log("Current move history length:", moveHistory.length);

  const isPlayerToMove = playerColor === (isWhiteTurn ? "white" : "black");

  console.log(
    `Turn ${turnCount}: ${isWhiteTurn ? "White" : "Black"} to move. ${
      isPlayerToMove ? "Your turn!" : "Opponent's turn."
    }`
  );

  if (isPlayerToMove || turnCount <= 2) {
    analyzeCurrentPosition(newFen);
  }
};

const validateFen = (fen: string): boolean => {
  if (!fen) return false;

  // Basic validation: Check if we have a valid FEN structure
  const fenParts = fen.split(" ");
  if (fenParts.length !== 6) {
    console.error("Invalid FEN format: wrong number of sections");
    return false;
  }

  // Count pieces in the FEN
  const boardPart = fenParts[0];
  let pieceCount = 0;
  let kingCount = 0;

  for (const char of boardPart) {
    if (/[pnbrqkPNBRQK]/.test(char)) {
      pieceCount++;

      // Check for kings
      if (char === "k") kingCount++;
      if (char === "K") kingCount++;
    }
  }

  // Both sides must have exactly one king
  if (kingCount !== 2) {
    console.error(`Invalid FEN: incorrect number of kings (${kingCount})`);
    return false;
  }

  // In a standard chess game, there should be between 2 (just kings) and 32 pieces
  if (pieceCount < 2 || pieceCount > 32) {
    console.error(`Suspicious piece count in FEN: ${pieceCount} pieces`);
    return false;
  }

  // Check each rank for correct length
  const ranks = boardPart.split("/");
  if (ranks.length !== 8) {
    console.error(`Invalid FEN: incorrect number of ranks (${ranks.length})`);
    return false;
  }

  // Validate each rank
  for (const rank of ranks) {
    let squares = 0;
    for (const char of rank) {
      if (/[1-8]/.test(char)) {
        squares += parseInt(char);
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        squares += 1;
      } else {
        console.error(`Invalid character in FEN: ${char}`);
        return false;
      }
    }

    if (squares !== 8) {
      console.error(`Invalid FEN: rank has ${squares} squares instead of 8`);
      return false;
    }
  }

  return true;
};

const extractFen = () => {
  const board = document.querySelector("cg-board");
  if (!board) {
    console.error("Board element not found");
    return null;
  }

  // Initialize an 8x8 array to represent the board (empty)
  const boardArray = Array(8)
    .fill(null)
    .map(() => Array(8).fill(""));

  // Get all pieces
  const pieces = board.querySelectorAll("piece");
  console.log(`Found ${pieces.length} pieces on the board`);

  // If we have too few pieces, board might not be fully rendered
  if (pieces.length < 20) {
    // Most openings have at least 20 pieces
    console.warn(
      "Suspiciously few pieces found, board might not be fully rendered"
    );
    // Return null to indicate we should try again later
    return null;
  }

  try {
    // Square size calculation (more robust)
    let squareSize = 0;
    const boardRect = board.getBoundingClientRect();
    squareSize = boardRect.width / 8; // Chess board is 8x8

    if (squareSize <= 0) {
      console.error("Invalid square size calculated");
      return null;
    }

    console.log(`Calculated square size: ${squareSize}px`);

    // Process each piece
    pieces.forEach((piece) => {
      // Extract piece type and color
      const className = piece.className;
      const isWhite = className.includes("white");

      // Extract piece type with proper typing
      type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
      let pieceType: PieceType | null = null;

      // Determine piece type from class name
      if (className.includes("pawn")) pieceType = "pawn";
      else if (className.includes("knight")) pieceType = "knight";
      else if (className.includes("bishop")) pieceType = "bishop";
      else if (className.includes("rook")) pieceType = "rook";
      else if (className.includes("queen")) pieceType = "queen";
      else if (className.includes("king")) pieceType = "king";

      if (!pieceType) {
        console.warn(`Could not determine piece type from class: ${className}`);
        return; // Skip this piece
      }

      // Map piece type to FEN character
      const pieceMap = {
        pawn: "p",
        knight: "n",
        bishop: "b",
        rook: "r",
        queen: "q",
        king: "k",
      };

      const pieceChar = pieceMap[pieceType];

      // Convert to FEN notation (uppercase for white, lowercase for black)
      const fenChar = isWhite ? pieceChar.toUpperCase() : pieceChar;

      // Extract position from transform
      const transform = (piece as HTMLElement).style.transform;
      const match = transform.match(/translate\(([^,]+)px, ?([^)]+)px\)/);

      if (!match) {
        console.warn(`Could not extract position from transform: ${transform}`);
        return; // Skip this piece
      }

      const xPixel = parseFloat(match[1]);
      const yPixel = parseFloat(match[2]);

      // Calculate chess coordinates
      const file = Math.floor(xPixel / squareSize);
      const rank = Math.floor(yPixel / squareSize);

      // Validate coordinates are within board boundaries
      if (file < 0 || file > 7 || rank < 0 || rank > 7) {
        console.warn(`Piece coordinates out of bounds: (${file}, ${rank})`);
        return; // Skip this piece
      }

      const rankIndex = rank;
      const fileIndex = file;

      // For debugging
      console.log(
        `Piece ${fenChar} at pixels (${xPixel}, ${yPixel}) maps to chess (${String.fromCharCode(
          97 + file
        )}${8 - rank}) and array [${rankIndex}][${fileIndex}]`
      );

      // Place the piece on the board
      boardArray[rankIndex][fileIndex] = fenChar;
    });

    // Debug: Print the board array
    console.log("Internal board representation:");
    for (let i = 0; i < 8; i++) {
      console.log(boardArray[i].join(" "));
    }

    // Convert the board array to FEN notation
    let fen = "";
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        if (boardArray[rank][file] === "") {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += boardArray[rank][file];
        }
      }
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      if (rank < 7) {
        fen += "/";
      }
    }

    // Determine turn, castling rights, etc. (same as before)
    let turn = "w";
    const moveElements = document.querySelectorAll("kwdb");
    if (moveElements.length === 0) {
      // Initial position, white to move
      turn = "w";
    } else {
      // After moves have been made
      if (moveElements.length % 2 === 0) {
        turn = "w"; // White to move after even number of moves
      } else {
        turn = "b"; // Black to move after odd number of moves
      }
    }

    // Determine castling rights
    let castlingRights = "";

    // Check for kings and rooks in their starting positions
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

    // En passant target square (simplified to "-" for now)
    const enPassant = "-";

    // Halfmove clock (for 50-move rule)
    const halfmoveClock = "0";

    // Fullmove number
    const fullmoveNumber = "1";

    // Complete FEN string
    fen += ` ${turn} ${castlingRights} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`;

    console.log("Reconstructed FEN:", fen);
    return fen;
  } catch (error) {
    console.error("Error extracting FEN:", error);
    return null;
  }
};

const analyzeCurrentPosition = async (fen: string) => {
  if (!playerColor) {
    console.log("Waiting for player color detection...");
    await new Promise((resolve) => {
      const checkColor = () => {
        if (playerColor) {
          resolve(true);
        } else {
          setTimeout(checkColor, 100);
        }
      };
      checkColor();
    });
  }

  // Now we're sure we have playerColor
  console.log(
    `Analyzing position for ${playerColor} player, it's ${
      fen.includes(" w ") ? "white" : "black"
    }'s turn`
  );

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
  const board: HTMLElement | null = document.querySelector("cg-board");
  if (!board) return;
  const pieces = board.querySelectorAll("piece");
  let playerToMove: "white" | "black" | null = null;
  if (pieces.length === 32) {
    playerToMove = "white";
  } else {
    const turnFromFen = fen.split(" ")[1];
    playerToMove = turnFromFen === "w" ? "white" : "black";
  }

  console.log("Player to move:", playerToMove);

  chrome.runtime.sendMessage(
    {
      type: "REQUEST_ANALYSIS",
      fen: fen,
      playerToMove: playerToMove,
      playerColor: playerColor,
      moveHistory: moveHistory,
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
          depth: 0,
          alternativeMoves: [],
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
      analysis: analysis,
      evaluation: analysis.evaluation,
      depth: analysis.depth,
      alternativeMoves: analysis.alternativeMoves,
      bestMove: analysis.bestMove,
    },
    "*"
  );
};

const detectPlayerColor = () => {
  const board = document.querySelector("cg-board");
  if (board) {
    // Find a white pawn (should be on the 7th rank if we're white, 2nd rank if we're black)
    const whitePawns = board.querySelectorAll("piece.white.pawn");

    if (whitePawns.length > 0) {
      // Check the transform of the first white pawn
      const pawn = whitePawns[0] as HTMLElement;
      const transform = pawn.style.transform;
      const yMatch = transform.match(/translate\([^,]+,\s*(\d+)px\)/);

      if (yMatch) {
        const yPosition = parseInt(yMatch[1]);
        // If y position is large (bottom of board), we're white
        // If y position is small (top of board), we're black
        playerColor = yPosition > 300 ? "white" : "black";
        console.log(
          `Detected player color from pawn position: ${playerColor}, y: ${yPosition}`
        );
        return playerColor;
      }
    }
  }
  return null;
};

// Add this function to retry color detection
const ensurePlayerColor = () => {
  if (!playerColor) {
    const detectedColor = detectPlayerColor();
    if (!detectedColor) {
      // If we still don't have a color, retry after a short delay
      console.log("Retrying player color detection...");
      setTimeout(ensurePlayerColor, 500);
    } else {
      playerColor = detectedColor;
      console.log("Successfully detected player color:", playerColor);
    }
  }
};

// Update the updateMoveHistory function to be more explicit
const updateMoveHistory = (fen: string) => {
  if (!fen) return;

  console.log("Previous move history:", moveHistory);
  moveHistory.push(fen);
  if (moveHistory.length > 50) moveHistory.shift(); // Keep last 50 moves
  console.log("Updated move history:", moveHistory);
};

// Start initialization when document is ready
if (document.readyState === "complete") {
  initialize();
} else {
  window.addEventListener("load", initialize);
}
