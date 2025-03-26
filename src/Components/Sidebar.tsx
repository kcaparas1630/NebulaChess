import { useState, useEffect } from "react";

const Sidebar = () => {
  const [, setIsActive] = useState(false);
  const [bestMove, setBestMove] = useState("");
  const [bestMoveEval, setBestMoveEval] = useState(0);
  const [alternativeMoves, setAlternativeMoves] = useState([]);
  
  // Get chess piece icon based on move notation
  const getPieceIcon = (move: string): string | null => {
    if (!move) return null;
    
    // Extract the piece from the move notation
    const pieceMap: { [key: string]: string } = {
      'K': '♔', // King
      'Q': '♕', // Queen
      'R': '♖', // Rook
      'B': '♗', // Bishop
      'N': '♘', // Knight
      'P': '♙', // Pawn
      '': '♙'   // Default to pawn
    };
    
    const firstChar = move.charAt(0).toUpperCase();
    if (pieceMap[firstChar] && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      return pieceMap[firstChar];
    }
    
    return pieceMap['P'];
  };

  // Format the move for display
  const formatMoveDisplay = (move: string): string => {
    if (!move) return '';
    // Basic formatting logic - can be expanded based on your notation
    return move;
  };

  // Listen for messages from the content script
  useEffect(() => {
    const handleAnalysisResult = (event: MessageEvent) => {
      if (event.data && event.data.type === "CHESS_ANALYSIS_RESULT") {
        console.log("Received analysis:", event.data);
        setBestMove(event.data.bestMove);
        setBestMoveEval(event.data.evaluation || 0);
        setAlternativeMoves(event.data.alternativeMoves || []);
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
    // Set up message listener for state updates
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "UPDATE_STATE") {
        console.log("Received UPDATE_STATE message:", event.data);
        setIsActive(event.data.isActive || false);
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
        <div className="best-move-card">
          <h3 className="card-title">Best Move</h3>
          <div className="move-text">
            <span className="chess-piece">{getPieceIcon(bestMove)}</span>
            {formatMoveDisplay(bestMove)}
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
          {alternativeMoves.map((move, index) => (
            <div className="alternative-move-card" key={`${move}-${index}`}>
              <div className="move-text">
                <span className="chess-piece">{getPieceIcon(move)}</span>
                {formatMoveDisplay(move)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default Sidebar;
