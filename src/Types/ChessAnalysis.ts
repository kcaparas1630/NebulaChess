interface ChessAnalysis {
    evaluation: number;
    bestMove: string;
    depth: number;
    alternativeMoves?: Array<{
      move: string;
      evaluation?: number;
    }>;
  }

export default ChessAnalysis;
