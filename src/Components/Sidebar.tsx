import { useState, useEffect } from "react";

const Sidebar = () => {
  const [isActive, setIsActive] = useState<boolean>(false);

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

  // Handle toggle
  const handleToggle = () => {
    console.log("Toggle button clicked");
    window.parent.postMessage({ type: "TOGGLE_ASSISTANT_REQUEST" }, "*");
  };

  return (
    <div className="App">
      <h1>Chess Assistant</h1>
      <button onClick={handleToggle}>
        {isActive ? "Deactivate" : "Activate"} Assistant
      </button>
      <p>Status: {isActive ? "Active" : "Inactive"}</p>
    </div>
  );
};

export default Sidebar;
