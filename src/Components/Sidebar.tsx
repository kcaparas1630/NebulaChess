import { useState, useEffect, useRef } from "react";
import AlternativeMove from "../Types/AlternativeMoves";

const Sidebar = () => {
  const [, setIsActive] = useState(false);
  const [bestMove, setBestMove] = useState<string>("");
  const [bestMoveEval, setBestMoveEval] = useState<number>(0);
  const [alternativeMoves, setAlternativeMoves] = useState<AlternativeMove[]>([]);
  const styleCheckRef = useRef<boolean>(false);
  
  // Function to ensure styles are still there
  const checkAndFixStyles = (): void => {
    if (styleCheckRef.current) return; // Only run once
    
    // Find our shadow root
    const container = document.getElementById("chess-assistant-root");
    if (container && container.shadowRoot) {
      const shadow = container.shadowRoot;
      
      // Check if styles exist
      const existingStyles = shadow.getElementById("chess-assistant-styles");
      if (!existingStyles) {
        console.log("Styles missing, re-injecting");
        const styleElement = document.createElement("style");
        styleElement.id = "chess-assistant-styles";
        shadow.insertBefore(styleElement, shadow.firstChild); // Insert at beginning
      }
      
      styleCheckRef.current = true;
    }
  };
  
  // Get chess piece icon based on move notation
  const getPieceIcon = (move: string | unknown): string => {
    // Ensure move is a string and not null/undefined/object
    if (!move || typeof move !== 'string') {
      console.warn('Invalid move passed to getPieceIcon:', move);
      return '♙'; // Default to pawn for invalid input
    }
    
    // Extract the piece from the move notation
    const pieceMap: Record<string, string> = {
      'K': '♔', // King
      'Q': '♕', // Queen
      'R': '♖', // Rook
      'B': '♗', // Bishop
      'N': '♘', // Knight
      'P': '♙', // Pawn
      '': '♙'   // Default to pawn
    };
    
    try {
      const firstChar = move.charAt(0).toUpperCase();
      if (
        Object.prototype.hasOwnProperty.call(pieceMap, firstChar) && 
        firstChar === firstChar.toUpperCase() && 
        firstChar !== firstChar.toLowerCase()
      ) {
        return pieceMap[firstChar];
      }
    } catch (error) {
      console.error('Error in getPieceIcon:', error, 'Move:', move);
    }
    
    // Default fallback
    return '♙';
  };

  // Listen for messages from the content script
  useEffect(() => {
    const handleAnalysisResult = (event: MessageEvent) => {
      if (event.data && event.data.type === "CHESS_ANALYSIS_RESULT") {
        console.log("Received analysis:", event.data);
        
        // Get the data with safer type handling
        const bestMoveData = event.data.bestMove || "";
        const evalData = event.data.evaluation || 0;

        let altMovesData: AlternativeMove[] = [];
        if (Array.isArray(event.data.alternativeMoves)) {
          altMovesData = event.data.alternativeMoves.map((move: string | AlternativeMove) => {
            // Handle if it's just a string (backward compatibility)
            if (typeof move === 'string') {
              return { move: move, evaluation: null };
            }
            // Handle if it's already an object
            else if (typeof move === 'object' && move !== null && 'move' in move) {
              return {
                move: move.move,
                evaluation: move.evaluation !== undefined ? move.evaluation : null
              };
            }
            // Skip invalid items
            return null;
          }).filter(Boolean) as AlternativeMove[];
        }
        console.log('alternative moves', altMovesData);
        // Set the state with properly typed data
        setBestMove(bestMoveData);
        setBestMoveEval(evalData);
        setAlternativeMoves(altMovesData);
        
        // Check styles after receiving analysis
        checkAndFixStyles();
      }
    };
    
    window.addEventListener("message", handleAnalysisResult);
    return () => {
      window.removeEventListener("message", handleAnalysisResult);
    };
  }, []);

  // Get initial state when component mounts
  useEffect(() => {
    console.log("Sidebar component mounted");
    
    // Make sure styles exist on mount
    checkAndFixStyles();
    
    // Set up message listener for state updates
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "UPDATE_STATE") {
        console.log("Received UPDATE_STATE message:", event.data);
        setIsActive(!!event.data.isActive);
        
        // Check styles after state update
        checkAndFixStyles();
      }
    };
    
    window.addEventListener("message", handleMessage);
    
    // Request initial state from content script
    console.log("Requesting initial state");
    window.parent.postMessage({ type: "GET_INITIAL_STATE" }, "*");
    
    return () => {
      console.log("Sidebar component unmounting");
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Chess Analysis</h2>
      </div>
      
      {bestMove && (
        <div className="best-move-card card">
          <h3 className="card-title">Best Move</h3>
          <div className="move-text">
            <span className="chess-piece">{getPieceIcon(bestMove)}</span>
            {bestMove}
            {bestMoveEval >= 0 ? (
              <span className="eval-badge positive">+ {bestMoveEval.toFixed(1)}</span>
            ) : (
              <span className="eval-badge negative">{bestMoveEval.toFixed(1)}</span>
            )}
          </div>
        </div>
      )}
      
      {alternativeMoves.length > 0 && (
        <>
          <h3 className="card-title">Alternative Moves</h3>
          {alternativeMoves.map((moveObj, index) => (
            <div className="alternative-move-card card" key={`${moveObj.move}-${index}`}>
              <div className="move-text alternative">
                <span className="chess-piece">{getPieceIcon(moveObj.move)}</span>
                {moveObj.move}
                {typeof moveObj.evaluation === 'number' && (
                  <span className={`eval-badge ${moveObj.evaluation >= 0 ? 'positive' : 'negative'}`}>
                    {moveObj.evaluation >= 0 ? '+ ' : ''}{moveObj.evaluation.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Sidebar;
