/**
 * Sungka Game Engine
 *
 * Board layout (indices):
 *
 *   pits[0]  = Player 1's store (head/ulo)
 *   pits[1]  - pits[7]  = Player 1's 7 houses
 *   pits[8]  = Player 2's store (head/ulo)
 *   pits[9]  - pits[15] = Player 2's 7 houses
 *
 * Distribution goes: counter-clockwise
 *   Player 1 picks from pits[1-7], distributes: next pit indices going up,
 *   wrapping around, skipping opponent's store.
 *
 * Multi-round (Sunog) rules:
 *   - After a round ends, each player redistributes shells from their store
 *     back into their pits, placing 7 shells per pit (leftmost first).
 *   - Pits that can't be filled (not enough shells) become "burnt" (sunog)
 *     and are removed from play in subsequent rounds.
 *   - Leftover shells (< 7) go back into the player's store.
 *   - The loser of the previous round starts the next round.
 *   - During play, burnt holes are skipped during sowing.
 *   - The match ends when a player cannot fill even a single pit (< 7 shells total).
 */

// --- Type Definitions ---

export type Player = typeof PLAYER_1 | typeof PLAYER_2;

export interface GameState {
  pits: number[];
  currentPlayer: Player;
  isFirstMove: boolean;
  gameOver: boolean;
  roundOver: boolean;
  winner: Player | null;
  lastMove: number | null;
  moveHistory: number[];
  round: number;
  burntPits: number[];
  roundWinner: Player | null;
  matchOver: boolean;
}

type StepType = "pickup" | "drop" | "capture" | "extra_turn" | "round_over";

export interface AnimationStep {
  type: StepType;
  pit?: number;
  pits: number[];
  shells?: number;
  shellsRemaining?: number;
  player?: Player;
  oppositePit?: number;
  captured?: number;
  roundWinner?: Player | null;
}

export interface MoveResult {
  state: GameState;
  steps: AnimationStep[];
}

export interface SimultaneousMoveResult {
  state: GameState;
  steps: AnimationStep[];
  p1Steps: AnimationStep[];
  p2Steps: AnimationStep[];
}

interface SowResult {
  pits: number[];
  steps: AnimationStep[];
  landedInStore: boolean;
}

// --- Constants ---

export const PLAYER_1 = 1 as const;
export const PLAYER_2 = 2 as const;

export const P1_STORE = 0;
export const P1_PITS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
export const P2_STORE = 8;
export const P2_PITS: readonly number[] = [9, 10, 11, 12, 13, 14, 15];

const INITIAL_SHELLS = 7;
const TOTAL_PITS = 16;

// --- Private Helpers ---

/**
 * Get the distribution order for a player, skipping burnt pits.
 */
function getDistributionOrder(
  player: Player,
  burntPits: number[] = [],
): number[] {
  let order: number[];
  if (player === PLAYER_1) {
    order = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 0];
  } else {
    order = [9, 10, 11, 12, 13, 14, 15, 1, 2, 3, 4, 5, 6, 7, 8];
  }
  if (burntPits.length > 0) {
    order = order.filter((i) => !burntPits.includes(i));
  }
  return order;
}

/**
 * Get the opposite pit index.
 */
function getOppositePit(pitIndex: number): number {
  return 16 - pitIndex;
}

/**
 * Check if a pit belongs to a player (and is not a store).
 */
function isPlayerPit(player: Player, pitIndex: number): boolean {
  if (player === PLAYER_1) return pitIndex >= 1 && pitIndex <= 7;
  return pitIndex >= 9 && pitIndex <= 15;
}

/**
 * Get the player's store index.
 */
function getPlayerStore(player: Player): number {
  return player === PLAYER_1 ? P1_STORE : P2_STORE;
}

// --- Public API ---

/**
 * Create initial game state.
 */
export function createInitialState(): GameState {
  const pits = new Array<number>(TOTAL_PITS).fill(0);

  P1_PITS.forEach((i) => (pits[i] = INITIAL_SHELLS));
  P2_PITS.forEach((i) => (pits[i] = INITIAL_SHELLS));

  return {
    pits,
    currentPlayer: PLAYER_1,
    isFirstMove: true,
    gameOver: false,
    roundOver: false,
    winner: null,
    lastMove: null,
    moveHistory: [],
    round: 1,
    burntPits: [],
    roundWinner: null,
    matchOver: false,
  };
}

/**
 * Deep clone game state.
 */
export function cloneState(state: GameState): GameState {
  return {
    pits: [...state.pits],
    currentPlayer: state.currentPlayer,
    isFirstMove: state.isFirstMove,
    gameOver: state.gameOver,
    roundOver: state.roundOver,
    winner: state.winner,
    lastMove: state.lastMove,
    moveHistory: [...state.moveHistory],
    round: state.round,
    burntPits: [...state.burntPits],
    roundWinner: state.roundWinner,
    matchOver: state.matchOver,
  };
}

/**
 * Get valid moves for the current player.
 */
export function getValidMoves(state: GameState): number[] {
  if (state.gameOver || state.roundOver) return [];
  if (state.isFirstMove) return [];
  const playerPits = state.currentPlayer === PLAYER_1 ? P1_PITS : P2_PITS;
  return playerPits.filter(
    (i) => state.pits[i]! > 0 && !state.burntPits.includes(i),
  );
}

/**
 * Get valid moves for a specific player (used during simultaneous first move).
 */
export function getValidMovesForPlayer(
  state: GameState,
  player: Player,
): number[] {
  if (state.gameOver || state.roundOver) return [];
  const playerPits = player === PLAYER_1 ? P1_PITS : P2_PITS;
  return playerPits.filter(
    (i) => state.pits[i]! > 0 && !state.burntPits.includes(i),
  );
}

/**
 * Execute a single player's sow from a pit index.
 * Core sowing logic used by both normal moves and simultaneous first moves.
 */
function executeSow(
  pits: number[],
  player: Player,
  pitIndex: number,
  burntPits: number[] = [],
): SowResult {
  const newPits = [...pits];
  const playerStore = getPlayerStore(player);
  const distributionOrder = getDistributionOrder(player, burntPits);
  const steps: AnimationStep[] = [];

  let currentPit = pitIndex;
  let shells = newPits[currentPit]!;
  newPits[currentPit] = 0;

  steps.push({
    type: "pickup",
    pit: currentPit,
    pits: [...newPits],
    shells,
    player,
  });

  let orderIndex = distributionOrder.indexOf(currentPit);
  let continueDistributing = true;
  let landedInStore = false;

  while (continueDistributing) {
    while (shells > 0) {
      orderIndex = (orderIndex + 1) % distributionOrder.length;
      currentPit = distributionOrder[orderIndex]!;
      newPits[currentPit] = (newPits[currentPit] ?? 0) + 1;
      shells--;

      steps.push({
        type: "drop",
        pit: currentPit,
        pits: [...newPits],
        shellsRemaining: shells,
        player,
      });
    }

    const lastPit = currentPit;

    if (lastPit === playerStore) {
      landedInStore = true;
      steps.push({ type: "extra_turn", pits: [...newPits], player });
      continueDistributing = false;
    } else if (
      newPits[lastPit]! > 1 &&
      lastPit !== P1_STORE &&
      lastPit !== P2_STORE
    ) {
      shells = newPits[lastPit]!;
      newPits[lastPit] = 0;
      orderIndex = distributionOrder.indexOf(lastPit);
      steps.push({
        type: "pickup",
        pit: lastPit,
        pits: [...newPits],
        shells,
        player,
      });
    } else if (newPits[lastPit] === 1 && isPlayerPit(player, lastPit)) {
      const oppositePit = getOppositePit(lastPit);
      if (newPits[oppositePit]! > 0 && !burntPits.includes(oppositePit)) {
        const captured = newPits[oppositePit]! + newPits[lastPit]!;
        newPits[playerStore] = (newPits[playerStore] ?? 0) + captured;
        newPits[oppositePit] = 0;
        newPits[lastPit] = 0;
        steps.push({
          type: "capture",
          pit: lastPit,
          oppositePit,
          captured,
          pits: [...newPits],
          player,
        });
      }
      continueDistributing = false;
    } else {
      continueDistributing = false;
    }
  }

  return { pits: newPits, steps, landedInStore };
}

/**
 * Execute the simultaneous first move.
 * Both players pick a pit; both sow at the same time.
 * The player who finishes first goes first in alternating play.
 */
export function makeSimultaneousFirstMove(
  state: GameState,
  p1PitIndex: number,
  p2PitIndex: number,
): SimultaneousMoveResult | null {
  const { burntPits } = state;

  if (
    !P1_PITS.includes(p1PitIndex) ||
    state.pits[p1PitIndex] === 0 ||
    burntPits.includes(p1PitIndex)
  )
    return null;
  if (
    !P2_PITS.includes(p2PitIndex) ||
    state.pits[p2PitIndex] === 0 ||
    burntPits.includes(p2PitIndex)
  )
    return null;

  const p1Result = executeSow([...state.pits], PLAYER_1, p1PitIndex, burntPits);
  const p2Result = executeSow(p1Result.pits, PLAYER_2, p2PitIndex, burntPits);

  const newState = cloneState(state);
  newState.pits = p2Result.pits;
  newState.isFirstMove = false;

  if (p1Result.steps.length <= p2Result.steps.length) {
    newState.currentPlayer = PLAYER_1;
  } else {
    newState.currentPlayer = PLAYER_2;
  }

  if (checkSideEmpty(newState)) {
    collectRemaining(newState);
    newState.roundOver = true;
    newState.roundWinner = determineWinner(newState);
  }

  newState.moveHistory = [p1PitIndex, p2PitIndex];

  const allSteps: AnimationStep[] = [];
  const maxLen = Math.max(p1Result.steps.length, p2Result.steps.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < p1Result.steps.length) allSteps.push(p1Result.steps[i]!);
    if (i < p2Result.steps.length) allSteps.push(p2Result.steps[i]!);
  }

  return {
    state: newState,
    steps: allSteps,
    p1Steps: p1Result.steps,
    p2Steps: p2Result.steps,
  };
}

/**
 * Execute a move and return the new state + animation steps.
 */
export function makeMove(
  state: GameState,
  pitIndex: number,
): MoveResult | null {
  const player = state.currentPlayer;
  const playerPits = player === PLAYER_1 ? P1_PITS : P2_PITS;
  const { burntPits } = state;

  if (
    !playerPits.includes(pitIndex) ||
    state.pits[pitIndex] === 0 ||
    burntPits.includes(pitIndex)
  ) {
    return null;
  }

  // Delegate sowing to executeSow
  const sowResult = executeSow([...state.pits], player, pitIndex, burntPits);

  const newState = cloneState(state);
  newState.isFirstMove = false;
  newState.pits = sowResult.pits;

  const steps: AnimationStep[] = [...sowResult.steps];

  if (sowResult.landedInStore) {
    // Player gets an extra turn — don't switch player
    if (checkSideEmpty(newState)) {
      collectRemaining(newState);
      newState.roundOver = true;
      newState.roundWinner = determineWinner(newState);
      steps.push({
        type: "round_over",
        pits: [...newState.pits],
        roundWinner: newState.roundWinner,
      });
    }
    // Extra turn step is already added by executeSow
  } else {
    // Switch to the other player
    newState.currentPlayer = player === PLAYER_1 ? PLAYER_2 : PLAYER_1;
  }

  if (!newState.roundOver) {
    const nextMoves = getValidMoves(newState);
    if (nextMoves.length === 0) {
      collectRemaining(newState);
      newState.roundOver = true;
      newState.roundWinner = determineWinner(newState);
      steps.push({
        type: "round_over",
        pits: [...newState.pits],
        roundWinner: newState.roundWinner,
      });
    }
  }

  newState.lastMove = pitIndex;
  newState.moveHistory = [...newState.moveHistory, pitIndex];

  return { state: newState, steps };
}

/**
 * Check if either side is completely empty (considering only non-burnt pits).
 */
function checkSideEmpty(state: GameState): boolean {
  const p1Empty = P1_PITS.every(
    (i) => state.burntPits.includes(i) || state.pits[i] === 0,
  );
  const p2Empty = P2_PITS.every(
    (i) => state.burntPits.includes(i) || state.pits[i] === 0,
  );
  return p1Empty || p2Empty;
}

/**
 * Collect remaining shells into respective stores.
 */
function collectRemaining(state: GameState): void {
  P1_PITS.forEach((i) => {
    state.pits[P1_STORE] = (state.pits[P1_STORE] ?? 0) + (state.pits[i] ?? 0);
    state.pits[i] = 0;
  });
  P2_PITS.forEach((i) => {
    state.pits[P2_STORE] = (state.pits[P2_STORE] ?? 0) + (state.pits[i] ?? 0);
    state.pits[i] = 0;
  });
}

/**
 * Determine winner based on store scores.
 */
function determineWinner(state: GameState): Player | null {
  if (state.pits[P1_STORE]! > state.pits[P2_STORE]!) return PLAYER_1;
  if (state.pits[P2_STORE]! > state.pits[P1_STORE]!) return PLAYER_2;
  return null;
}

/**
 * Calculate the next round state after a round ends (sunog logic).
 * Returns the new game state. If the match is over, gameOver/matchOver will be true.
 */
export function calculateNextRound(state: GameState): GameState {
  const newState = cloneState(state);
  const p1Total = newState.pits[P1_STORE]!;
  const p2Total = newState.pits[P2_STORE]!;

  if (p1Total < INITIAL_SHELLS && p2Total < INITIAL_SHELLS) {
    newState.gameOver = true;
    newState.matchOver = true;
    newState.winner =
      p1Total > p2Total ? PLAYER_1 : p2Total > p1Total ? PLAYER_2 : null;
    return newState;
  }
  if (p1Total < INITIAL_SHELLS) {
    newState.gameOver = true;
    newState.matchOver = true;
    newState.winner = PLAYER_2;
    return newState;
  }
  if (p2Total < INITIAL_SHELLS) {
    newState.gameOver = true;
    newState.matchOver = true;
    newState.winner = PLAYER_1;
    return newState;
  }

  const pits = new Array<number>(TOTAL_PITS).fill(0);
  const newBurntPits = [...newState.burntPits];

  let p1Remaining = p1Total;
  for (const pitIndex of P1_PITS) {
    if (newBurntPits.includes(pitIndex)) continue;
    if (p1Remaining >= INITIAL_SHELLS) {
      pits[pitIndex] = INITIAL_SHELLS;
      p1Remaining -= INITIAL_SHELLS;
    } else {
      newBurntPits.push(pitIndex);
      pits[pitIndex] = 0;
    }
  }
  pits[P1_STORE] = p1Remaining;

  let p2Remaining = p2Total;
  for (const pitIndex of P2_PITS) {
    if (newBurntPits.includes(pitIndex)) continue;
    if (p2Remaining >= INITIAL_SHELLS) {
      pits[pitIndex] = INITIAL_SHELLS;
      p2Remaining -= INITIAL_SHELLS;
    } else {
      newBurntPits.push(pitIndex);
      pits[pitIndex] = 0;
    }
  }
  pits[P2_STORE] = p2Remaining;

  const roundLoser: Player =
    newState.roundWinner === PLAYER_1
      ? PLAYER_2
      : newState.roundWinner === PLAYER_2
        ? PLAYER_1
        : PLAYER_1;

  newState.pits = pits;
  newState.burntPits = newBurntPits;
  newState.round = newState.round + 1;
  newState.currentPlayer = roundLoser;
  newState.isFirstMove = true;
  newState.roundOver = false;
  newState.gameOver = false;
  newState.matchOver = false;
  newState.winner = null;
  newState.roundWinner = null;
  newState.lastMove = null;
  newState.moveHistory = [];

  return newState;
}

/**
 * Get score for a player.
 */
export function getScore(state: GameState, player: Player): number {
  return state.pits[getPlayerStore(player)] ?? 0;
}
