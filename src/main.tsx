// Add type declarations for global properties
declare global {
  interface Window {
    __CHESS_ASSISTANT_INITIALIZED: boolean;
    __CHESS_ASSISTANT_ROOT: ReturnType<typeof createRoot>;
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// Add a global flag to prevent double initialization
window.__CHESS_ASSISTANT_INITIALIZED = false;

// Listen for the container ready message from the content script
window.addEventListener('message', (event) => {
  if (
    event.data.type === 'CHESS_ASSISTANT_CONTAINER_READY' && 
    !window.__CHESS_ASSISTANT_INITIALIZED
  ) {
    // Set the flag to true to prevent multiple initializations
    window.__CHESS_ASSISTANT_INITIALIZED = true;
    
    console.log('Chess Assistant container is ready, initializing React app');
    
    // Find the shadow DOM root
    const container = document.getElementById('chess-assistant-root');
    if (container && container.shadowRoot) {
      const reactRoot = container.shadowRoot.getElementById('react-root');
      
      if (reactRoot) {
        try {
          const root = createRoot(reactRoot); 
          root.render(
            <StrictMode>
              <App />
            </StrictMode>
          );
          console.log('Chess Assistant React app initialized successfully');

          // add a global reference to the root for potential debugging
          window.__CHESS_ASSISTANT_ROOT = root;
        } catch (error) {
          console.error('Failed to initialize Chess Assistant React app:', error);
        }
      } else {
        console.error('React root element not found in shadow DOM');
      }
    } else {
      console.error('Container or shadow root not found');
    }
  }
});

// Log when this script initially loads
console.log('Chess Assistant main.tsx script loaded');
