import { useState } from "react";
import MainMenu from "./components/main-menu";
import GameScreen from "./components/game-screen";
import OnlineGame from "./components/online-game";
import type { GameMode } from "./hooks/use-game-state";
import { loadSession, clearSession } from "./hooks/use-game-state";
import type { Difficulty } from "./game/sungka-ai";
import "./styles/sungka.css";

type Screen = "menu" | "local" | "ai" | "online";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = loadSession();
    return saved ? (saved.mode as Screen) : "menu";
  });
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = loadSession();
    return saved?.difficulty ?? "medium";
  });

  const handleStartGame = (mode: GameMode, diff?: Difficulty): void => {
    if (mode === "ai") {
      setDifficulty(diff ?? "medium");
    }
    // Clear any old session when starting a fresh game
    clearSession();
    setScreen(mode);
  };

  const handleMainMenu = (): void => {
    clearSession();
    setScreen("menu");
  };

  return (
    <div className="game-container">
      {screen === "menu" && <MainMenu onStartGame={handleStartGame} />}
      {screen === "local" && (
        <GameScreen mode="local" onMainMenu={handleMainMenu} />
      )}
      {screen === "ai" && (
        <GameScreen
          mode="ai"
          difficulty={difficulty}
          onMainMenu={handleMainMenu}
        />
      )}
      {screen === "online" && <OnlineGame onMainMenu={handleMainMenu} />}
    </div>
  );
}
