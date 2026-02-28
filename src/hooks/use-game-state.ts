import { useState, useCallback, useRef, useEffect } from "react";
import {
  createInitialState,
  makeMove,
  makeSimultaneousFirstMove,
  calculateNextRound,
  getValidMoves,
  getValidMovesForPlayer,
  getScore,
  PLAYER_1,
  PLAYER_2,
} from "../game/sungka-engine";
import type { GameState, AnimationStep } from "../game/sungka-engine";
import { getAIMoveAsync, terminateAIWorker } from "../game/ai-worker-client";
import type { Difficulty } from "../game/sungka-ai";

export type GameMode = "local" | "ai" | "online";

const STORAGE_KEY = "sungka-game-session";

interface SavedSession {
  gameState: GameState;
  firstMovePicks: FirstMovePicks;
  showRoundOver: boolean;
  mode: GameMode;
  difficulty: Difficulty;
}

function saveSession(
  gameState: GameState,
  firstMovePicks: FirstMovePicks,
  showRoundOver: boolean,
  mode: GameMode,
  difficulty: Difficulty,
): void {
  // Don't persist online games
  if (mode === "online") return;
  try {
    const session: SavedSession = {
      gameState,
      firstMovePicks,
      showRoundOver,
      mode,
      difficulty,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SavedSession;
    // Basic validation
    if (!session.gameState || !Array.isArray(session.gameState.pits))
      return null;
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

interface FirstMovePicks {
  p1: number | null;
  p2: number | null;
}

interface UseGameStateReturn {
  gameState: GameState;
  animating: boolean;
  animatingPit: number | null;
  message: string;
  handleMove: (pitIndex: number) => void;
  resetGame: () => void;
  nextRound: () => void;
  showRoundOver: boolean;
  firstMovePicks: FirstMovePicks;
  p1Score: number;
  p2Score: number;
  validMoves: number[];
}

export function useGameState(
  mode: GameMode = "local",
  difficulty: Difficulty = "medium",
  restoredSession?: SavedSession | null,
): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState>(
    restoredSession ? restoredSession.gameState : createInitialState(),
  );
  const [displayPits, setDisplayPits] = useState<number[] | null>(null);
  const [animating, setAnimating] = useState(false);
  const [animatingPit, setAnimatingPit] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  // For simultaneous first move: store each player's chosen pit
  const [firstMovePicks, setFirstMovePicks] = useState<FirstMovePicks>(
    restoredSession ? restoredSession.firstMovePicks : { p1: null, p2: null },
  );
  // Round transition state
  const [showRoundOver, setShowRoundOver] = useState(
    restoredSession ? restoredSession.showRoundOver : false,
  );
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Persist state on every meaningful change
  useEffect(() => {
    if (!animating) {
      saveSession(gameState, firstMovePicks, showRoundOver, mode, difficulty);
    }
  }, [gameState, firstMovePicks, showRoundOver, animating, mode, difficulty]);

  const clearTimers = (): void => {
    animTimers.current.forEach((t) => clearTimeout(t));
    animTimers.current = [];
  };

  // Clean up all timers and worker on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      terminateAIWorker();
    };
  }, []);

  const resetGame = useCallback((): void => {
    clearTimers();
    setGameState(createInitialState());
    setDisplayPits(null);
    setAnimating(false);
    setAnimatingPit(null);
    setMessage("");
    setFirstMovePicks({ p1: null, p2: null });
    setShowRoundOver(false);
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
    }
    clearSession();
  }, []);

  const animateSteps = useCallback(
    (steps: AnimationStep[], finalState: GameState, stepTime: number): void => {
      setAnimating(true);
      clearTimers();

      let delay = 0;

      steps.forEach((step) => {
        const t = setTimeout(() => {
          setDisplayPits([...step.pits]);

          if (step.type === "drop") {
            setAnimatingPit(step.pit ?? null);
          } else if (step.type === "pickup") {
            setAnimatingPit(step.pit ?? null);
          } else if (step.type === "capture") {
            setAnimatingPit(step.pit ?? null);
            setMessage("Capture!");
            const mt = setTimeout(() => setMessage(""), 1500);
            animTimers.current.push(mt);
          } else if (step.type === "extra_turn") {
            setMessage("Extra turn!");
            const mt = setTimeout(() => setMessage(""), 1500);
            animTimers.current.push(mt);
          } else if (step.type === "round_over") {
            // Round ended — will be handled after animation completes
          }
        }, delay);
        animTimers.current.push(t);

        delay += stepTime;
      });

      const finalTimer = setTimeout(() => {
        setGameState(finalState);
        setDisplayPits(null);
        setAnimating(false);
        setAnimatingPit(null);

        // If the round is over, show the round-over modal
        if (finalState.roundOver) {
          setShowRoundOver(true);
        }
      }, delay + 100);
      animTimers.current.push(finalTimer);
    },
    [],
  );

  /**
   * Advance to the next round after round-over modal is acknowledged.
   */
  const nextRound = useCallback((): void => {
    const nextState = calculateNextRound(gameState);

    setShowRoundOver(false);
    setFirstMovePicks({ p1: null, p2: null });
    setMessage("");
    setGameState(nextState);
  }, [gameState]);

  const executeSimultaneousMove = useCallback(
    (p1Pit: number, p2Pit: number): void => {
      const result = makeSimultaneousFirstMove(gameState, p1Pit, p2Pit);
      if (!result) return;
      animateSteps(result.steps, result.state, 80);
    },
    [gameState, animateSteps],
  );

  const handleMove = useCallback(
    (pitIndex: number): void => {
      if (animating) return;
      if (gameState.gameOver || gameState.roundOver) return;

      // ---- Simultaneous first move phase ----
      if (gameState.isFirstMove) {
        const isP1Pit = pitIndex >= 1 && pitIndex <= 7;
        const isP2Pit = pitIndex >= 9 && pitIndex <= 15;
        const burntPits = gameState.burntPits;

        // Don't allow picking a burnt pit
        if (burntPits.includes(pitIndex)) return;

        if (mode === "local") {
          // Local: P1 picks first, then P2 picks, then both execute
          if (firstMovePicks.p1 === null && isP1Pit) {
            const newPicks: FirstMovePicks = {
              ...firstMovePicks,
              p1: pitIndex,
            };
            setFirstMovePicks(newPicks);
            setMessage("Player 2: choose your pit");
            return;
          }
          if (
            firstMovePicks.p1 !== null &&
            firstMovePicks.p2 === null &&
            isP2Pit
          ) {
            setMessage("");
            setFirstMovePicks({ p1: null, p2: null });
            executeSimultaneousMove(firstMovePicks.p1, pitIndex);
            return;
          }
          return;
        }

        if (mode === "ai") {
          // AI: P1 picks, AI picks randomly, then both execute
          if (isP1Pit) {
            const p2Moves = getValidMovesForPlayer(gameState, PLAYER_2);
            const aiPick = p2Moves[Math.floor(Math.random() * p2Moves.length)];
            if (aiPick === undefined) return;
            setFirstMovePicks({ p1: null, p2: null });
            executeSimultaneousMove(pitIndex, aiPick);
            return;
          }
          return;
        }

        return;
      }

      // ---- Normal turn phase ----
      const validMoves = getValidMoves(gameState);
      if (!validMoves.includes(pitIndex)) return;

      if (mode === "ai" && gameState.currentPlayer !== PLAYER_1) return;

      const result = makeMove(gameState, pitIndex);
      if (!result) return;

      animateSteps(result.steps, result.state, 100);
    },
    [
      gameState,
      animating,
      mode,
      firstMovePicks,
      animateSteps,
      executeSimultaneousMove,
    ],
  );

  // AI turn (normal phase only, not first move) — runs in Web Worker
  useEffect(() => {
    if (
      mode === "ai" &&
      !gameState.isFirstMove &&
      !gameState.gameOver &&
      !gameState.roundOver &&
      gameState.currentPlayer === PLAYER_2 &&
      !animating
    ) {
      let cancelled = false;

      aiTimeoutRef.current = setTimeout(() => {
        getAIMoveAsync(gameState, difficulty).then((aiMove) => {
          if (cancelled) return;
          if (aiMove !== null) {
            const result = makeMove(gameState, aiMove);
            if (result) {
              animateSteps(result.steps, result.state, 140);
            }
          }
        });
      }, 600);

      return () => {
        cancelled = true;
        if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      };
    }

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [gameState, animating, mode, difficulty, animateSteps]);

  // Build exposed state
  const exposedState: GameState = displayPits
    ? { ...gameState, pits: displayPits }
    : gameState;

  // Valid moves depend on phase
  let computedValidMoves: number[] = [];
  if (!animating && !gameState.gameOver && !gameState.roundOver) {
    if (gameState.isFirstMove) {
      if (mode === "local") {
        if (firstMovePicks.p1 === null) {
          // P1 picks
          computedValidMoves = getValidMovesForPlayer(gameState, PLAYER_1);
        } else {
          // P2 picks
          computedValidMoves = getValidMovesForPlayer(gameState, PLAYER_2);
        }
      } else if (mode === "ai") {
        // Only P1 picks
        computedValidMoves = getValidMovesForPlayer(gameState, PLAYER_1);
      }
    } else {
      computedValidMoves = getValidMoves(gameState);
    }
  }

  return {
    gameState: exposedState,
    animating,
    animatingPit,
    message,
    handleMove,
    resetGame,
    nextRound,
    showRoundOver,
    firstMovePicks,
    p1Score: displayPits
      ? (displayPits[0] ?? 0)
      : getScore(gameState, PLAYER_1),
    p2Score: displayPits
      ? (displayPits[8] ?? 0)
      : getScore(gameState, PLAYER_2),
    validMoves: computedValidMoves,
  };
}
