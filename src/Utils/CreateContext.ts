import analyzePawnStructure from "./AnalyzePawnStructure";
import ChessMove from "../Types/ChessMove";

const createEnhancedContext = (
    fen: string,
    moveHistory: (string | ChessMove)[]
  ): string => {
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

  export default createEnhancedContext;
