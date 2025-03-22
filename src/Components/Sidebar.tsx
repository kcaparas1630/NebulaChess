import { useState, useEffect } from "react";
import {
  BestMoveCard,
  ReasoningCard,
  CardTitle,
  MoveText,
  ReasoningText,
} from "../Commons/StyledSidebar";

const Sidebar = () => {
  const [, setIsActive] = useState<boolean>(false);
  const [bestMove, setBestMove] = useState<string>("E2 - E4");
  const [moveReasoning, setMoveReasoning] = useState<string>(
    "Controls the center and opens lines for both the queen and king's bishop."
  );
  // listen for messages from the content script
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "CHESS_ANALYSIS_RESULT") {
      setBestMove(event.data.bestMove);
      setMoveReasoning(event.data.moveReasoning);
    }
  });
  
  // Get initial state when component mounts
  useEffect(() => {
    console.log("Sidebar component mounted");

    // Set up message listener
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

//   // Handle toggle
//   const handleToggle = () => {
//     console.log("Toggle button clicked");
//     window.parent.postMessage({ type: "TOGGLE_ASSISTANT_REQUEST" }, "*");
//   };
  console.log(bestMove, moveReasoning);
  return (
    <>
      <BestMoveCard>
        <CardTitle>Best Move</CardTitle>
        <MoveText>{bestMove}</MoveText>
      </BestMoveCard>

      <ReasoningCard>
        <CardTitle>Analysis</CardTitle>
        <ReasoningText>{moveReasoning}</ReasoningText>
      </ReasoningCard>
    </>
  );
};

export default Sidebar;
