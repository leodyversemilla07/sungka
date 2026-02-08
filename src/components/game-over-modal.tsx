import { PLAYER_1, PLAYER_2 } from "../game/sungka-engine";
import type { GameState, Player } from "../game/sungka-engine";

interface GameOverModalProps {
  gameState: GameState;
  p1Score: number;
  p2Score: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
  isRoundOver?: boolean;
  round?: number;
}

export default function GameOverModal({
  gameState,
  p1Score,
  p2Score,
  onPlayAgain,
  onMainMenu,
  isRoundOver = false,
  round = 1,
}: GameOverModalProps) {
  const winner: Player | null = isRoundOver
    ? gameState.roundWinner
    : gameState.winner;

  let title: string;
  if (isRoundOver) {
    // Round over — show round results
    if (winner === null) {
      title = `Round ${round} \u2014 Draw!`;
    } else if (winner === PLAYER_1) {
      title = `Round ${round} \u2014 Player 1 Wins!`;
    } else {
      title = `Round ${round} \u2014 Player 2 Wins!`;
    }
  } else {
    // Match over — show final results
    if (winner === null) {
      title = "Match Draw!";
    } else if (winner === PLAYER_1) {
      title = "Player 1 Wins the Match!";
    } else {
      title = "Player 2 Wins the Match!";
    }
  }

  // Count burnt pits for display
  const burntPits = gameState.burntPits;
  const p1BurntCount = burntPits.filter((i) => i >= 1 && i <= 7).length;
  const p2BurntCount = burntPits.filter((i) => i >= 9 && i <= 15).length;

  return (
    <div className="game-over-overlay">
      <div className="game-over-modal">
        <div className="game-over-title">{title}</div>
        <div className="game-over-scores">
          <div
            className={`game-over-player${winner === PLAYER_1 ? " winner" : ""}`}
          >
            <span className="game-over-player-label">PLAYER 1</span>
            <span className="game-over-player-score">{p1Score}</span>
            {p1BurntCount > 0 && (
              <span className="game-over-burnt-info">
                {p1BurntCount} burnt pit{p1BurntCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <span className="game-over-vs">vs</span>
          <div
            className={`game-over-player${winner === PLAYER_2 ? " winner" : ""}`}
          >
            <span className="game-over-player-label">PLAYER 2</span>
            <span className="game-over-player-score">{p2Score}</span>
            {p2BurntCount > 0 && (
              <span className="game-over-burnt-info">
                {p2BurntCount} burnt pit{p2BurntCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {isRoundOver && (
          <p className="round-over-hint">
            Shells will be redistributed. Unfilled pits become burnt (sunog).
          </p>
        )}
        <div className="game-over-actions">
          <button className="menu-btn" onClick={onPlayAgain}>
            {isRoundOver ? "Next Round" : "Play Again"}
          </button>
          <button className="menu-btn back-btn" onClick={onMainMenu}>
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
