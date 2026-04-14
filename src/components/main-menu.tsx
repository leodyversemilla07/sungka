import { useState } from "react";
import type { GameMode } from "../hooks/use-game-state";
import type { Difficulty } from "../game/sungka-ai";

interface MainMenuProps {
  onStartGame: (mode: GameMode, difficulty?: Difficulty) => void;
}

export default function MainMenu({ onStartGame }: MainMenuProps) {
  const [showAIOptions, setShowAIOptions] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  return (
    <main className="menu-screen" role="main" aria-label="Main menu">
      <h1 className="menu-title">SUNGKA</h1>
      <p className="menu-subtitle">Traditional Filipino Board Game</p>

      {!showAIOptions ? (
        <div className="menu-options">
          <button className="menu-btn" onClick={() => onStartGame("local")}>
            Local Multiplayer
          </button>
          <button className="menu-btn" onClick={() => setShowAIOptions(true)}>
            Play vs AI
          </button>
          <button className="menu-btn" onClick={() => onStartGame("online")}>
            Online Multiplayer
          </button>
        </div>
      ) : (
        <div className="menu-options">
          <div className="difficulty-select">
            <span className="difficulty-label">DIFFICULTY</span>
            <div className="difficulty-options">
              {difficulties.map((d) => (
                <button
                  key={d}
                  className={`diff-btn${difficulty === d ? " active" : ""}`}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            className="menu-btn"
            onClick={() => onStartGame("ai", difficulty)}
          >
            Start Game
          </button>
          <button
            className="menu-btn back-btn"
            onClick={() => setShowAIOptions(false)}
          >
            Back
          </button>
        </div>
      )}
    </main>
  );
}
