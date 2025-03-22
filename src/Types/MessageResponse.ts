import ChessAnalysis from "./ChessAnalysis";

interface MessageResponse {
    success: boolean;
    isActive?: boolean;
    analysis?: ChessAnalysis;
    error?: string;
}

export default MessageResponse;
