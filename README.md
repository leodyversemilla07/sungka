# Sungka

A web-based implementation of **Sungka**, a traditional Filipino mancala board game, built with React and TypeScript. Play locally against a friend, challenge an AI opponent, or compete online via real-time multiplayer.

## Game Rules

Sungka is played on a wooden board with **two stores** (head/ulo) and **14 pits** (7 per player), each starting with 7 shells.

### Basic Play

1. **First move** is simultaneous -- both players pick a pit at the same time. The player who finishes sowing first takes the next turn.
2. On your turn, pick up all shells from one of your pits and distribute them **counter-clockwise**, one per pit, skipping your opponent's store.
3. **Multi-lap sowing**: if your last shell lands in an occupied pit (not a store), pick up all shells in that pit and continue sowing.
4. **Extra turn**: if your last shell lands in your own store, you get another turn.
5. **Capture**: if your last shell lands in an empty pit on your side and the opposite pit has shells, capture both and place them in your store.
6. A round ends when one side has no shells in any pit. Remaining shells on the other side go to that player's store.

### Multi-Round (Sunog / Burnt Holes)

After each round, players redistribute shells from their stores back into their pits (7 per pit, leftmost first). Pits that can't be filled become **burnt** (sunog) and are skipped in future rounds. The match ends when a player can't fill even one pit (fewer than 7 shells total).

## Features

- **Three game modes**: Local Multiplayer, Play vs AI, Online Multiplayer
- **AI with three difficulties**: Easy, Medium, Hard -- powered by negamax with Zobrist hashing, transposition tables, and iterative deepening
- **Real-time shell animation**: step-by-step sowing with visual feedback
- **Multi-round support**: burnt pits, round transitions, match-over detection
- **Online multiplayer**: Socket.IO rooms with 5-character codes
- **Game persistence**: local/AI games auto-save to localStorage and restore on page reload
- **Mobile landscape optimized**: responsive layout using `dvh` units and `clamp()` sizing
- **Traditional wooden aesthetic**: dark wood textures, cowrie shell dots, gold accents

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 19, TypeScript (strict)     |
| Bundler  | Vite 7                            |
| Server   | Express 5, Socket.IO 4            |
| Styling  | Vanilla CSS (custom properties)   |
| Fonts    | Cinzel, MedievalSharp (Google)    |

## Project Structure

```
sungka/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── app.tsx                     # Root component, routing, session restore
│   ├── game/
│   │   ├── sungka-engine.ts        # Core game engine (shared with server)
│   │   └── sungka-ai.ts            # AI (Zobrist + TT + iterative deepening)
│   ├── hooks/
│   │   └── use-game-state.ts       # Game state hook, animation, persistence
│   ├── components/
│   │   ├── board.tsx               # Board rendering
│   │   ├── game-screen.tsx         # Local/AI game screen
│   │   ├── game-over-modal.tsx     # Round-over / match-over modal
│   │   ├── main-menu.tsx           # Main menu with mode selection
│   │   └── online-game.tsx         # Online multiplayer (Socket.IO)
│   └── styles/
│       └── sungka.css              # All styles
├── server/
│   └── index.ts                    # Socket.IO server (imports shared engine)
├── index.html
├── vite.config.ts
├── tsconfig.json                   # Client TypeScript config
├── tsconfig.server.json            # Server TypeScript config
├── eslint.config.js
└── package.json
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

### Installation

```bash
git clone <repository-url>
cd sungka
npm install
```

### Development

Start the Vite dev server (client):

```bash
npm run dev
```

Start the Socket.IO server (required for online multiplayer):

```bash
npm run server
```

The client runs on `http://localhost:5173` by default. The server runs on port `3001`.

To change the server URL for the client, set the `VITE_SERVER_URL` environment variable:

```bash
VITE_SERVER_URL=http://your-server:3001 npm run dev
```

### Build

```bash
npm run build
```

Output is written to `dist/`. Preview the production build:

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
# Client
npx tsc -b

# Server
npx tsc --project tsconfig.server.json --noEmit
```

## Board Layout

```
         P2 Store (idx 8)
  [15] [14] [13] [12] [11] [10] [9]    <- Player 2's pits
  [ 1] [ 2] [ 3] [ 4] [ 5] [ 6] [7]   <- Player 1's pits
         P1 Store (idx 0)
```

- Indices 0 and 8 are stores; indices 1-7 are Player 1's pits; indices 9-15 are Player 2's pits.
- Sowing direction is counter-clockwise, skipping the opponent's store.
- Opposite pit formula: `16 - pitIndex`.

## License

This project is licensed under the [MIT License](LICENSE).
