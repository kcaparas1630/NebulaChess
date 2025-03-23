interface ChessAnalysis {
    evaluation: number;
    bestMove: string;
    moveReasoning: string;
    depth: number;
    alternativeMoves?: Array<{
      move: string;
      reasoning: string;
      evaluation?: number;
    }>;
  }

export default ChessAnalysis;
