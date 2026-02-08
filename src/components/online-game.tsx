import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  PLAYER_1,
  PLAYER_2,
  createInitialState,
  getValidMoves,
  getScore,
} from "../game/sungka-engine";
import type { GameState, Player, AnimationStep } from "../game/sungka-engine";
import Board from "./board";
import GameOverModal from "./game-over-modal";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

type OnlineScreen = "lobby" | "waiting" | "playing";

interface OnlineGameProps {
  onMainMenu: () => void;
}

export default function OnlineGame({ onMainMenu }: OnlineGameProps) {
  const [screen, setScreen] = useState<OnlineScreen>("lobby");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [playerNumber, setPlayerNumber] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [animatingPit, setAnimatingPit] = useState<number | null>(null);
  const [showRoundOver, setShowRoundOver] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAnimTimers = (): void => {
    animTimers.current.forEach((t) => clearTimeout(t));
    animTimers.current = [];
  };

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setError("");
    });

    socket.on("connect_error", () => {
      setError("Cannot connect to server. Make sure the server is running.");
    });

    socket.on(
      "room-created",
      ({ roomCode: code, player }: { roomCode: string; player: Player }) => {
        setRoomCode(code);
        setPlayerNumber(player);
        setScreen("waiting");
      },
    );

    socket.on(
      "room-joined",
      ({ roomCode: code, player }: { roomCode: string; player: Player }) => {
        setRoomCode(code);
        setPlayerNumber(player);
      },
    );

    socket.on("game-start", ({ state }: { state: GameState }) => {
      setGameState(state);
      setScreen("playing");
      setMessage("");
      setShowRoundOver(false);
    });

    socket.on(
      "move-made",
      ({ state, steps }: { state: GameState; steps: AnimationStep[] }) => {
        // Clear any in-flight animation timers before starting new ones
        clearAnimTimers();

        let delay = 0;
        const stepTime = 80;
        steps.forEach((step) => {
          const t = setTimeout(() => {
            if (step.type === "drop") setAnimatingPit(step.pit ?? null);
            if (step.type === "capture") {
              setMessage("Capture!");
              const mt = setTimeout(() => setMessage(""), 1500);
              animTimers.current.push(mt);
            }
            if (step.type === "extra_turn") {
              setMessage("Extra turn!");
              const mt = setTimeout(() => setMessage(""), 1500);
              animTimers.current.push(mt);
            }
          }, delay);
          animTimers.current.push(t);
          delay += stepTime;
        });

        const finalTimer = setTimeout(() => {
          setGameState(state);
          setAnimatingPit(null);
          if (state.roundOver) {
            setShowRoundOver(true);
          }
        }, delay);
        animTimers.current.push(finalTimer);
      },
    );

    socket.on("opponent-disconnected", () => {
      setMessage("Opponent disconnected");
      setError("Your opponent has left the game.");
    });

    socket.on("error", ({ message: msg }: { message: string }) => {
      setError(msg);
    });

    return () => {
      clearAnimTimers();
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback(() => {
    socketRef.current?.emit("create-room");
  }, []);

  const joinRoom = useCallback(() => {
    if (inputCode.trim().length === 0) {
      setError("Please enter a room code");
      return;
    }
    setError("");
    socketRef.current?.emit("join-room", {
      roomCode: inputCode.trim().toUpperCase(),
    });
  }, [inputCode]);

  const handleMove = useCallback(
    (pitIndex: number): void => {
      if (gameState.gameOver || gameState.roundOver) return;
      if (gameState.currentPlayer !== playerNumber) return;

      const validMoves = getValidMoves(gameState);
      if (!validMoves.includes(pitIndex)) return;

      socketRef.current?.emit("make-move", {
        roomCode,
        pitIndex,
      });
    },
    [gameState, playerNumber, roomCode],
  );

  const handleNextRound = useCallback(() => {
    socketRef.current?.emit("next-round", { roomCode });
  }, [roomCode]);

  const handlePlayAgain = useCallback(() => {
    socketRef.current?.emit("play-again", { roomCode });
  }, [roomCode]);

  const p1Score = getScore(gameState, PLAYER_1);
  const p2Score = getScore(gameState, PLAYER_2);
  const validMoves: number[] =
    gameState.currentPlayer === playerNumber && !gameState.roundOver
      ? getValidMoves(gameState)
      : [];

  if (screen === "lobby") {
    return (
      <div className="lobby-screen">
        <h2 className="lobby-title">Online Play</h2>
        <div className="lobby-actions">
          <button className="menu-btn" onClick={createRoom}>
            Create Room
          </button>
          <div style={{ textAlign: "center", opacity: 0.5, letterSpacing: 3 }}>
            OR
          </div>
          <input
            className="lobby-input"
            placeholder="Room Code"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            maxLength={6}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          />
          <button className="menu-btn" onClick={joinRoom}>
            Join Room
          </button>
        </div>
        {error && <p className="lobby-error">{error}</p>}
        <button className="menu-btn back-btn" onClick={onMainMenu}>
          Back
        </button>
      </div>
    );
  }

  if (screen === "waiting") {
    return (
      <div className="lobby-screen">
        <h2 className="lobby-title">Waiting for Opponent</h2>
        <p className="lobby-info">Share this room code:</p>
        <div className="room-code">{roomCode}</div>
        <p className="lobby-status">Waiting for another player to join...</p>
        <button className="menu-btn back-btn" onClick={onMainMenu}>
          Cancel
        </button>
      </div>
    );
  }

  // Playing
  const round = gameState.round;

  const getPlayerLabel = (player: Player): string => {
    if (player === playerNumber) return "You";
    return "Opponent";
  };

  const getTurnText = (): string => {
    if (gameState.gameOver || gameState.matchOver) return "";
    if (gameState.roundOver) return "";
    if (gameState.currentPlayer === playerNumber) return "Your Turn";
    return "Opponent's Turn";
  };

  return (
    <div className="game-screen">
      <div className="game-header">
        <div className="player-info">
          <span
            className={`player-name${
              gameState.currentPlayer === PLAYER_2 ? " active" : ""
            }`}
          >
            {getPlayerLabel(PLAYER_2)}
          </span>
          <span className="player-score">{p2Score}</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="round-indicator">Round {round}</div>
          <div className="turn-indicator">{getTurnText()}</div>
          {message && <div className="game-status">{message}</div>}
          {error && (
            <p className="lobby-error" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>

        <div className="player-info">
          <span
            className={`player-name${
              gameState.currentPlayer === PLAYER_1 ? " active" : ""
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
        validMoves={validMoves}
        animatingPit={animatingPit}
      />

      <div className="game-controls">
        <button className="control-btn" onClick={onMainMenu}>
          Leave Game
        </button>
      </div>

      {/* Round Over Modal */}
      {showRoundOver && !gameState.gameOver && !gameState.matchOver && (
        <GameOverModal
          gameState={gameState}
          p1Score={p1Score}
          p2Score={p2Score}
          onPlayAgain={handleNextRound}
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
          onPlayAgain={handlePlayAgain}
          onMainMenu={onMainMenu}
          isRoundOver={false}
          round={round}
        />
      )}
    </div>
  );
}
