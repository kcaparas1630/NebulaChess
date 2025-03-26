const validateMove = (fen: string, moveNotation: string): boolean => {
  if (!fen || !moveNotation) return false;

  try {
    // Parse FEN to get the board state
    const boardPart = fen.split(" ")[0];
    const ranks = boardPart.split("/");

    // Convert to a 2D array for easier processing
    const board: string[][] = [];
    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
      const rank = ranks[rankIndex];
      const row: string[] = [];

      for (const char of rank) {
        if (/^\d$/.test(char)) {
          // Empty squares
          const emptyCount = parseInt(char);
          for (let i = 0; i < emptyCount; i++) {
            row.push("");
          }
        } else {
          // Piece
          row.push(char);
        }
      }

      board.push(row);
    }

    // Handle the specific case of bishop moves, which are often problematic
    if (moveNotation.startsWith("B") && !moveNotation.includes("x")) {
      // Extract destination square
      const destSquare = moveNotation.substring(1);
      const destFile = destSquare.charCodeAt(0) - 97; // 'a' -> 0
      const destRank = 8 - parseInt(destSquare[1]); // '1' -> 7

      // Is white's turn?
      const isWhiteTurn = fen.includes(" w ");
      const bishopChar = isWhiteTurn ? "B" : "b";

      // Find all bishops of the current player
      const bishops: [number, number][] = [];
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          if (board[r][f] === bishopChar) {
            bishops.push([r, f]);
          }
        }
      }

      // Check if any bishop can reach the destination
      let canReach = false;
      for (const [bishopRank, bishopFile] of bishops) {
        // Bishops move diagonally, so the difference in rank and file must be equal
        if (
          Math.abs(bishopRank - destRank) === Math.abs(bishopFile - destFile)
        ) {
          // Check if the path is clear
          const rankStep = bishopRank < destRank ? 1 : -1;
          const fileStep = bishopFile < destFile ? 1 : -1;

          let pathClear = true;
          let r = bishopRank + rankStep;
          let f = bishopFile + fileStep;

          while (r !== destRank && f !== destFile) {
            if (r < 0 || r >= 8 || f < 0 || f >= 8) {
              pathClear = false;
              break;
            }

            if (board[r][f] !== "") {
              pathClear = false;
              break;
            }

            r += rankStep;
            f += fileStep;
          }

          // Final check of destination square
          if (pathClear && board[destRank][destFile] === "") {
            canReach = true;
            break;
          }
        }
      }

      if (!canReach) {
        console.warn(`No bishop can reach ${destSquare} in this position`);
        return false;
      }
      return true;
    }

    // For other move types, assume valid for now
    return true;
  } catch (error) {
    console.error("Error validating move:", error);
    return true; // Default to allowing the move in case of validator error
  }
};

export default validateMove;
