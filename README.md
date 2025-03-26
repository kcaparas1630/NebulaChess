# NebulaChess Assistant for Lichess

NebulaChess Assistant is a Chrome extension that enhances your chess experience on Lichess.org with AI-powered analysis, move suggestions, and strategic insights during gameplay.

## Features

- **Real-time Analysis**: Get instant evaluation of the current board position
- **Move Suggestions**: Receive AI-recommended moves based on your position
- **Player Color Detection**: Automatically detects whether you're playing as white or black
- **FEN Extraction**: Captures the current board state in FEN notation for accurate analysis
- **Sidebar Interface**: Clean, non-intrusive UI that doesn't interfere with the Lichess experience
- **Move History Tracking**: Keeps track of the game progression for contextual analysis
- **Lichess Integration**: Seamlessly works with Lichess.org's interface


### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Build the extension with `npm run build`
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the `dist` directory from the project

## Usage

1. Visit Lichess.org and start or join a game
2. The NebulaChess Assistant sidebar will appear on the right side of the screen
3. Toggle the assistant on/off using the extension icon in your browser toolbar
4. Receive real-time analysis and suggestions as you play

## Technical Architecture

### Extension Components
- **Background Script**: Manages extension state and communication
- **Content Script**: Interfaces with the Lichess DOM
- **Sidebar**: React-based UI component for displaying analysis
- **Analysis Engine**: Connects to Nebius AI for chess position evaluation

### Key Utilities
- `ExtractFen.ts`: Extracts the current board state in FEN notation
- `DetectPlayerColor.ts`: Determines whether the player is white or black
- `AnalyzeCurrentPosition.ts`: Sends position data to the AI service
- `PollBoardUntilStable.ts`: Ensures board animations are complete before analysis

## Development

### Prerequisites
- Node.js and npm

### Setup
```bash
# Clone the repository
git clone https://github.com/kcaparas1630/NebulaChess.git
```

```bash
# Install dependencies
npm install
```

### Build
```bash
npm run build
```

### Project Structure
```
nebula-chess/
├── src/
    ├── Components/
        ├── Sidebar.tsx
│   ├── services/
│   │   ├── background.ts
│   │   ├── contentScript.ts
│   │   └── popup.ts
│   ├── Utils/
│   │   ├── AnalyzePawnStructure.ts
│   │   ├── CreateContext.ts
│   │   ├── FindDoubledPawns.ts
│   │   └── FindIsolatedPawns.ts
│   │   └── ValidateFen.ts
│   │   └── ValidateMoves.ts
    └── App.tsx
│   └── main.tsx
├── contentScriptLoader.js
├── manifest.json
└── vite.config.ts
```

## Troubleshooting

### Common Issues
- **Sidebar not appearing**: Ensure the extension is enabled and refresh the Lichess page
- **Analysis not working**: Check your connection to the Nebius AI service
- **Extension conflicts**: Disable other chess-related extensions that might interfere
- **Missing Nebius API Key** Sorry can't give it. :P Use yours?

### Debugging
1. Open Chrome DevTools on the Lichess page
