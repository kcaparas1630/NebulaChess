const validateFen = (fen: string): { valid: boolean; error: string | null } => {
  if (!fen) return { valid: false, error: "Empty FEN string" };

  // Basic validation: Check if we have a valid FEN structure
  const fenParts = fen.split(" ");
  if (fenParts.length !== 6) {
    return { valid: false, error: "FEN must have 6 parts" };
  }

  // Validate board part
  const boardPart = fenParts[0];
  const ranks = boardPart.split("/");

  if (ranks.length !== 8) {
    return { valid: false, error: "Board must have 8 ranks" };
  }

  // Validate each rank
  for (const rank of ranks) {
    let sum = 0;
    for (const char of rank) {
      if (/^\d$/.test(char)) {
        sum += parseInt(char);
      } else if (/^[prnbqkPRNBQK]$/.test(char)) {
        sum += 1;
      } else {
        return { valid: false, error: `Invalid character in rank: ${char}` };
      }
    }

    if (sum !== 8) {
      return { valid: false, error: `Rank does not have 8 squares: ${rank}` };
    }
  }

  // Check for exactly one white king and one black king
  const whiteKingCount = (boardPart.match(/K/g) || []).length;
  const blackKingCount = (boardPart.match(/k/g) || []).length;

  if (whiteKingCount !== 1) {
    return {
      valid: false,
      error: `There must be exactly one white king, found ${whiteKingCount}`,
    };
  }

  if (blackKingCount !== 1) {
    return {
      valid: false,
      error: `There must be exactly one black king, found ${blackKingCount}`,
    };
  }

  // Validate turn
  if (fenParts[1] !== "w" && fenParts[1] !== "b") {
    return { valid: false, error: "Turn must be 'w' or 'b'" };
  }

  // Validate castling
  if (!/^(-|[KQkq]+)$/.test(fenParts[2])) {
    return { valid: false, error: "Invalid castling rights" };
  }

  // Validate en passant
  if (!/^(-|[a-h][36])$/.test(fenParts[3])) {
    return { valid: false, error: "Invalid en passant square" };
  }

  // Validate halfmove clock
  if (!/^\d+$/.test(fenParts[4])) {
    return { valid: false, error: "Halfmove clock must be a number" };
  }

  // Validate fullmove number
  if (!/^\d+$/.test(fenParts[5])) {
    return { valid: false, error: "Fullmove number must be a number" };
  }

  return { valid: true, error: null };
};

export default validateFen;
