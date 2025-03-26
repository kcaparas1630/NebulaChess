const SIDEBAR_STYLES = `
  #react-root {
    width: 20vw;
    height: 100vh;
    background-color: #2b2b2b;
    color: #ffffff;
    font-family: Arial, sans-serif;
    padding: 16px;
    box-sizing: border-box;
    overflow-y: auto;
    box-shadow: -2px 0 5px rgba(0,0,0,0.2);
  }
  /* Base Card styles */
  .card {
    background: #333333;
    border-radius: 10px;
    padding: 16px;
    margin: 16px 0;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    overflow: hidden;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
  }

  .card::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
    pointer-events: none;
  }

  /* Best Move Card styles (extends base card) */
  .best-move-card {
    border-left: 4px solid #4CAF50;
    background: linear-gradient(to right, #2a3a2a, #333333);
  }

  .best-move-card::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 30px;
    height: 30px;
    background: radial-gradient(circle at top right, rgba(76, 175, 80, 0.2), transparent 70%);
  }
  .alternative-move-card {
    border-left: 4px solid #2196F3;
    background: linear-gradient(to right, #2a2a3a, #333333);
    padding: 12px 16px;
  }
  .alternative-move-card::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 25px;
    height: 25px;
    background: radial-gradient(circle at top right, rgba(33, 150, 243, 0.15), transparent 70%);
  }
  .card-title {
    margin: 0 0 12px 0;
    font-size: 1.1rem;
    color: #ffffff;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
  .card-title::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    background-color: #4CAF50;
    border-radius: 50%;
    margin-right: 8px;
  }
  .move-text {
    font-size: 1.3rem;
    font-weight: bold;
    color: #4CAF50;
    display: flex;
    align-items: center;
    letter-spacing: 0.5px;
  }
  .move-text.alternative {
    font-size: 1.1rem;
    color: #2196F3;
  }
  .eval-badge {
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.9rem;
    margin-left: 10px;
    font-weight: normal;
  }
  .eval-badge.positive {
    background-color: rgba(76, 175, 80, 0.2);
    color: #4CAF50;
  }
  .eval-badge.negative {
    background-color: rgba(244, 67, 54, 0.2);
    color: #F44336;
  }
  .sidebar-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    background-color: #252525;
    background-image: 
      linear-gradient(to bottom, rgba(30, 30, 30, 0.8) 0%, rgba(30, 30, 30, 0) 100%),
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 10px);
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .sidebar-title {
    font-size: 1.25rem;
    color: #ffffff;
    margin: 0;
    font-weight: 600;
  }
  .chess-piece {
    margin-right: 8px;
    font-size: 1.4em;
    line-height: 1;
  }
`;

export default SIDEBAR_STYLES;
