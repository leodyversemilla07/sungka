import { PLAYER_1, PLAYER_2 } from "../game/sungka-engine";
import type { Player } from "../game/sungka-engine";
import type { Difficulty } from "../game/sungka-ai";
import type { GameMode } from "../hooks/use-game-state";
import { useGameState, loadSession } from "../hooks/use-game-state";
import Board from "./board";
import GameOverModal from "./game-over-modal";

interface GameScreenProps {
  mode: GameMode;
  difficulty?: Difficulty;
  onMainMenu: () => void;
}

export default function GameScreen({
  mode,
  difficulty,
  onMainMenu,
}: GameScreenProps) {
  const restoredSession = loadSession();
  const restored = restoredSession?.mode === mode ? restoredSession : null;

  const {
    gameState,
    animating,
    animatingPit,
    message,
    handleMove,
    resetGame,
    nextRound,
    showRoundOver,
    firstMovePicks,
    p1Score,
    p2Score,
    validMoves,
  } = useGameState(mode, difficulty, restored);

  const currentPlayer = gameState.currentPlayer;
  const round = gameState.round;
  const statusTone =
    message === "Capture!"
      ? " capture"
      : message === "Extra turn!"
        ? " extra-turn"
        : "";

  const getPlayerLabel = (player: Player): string => {
    if (mode === "ai") {
      return player === PLAYER_1 ? "You" : "AI";
    }
    return player === PLAYER_1 ? "Player 1" : "Player 2";
  };

  const getTurnText = (): string => {
    if (gameState.gameOver || gameState.matchOver) return "";
    if (gameState.roundOver) return "";
    if (animating) return "...";

    // Simultaneous first move phase
    if (gameState.isFirstMove) {
      if (mode === "local") {
        if (firstMovePicks.p1 === null) {
          return "First Move \u2014 Player 1: choose a pit";
        }
        return "First Move \u2014 Player 2: choose a pit";
      }
      if (mode === "ai") {
        return "First Move \u2014 Choose your pit";
      }
    }

    if (mode === "ai" && currentPlayer === PLAYER_2) return "AI is thinking...";
    return `${getPlayerLabel(currentPlayer)}'s Turn`;
  };

  const liveAnnouncement = (() => {
    if (gameState.matchOver || gameState.gameOver) {
      if (gameState.winner === null) return `Match over. Draw. Final score ${p1Score} to ${p2Score}.`;
      return `Match over. ${getPlayerLabel(gameState.winner)} wins. Final score ${p1Score} to ${p2Score}.`;
    }

    if (gameState.roundOver) {
      if (gameState.roundWinner === null) {
        return `Round ${round} over. Draw. Score ${p1Score} to ${p2Score}.`;
      }
      return `Round ${round} over. ${getPlayerLabel(gameState.roundWinner)} wins the round. Score ${p1Score} to ${p2Score}.`;
    }

    const turnText = getTurnText();
    if (message) {
      return `${message} ${turnText}`.trim();
    }

    return turnText;
  })();

  return (
    <main className="game-screen" role="main" aria-label="Game screen">
      <div className="game-header">
        <div className="player-info">
          <span
            className={`player-name${
              !gameState.isFirstMove && currentPlayer === PLAYER_2
                ? " active"
                : ""
            }`}
          >
            {getPlayerLabel(PLAYER_2)}
          </span>
          <span className="player-score">{p2Score}</span>
        </div>

        <div
          className={`status-plaque${statusTone}`}
          role="status"
          aria-live="polite"
        >
          <div className="round-indicator">Round {round}</div>
          <div className="turn-indicator">{getTurnText()}</div>
          {message && <div className="game-status">{message}</div>}
        </div>

        <div className="player-info">
          <span
            className={`player-name${
              !gameState.isFirstMove && currentPlayer === PLAYER_1
                ? " active"
                : ""
            }`}
          >
            {getPlayerLabel(PLAYER_1)}
          </span>
          <span className="player-score">{p1Score}</span>
        </div>
      </div>

      <Board
        gameState={gameState}
        onPitClick={handleMove}
        validMoves={animating ? [] : validMoves}
        animatingPit={animatingPit}
        playerOneLabel={getPlayerLabel(PLAYER_1)}
        playerTwoLabel={getPlayerLabel(PLAYER_2)}
      />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <div className="game-controls">
        <button className="control-btn" onClick={resetGame}>
          Restart
        </button>
        <button className="control-btn" onClick={onMainMenu}>
          Menu
        </button>
      </div>

      {/* Round Over Modal (not match over) */}
      {showRoundOver && !gameState.gameOver && !gameState.matchOver && (
        <GameOverModal
          gameState={gameState}
          p1Score={p1Score}
          p2Score={p2Score}
          onPlayAgain={nextRound}
          onMainMenu={onMainMenu}
          isRoundOver={true}
          round={round}
        />
      )}

      {/* Match Over Modal */}
      {(gameState.gameOver || gameState.matchOver) && (
        <GameOverModal
          gameState={gameState}
          p1Score={p1Score}
          p2Score={p2Score}
          onPlayAgain={resetGame}
          onMainMenu={onMainMenu}
          isRoundOver={false}
          round={round}
        />
      )}
    </main>
  );
}
