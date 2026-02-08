/**
 * Sungka AI Engine (v2)
 *
 * Upgraded AI with three major improvements:
 * 1. Zobrist Hashing + Transposition Table — avoid re-evaluating identical positions
 * 2. Move Ordering — search best moves first for more alpha-beta cutoffs
 * 3. Iterative Deepening — progressively deeper search within a time budget
 *
 * Difficulty levels use time budgets instead of fixed depths:
 *   Easy:   ~200ms (with 60% random move chance)
 *   Medium: ~800ms
 *   Hard:   ~2000ms
 */

import {
  PLAYER_1,
  PLAYER_2,
  P1_PITS,
  P2_PITS,
  getValidMoves,
  makeMove,
  getScore,
} from "./sungka-engine";
import type { Player, GameState } from "./sungka-engine";

export type Difficulty = "easy" | "medium" | "hard";

// --- Zobrist Hashing ---

// We use 32-bit numbers instead of BigInt for performance.
// Two 32-bit hashes (high/low) give us 64-bit collision resistance.
// Max shells in any pit is 98 (all shells in one pit), but practically
// we cap at 50 for the hash table — positions with more just won't get
// cached (extremely rare edge case).

const MAX_SHELLS_HASH = 50;
const TOTAL_PITS = 16;

// Pre-generated random values for Zobrist hashing.
// zobristPit[pitIndex][shellCount] = [high32, low32]
const zobristPit: [number, number][][] = [];
// zobristPlayer[playerIndex] = [high32, low32] (index 0 = PLAYER_1, index 1 = PLAYER_2)
const zobristPlayer: [number, number][] = [];

/**
 * Simple seeded PRNG (mulberry32) for deterministic hash values.
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// Initialize Zobrist tables with deterministic random values.
const rng = mulberry32(0xdeadbeef);
for (let pit = 0; pit < TOTAL_PITS; pit++) {
  zobristPit[pit] = [];
  for (let shells = 0; shells <= MAX_SHELLS_HASH; shells++) {
    zobristPit[pit]![shells] = [rng(), rng()];
  }
}
zobristPlayer[0] = [rng(), rng()];
zobristPlayer[1] = [rng(), rng()];

/**
 * Compute Zobrist hash for a game state.
 * Returns [high32, low32] tuple.
 */
function computeHash(state: GameState): [number, number] {
  let h = 0;
  let l = 0;

  for (let pit = 0; pit < TOTAL_PITS; pit++) {
    const shells = Math.min(state.pits[pit] ?? 0, MAX_SHELLS_HASH);
    const entry = zobristPit[pit]?.[shells];
    if (entry) {
      h ^= entry[0];
      l ^= entry[1];
    }
  }

  const playerEntry = zobristPlayer[state.currentPlayer === PLAYER_1 ? 0 : 1];
  if (playerEntry) {
    h ^= playerEntry[0];
    l ^= playerEntry[1];
  }

  return [h, l];
}

/**
 * Combine two 32-bit values into a single 64-bit BigInt key for the Map.
 * We only use BigInt for the Map key, not during computation.
 */
function hashKey(h: number, l: number): bigint {
  return (BigInt(h >>> 0) << 32n) | BigInt(l >>> 0);
}

// --- Transposition Table ---

const enum TTFlag {
  EXACT = 0,
  LOWERBOUND = 1,
  UPPERBOUND = 2,
}

interface TTEntry {
  score: number;
  depth: number;
  flag: TTFlag;
  bestMove: number | null;
}

// Transposition table — cleared between AI calls to prevent unbounded growth.
let transpositionTable: Map<bigint, TTEntry>;

// --- Evaluation ---

/**
 * Evaluate the board state from the AI's perspective.
 * Higher score = better for the AI player.
 */
function evaluate(state: GameState, aiPlayer: Player): number {
  const opponent: Player = aiPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
  const aiScore = getScore(state, aiPlayer);
  const oppScore = getScore(state, opponent);

  const aiPits = aiPlayer === PLAYER_1 ? P1_PITS : P2_PITS;
  const oppPits = aiPlayer === PLAYER_1 ? P2_PITS : P1_PITS;
  const burntPits = state.burntPits;

  let aiSide = 0;
  let oppSide = 0;
  let aiActivePits = 0;
  let oppActivePits = 0;

  for (const i of aiPits) {
    if (!burntPits.includes(i)) {
      aiSide += state.pits[i] ?? 0;
      aiActivePits++;
    }
  }

  for (const i of oppPits) {
    if (!burntPits.includes(i)) {
      oppSide += state.pits[i] ?? 0;
      oppActivePits++;
    }
  }

  // Weighted evaluation:
  // Store score difference is most important (x3)
  // Side shells matter (x1)
  // Active pit advantage provides a small bonus (x0.5)
  return (
    (aiScore - oppScore) * 3 +
    (aiSide - oppSide) +
    (aiActivePits - oppActivePits) * 0.5
  );
}

// --- Move Ordering ---

/**
 * Score a move for ordering purposes. Higher = search first.
 * - Moves that land in own store (extra turn): +1000
 * - Moves that result in a capture: +500
 * - Otherwise: shell count (bigger moves tend to be more impactful)
 */
function scoreMoveForOrdering(
  state: GameState,
  move: number,
  ttBestMove: number | null,
): number {
  // Transposition table best move gets highest priority
  if (move === ttBestMove) return 10000;

  const player = state.currentPlayer;
  const shells = state.pits[move] ?? 0;

  if (shells === 0) return -1;

  // Quick check: will this move land in our store?
  // The distribution skips opponent's store and burnt pits, so we need
  // to count the effective distance. For a rough heuristic, we use a
  // simplified calculation.
  const playerPits = player === PLAYER_1 ? P1_PITS : P2_PITS;
  const pitIdx = playerPits.indexOf(move);
  if (pitIdx === -1) return shells;

  // Distance from this pit to the player's store in the distribution order,
  // accounting for burnt pits in between on the player's side.
  let distToStore = 0;
  for (let i = pitIdx + 1; i < playerPits.length; i++) {
    const p = playerPits[i];
    if (p !== undefined && !state.burntPits.includes(p)) {
      distToStore++;
    }
  }
  distToStore++; // +1 for the store itself

  // Exact landing in store
  if (shells === distToStore) return 1000 + shells;

  // Check for capture: land on empty own pit with opposite having shells.
  // This is approximate — only checks single-lap scenario.
  if (shells < distToStore) {
    // Will land on own side somewhere
    let stepsLeft = shells;
    let targetIdx = pitIdx;
    for (let i = pitIdx + 1; i < playerPits.length && stepsLeft > 0; i++) {
      const p = playerPits[i];
      if (p !== undefined && !state.burntPits.includes(p)) {
        targetIdx = i;
        stepsLeft--;
      }
    }
    if (stepsLeft === 0) {
      const targetPit = playerPits[targetIdx];
      if (targetPit !== undefined && (state.pits[targetPit] ?? 0) === 0) {
        const oppositePit = 16 - targetPit;
        if (
          (state.pits[oppositePit] ?? 0) > 0 &&
          !state.burntPits.includes(oppositePit)
        ) {
          return 500 + (state.pits[oppositePit] ?? 0);
        }
      }
    }
  }

  return shells;
}

/**
 * Get moves sorted by heuristic priority (best first).
 */
function getOrderedMoves(
  state: GameState,
  ttBestMove: number | null,
): number[] {
  const moves = getValidMoves(state);
  if (moves.length <= 1) return moves;

  const scored = moves.map((move) => ({
    move,
    score: scoreMoveForOrdering(state, move, ttBestMove),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.move);
}

// --- Search ---

// Time control — set before each search
let searchStartTime = 0;
let searchTimeBudget = 0;
let searchAborted = false;

/**
 * Check if we've exceeded the time budget.
 */
function isTimeUp(): boolean {
  if (searchAborted) return true;
  if (performance.now() - searchStartTime >= searchTimeBudget) {
    searchAborted = true;
    return true;
  }
  return false;
}

/**
 * Negamax with alpha-beta pruning and transposition table.
 * Uses negamax formulation (simpler than separate max/min).
 * The sign of the returned score is relative to the current player.
 */
function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  aiPlayer: Player,
): { score: number; move: number | null } {
  if (isTimeUp()) {
    return { score: 0, move: null };
  }

  const isTerminal = state.gameOver || state.roundOver;
  if (depth === 0 || isTerminal) {
    // Return score relative to current player
    const rawScore = evaluate(state, aiPlayer);
    const sign = state.currentPlayer === aiPlayer ? 1 : -1;
    return { score: rawScore * sign, move: null };
  }

  // Transposition table lookup
  const [hh, hl] = computeHash(state);
  const key = hashKey(hh, hl);
  const ttEntry = transpositionTable.get(key);
  let ttBestMove: number | null = null;

  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === TTFlag.EXACT) {
      return { score: ttEntry.score, move: ttEntry.bestMove };
    } else if (ttEntry.flag === TTFlag.LOWERBOUND) {
      alpha = Math.max(alpha, ttEntry.score);
    } else if (ttEntry.flag === TTFlag.UPPERBOUND) {
      beta = Math.min(beta, ttEntry.score);
    }
    if (alpha >= beta) {
      return { score: ttEntry.score, move: ttEntry.bestMove };
    }
    ttBestMove = ttEntry.bestMove;
  } else if (ttEntry) {
    ttBestMove = ttEntry.bestMove;
  }

  const moves = getOrderedMoves(state, ttBestMove);
  if (moves.length === 0) {
    const rawScore = evaluate(state, aiPlayer);
    const sign = state.currentPlayer === aiPlayer ? 1 : -1;
    return { score: rawScore * sign, move: null };
  }

  let bestScore = -Infinity;
  let bestMove: number | null = moves[0] ?? null;
  const origAlpha = alpha;

  for (const move of moves) {
    const result = makeMove(state, move);
    if (!result) continue;

    // If the same player gets another turn (extra turn), don't negate.
    // If the player changes, negate the score.
    const samePlayer = result.state.currentPlayer === state.currentPlayer;
    let childResult: { score: number; move: number | null };

    if (samePlayer) {
      // Same player's turn continues — don't flip perspective
      childResult = negamax(result.state, depth - 1, alpha, beta, aiPlayer);
    } else {
      // Opponent's turn — negate
      childResult = negamax(result.state, depth - 1, -beta, -alpha, aiPlayer);
      childResult = { score: -childResult.score, move: childResult.move };
    }

    if (isTimeUp()) {
      // Return best found so far even if aborted
      if (bestScore === -Infinity) {
        return { score: childResult.score, move };
      }
      return { score: bestScore, move: bestMove };
    }

    if (childResult.score > bestScore) {
      bestScore = childResult.score;
      bestMove = move;
    }

    alpha = Math.max(alpha, bestScore);
    if (alpha >= beta) break;
  }

  // Store in transposition table
  let flag: TTFlag;
  if (bestScore <= origAlpha) {
    flag = TTFlag.UPPERBOUND;
  } else if (bestScore >= beta) {
    flag = TTFlag.LOWERBOUND;
  } else {
    flag = TTFlag.EXACT;
  }

  // Cap table size to prevent memory issues (main thread)
  if (transpositionTable.size < 500_000) {
    transpositionTable.set(key, {
      score: bestScore,
      depth,
      flag,
      bestMove,
    });
  }

  return { score: bestScore, move: bestMove };
}

// --- Iterative Deepening ---

/**
 * Iterative deepening search within a time budget.
 * Searches depth 1, 2, 3, ... until time runs out.
 * Returns the best move found from the deepest completed iteration.
 */
function iterativeDeepening(
  state: GameState,
  timeBudgetMs: number,
  aiPlayer: Player,
  maxDepth: number = 30,
): number | null {
  searchStartTime = performance.now();
  searchTimeBudget = timeBudgetMs;
  searchAborted = false;
  transpositionTable = new Map();

  let bestMove: number | null = null;
  let bestScore = -Infinity;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const result = negamax(state, depth, -Infinity, Infinity, aiPlayer);

    if (searchAborted) {
      // Time ran out during this depth — use previous iteration's result
      // unless we haven't found anything yet.
      if (bestMove === null && result.move !== null) {
        bestMove = result.move;
      }
      break;
    }

    // Completed this depth — update best result
    if (result.move !== null) {
      bestMove = result.move;
      bestScore = result.score;
    }

    // If we found a winning position, no need to search deeper
    if (bestScore > 9000) break;

    // Check if we have enough time for the next iteration.
    // Heuristic: next depth takes ~3-5x longer. If we've used >40% of budget, stop.
    const elapsed = performance.now() - searchStartTime;
    if (elapsed > timeBudgetMs * 0.4) break;
  }

  return bestMove;
}

// --- Public API ---

/**
 * Get AI move based on difficulty.
 * Same public API as before — drop-in replacement.
 *
 * Time budgets:
 *   Easy:   200ms (with 60% random move chance)
 *   Medium: 800ms
 *   Hard:   2000ms
 */
export function getAIMove(
  state: GameState,
  difficulty: Difficulty = "medium",
): number | null {
  const aiPlayer = state.currentPlayer;
  const moves = getValidMoves(state);

  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0] ?? null;

  switch (difficulty) {
    case "easy": {
      // 60% pure random, 40% shallow search
      if (Math.random() < 0.6) {
        return moves[Math.floor(Math.random() * moves.length)] ?? null;
      }
      return iterativeDeepening(state, 200, aiPlayer, 4);
    }

    case "medium": {
      return iterativeDeepening(state, 800, aiPlayer);
    }

    case "hard": {
      return iterativeDeepening(state, 2000, aiPlayer);
    }

    default:
      return moves[Math.floor(Math.random() * moves.length)] ?? null;
  }
}
