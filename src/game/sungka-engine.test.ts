import { describe, it, expect } from "vitest";
import {
  createInitialState,
  cloneState,
  getScore,
  getValidMoves,
  getValidMovesForPlayer,
  makeMove,
  makeSimultaneousFirstMove,
  calculateNextRound,
  PLAYER_1,
  PLAYER_2,
  P1_STORE,
  P2_STORE,
  P1_PITS,
  P2_PITS,
  type GameState,
} from "./sungka-engine";

// Helper to create a custom game state for testing
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    pits: new Array(16).fill(0),
    currentPlayer: PLAYER_1,
    isFirstMove: false,
    gameOver: false,
    roundOver: false,
    winner: null,
    lastMove: null,
    moveHistory: [],
    round: 1,
    burntPits: [],
    roundWinner: null,
    matchOver: false,
    ...overrides,
  };
}

// ─── createInitialState ─────────────────────────────────────────────

describe("createInitialState", () => {
  it("creates a board with 7 shells in each house pit", () => {
    const state = createInitialState();
    for (const i of P1_PITS) expect(state.pits[i]).toBe(7);
    for (const i of P2_PITS) expect(state.pits[i]).toBe(7);
  });

  it("has empty stores", () => {
    const state = createInitialState();
    expect(state.pits[P1_STORE]).toBe(0);
    expect(state.pits[P2_STORE]).toBe(0);
  });

  it("has correct initial flags", () => {
    const state = createInitialState();
    expect(state.currentPlayer).toBe(PLAYER_1);
    expect(state.isFirstMove).toBe(true);
    expect(state.gameOver).toBe(false);
    expect(state.roundOver).toBe(false);
    expect(state.winner).toBeNull();
    expect(state.round).toBe(1);
    expect(state.burntPits).toEqual([]);
    expect(state.matchOver).toBe(false);
  });

  it("total shells = 98 (7 shells × 14 pits)", () => {
    const state = createInitialState();
    const total = state.pits.reduce((a, b) => a + b, 0);
    expect(total).toBe(98);
  });
});

// ─── cloneState ─────────────────────────────────────────────────────

describe("cloneState", () => {
  it("creates an independent copy", () => {
    const original = createInitialState();
    const clone = cloneState(original);

    clone.pits[1] = 999;
    clone.burntPits.push(5);
    clone.moveHistory.push(3);

    expect(original.pits[1]).toBe(7);
    expect(original.burntPits).toEqual([]);
    expect(original.moveHistory).toEqual([]);
  });

  it("preserves all fields", () => {
    const original = makeState({
      currentPlayer: PLAYER_2,
      round: 3,
      burntPits: [2, 10],
      moveHistory: [1, 9],
      roundWinner: PLAYER_1,
    });
    const clone = cloneState(original);
    expect(clone.currentPlayer).toBe(PLAYER_2);
    expect(clone.round).toBe(3);
    expect(clone.burntPits).toEqual([2, 10]);
    expect(clone.moveHistory).toEqual([1, 9]);
    expect(clone.roundWinner).toBe(PLAYER_1);
  });
});

// ─── getScore ───────────────────────────────────────────────────────

describe("getScore", () => {
  it("returns store values for each player", () => {
    const state = makeState({ pits: [10, 0, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0] });
    expect(getScore(state, PLAYER_1)).toBe(10);
    expect(getScore(state, PLAYER_2)).toBe(20);
  });

  it("returns 0 for empty stores", () => {
    const state = createInitialState();
    expect(getScore(state, PLAYER_1)).toBe(0);
    expect(getScore(state, PLAYER_2)).toBe(0);
  });
});

// ─── getValidMoves ──────────────────────────────────────────────────

describe("getValidMoves", () => {
  it("returns empty during first move phase", () => {
    const state = createInitialState(); // isFirstMove = true
    expect(getValidMoves(state)).toEqual([]);
  });

  it("returns non-empty pits for current player", () => {
    const state = makeState({
      pits: [0, 3, 0, 5, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      currentPlayer: PLAYER_1,
    });
    expect(getValidMoves(state)).toEqual([1, 3, 7]);
  });

  it("returns P2 pits when P2 is current player", () => {
    const state = makeState({
      pits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 6, 0, 0, 1],
      currentPlayer: PLAYER_2,
    });
    expect(getValidMoves(state)).toEqual([9, 12, 15]);
  });

  it("excludes burnt pits", () => {
    const state = makeState({
      pits: [0, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
      currentPlayer: PLAYER_1,
      burntPits: [2, 4],
    });
    expect(getValidMoves(state)).toEqual([1, 3, 5, 6, 7]);
  });

  it("returns empty when game is over", () => {
    const state = makeState({ gameOver: true });
    expect(getValidMoves(state)).toEqual([]);
  });

  it("returns empty when round is over", () => {
    const state = makeState({ roundOver: true });
    expect(getValidMoves(state)).toEqual([]);
  });
});

// ─── getValidMovesForPlayer ─────────────────────────────────────────

describe("getValidMovesForPlayer", () => {
  it("returns moves for a specific player regardless of currentPlayer", () => {
    const state = makeState({
      pits: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 2],
      currentPlayer: PLAYER_1,
    });
    expect(getValidMovesForPlayer(state, PLAYER_2)).toEqual([10, 15]);
  });

  it("excludes burnt pits", () => {
    const state = makeState({
      pits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3],
      burntPits: [9, 11],
    });
    expect(getValidMovesForPlayer(state, PLAYER_2)).toEqual([10, 12, 13, 14, 15]);
  });
});

// ─── makeMove ───────────────────────────────────────────────────────

describe("makeMove", () => {
  it("returns null for invalid pit (wrong player)", () => {
    const state = makeState({
      pits: [0, 7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7],
      currentPlayer: PLAYER_1,
    });
    expect(makeMove(state, 9)).toBeNull();
  });

  it("returns null for empty pit", () => {
    const state = makeState({
      pits: [0, 0, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7],
      currentPlayer: PLAYER_1,
    });
    expect(makeMove(state, 1)).toBeNull();
  });

  it("returns null for burnt pit", () => {
    const state = makeState({
      pits: [0, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
      currentPlayer: PLAYER_1,
      burntPits: [1],
    });
    expect(makeMove(state, 1)).toBeNull();
  });

  it("basic sow distributes shells counter-clockwise", () => {
    // P1 picks pit 1 (3 shells) → drops in 2, 3, 4
    const pits = [0, 3, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;

    expect(result).not.toBeNull();
    expect(result.state.pits[1]).toBe(0); // picked up
    expect(result.state.pits[2]).toBe(1);
    expect(result.state.pits[3]).toBe(1);
    expect(result.state.pits[4]).toBe(1);
  });

  it("switches player after a normal move", () => {
    const pits = [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;
    expect(result.state.currentPlayer).toBe(PLAYER_2);
  });

  it("grants extra turn when landing in own store (P1)", () => {
    // P1 pit 4 has 4 shells → lands: 5, 6, 7, store(0) → extra turn
    //                          indices: 4→5, 5→6, 6→7, 7→0(store)
    // Wait: distribution order for P1: 1,2,3,4,5,6,7,9,10,11,12,13,14,15,0
    // Starting from pit 4, the order index of 4 is 3.
    // Next indices: 5(idx4), 6(idx5), 7(idx6), 9(idx7)... 
    // So 4 shells from pit 4 → pits 5,6,7,9 — NOT the store. Let me recalculate.
    // To land in store (index 0, which is last in distribution order for P1):
    // Need to pick from pit 7 with some shells that reach index 0.
    // Distribution from pit 7: next is 9,10,11,12,13,14,15,0
    // So 8 shells from pit 7 would land on 9,10,11,12,13,14,15,0 → store!
    // Let's use 1 shell from pit 7 → lands on 9 (not store).
    // Use 8 shells from pit 7.
    const pits = [0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 7)!;

    expect(result.state.pits[P1_STORE]).toBeGreaterThan(0);
    expect(result.state.currentPlayer).toBe(PLAYER_1); // extra turn
  });

  it("grants extra turn when landing in own store (P2)", () => {
    // P2 distribution order: 9,10,11,12,13,14,15,1,2,3,4,5,6,7,8
    // From pit 15: next is 1,2,3,4,5,6,7,8(store)
    // 8 shells from pit 15 → lands on 1,2,3,4,5,6,7,8 → store!
    const pits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8];
    const state = makeState({ pits, currentPlayer: PLAYER_2 });
    const result = makeMove(state, 15)!;

    expect(result.state.pits[P2_STORE]).toBeGreaterThan(0);
    expect(result.state.currentPlayer).toBe(PLAYER_2); // extra turn
  });

  it("multi-lap: continues sowing when landing on non-empty pit", () => {
    // P1 picks pit 1 (1 shell) → drops in pit 2.
    // Pit 2 already has 3, so now it has 4 → pick up again and continue.
    const pits = [0, 1, 3, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;

    expect(result.state.pits[1]).toBe(0);
    expect(result.state.pits[2]).toBe(0); // was picked up again
    // 4 shells from pit 2 → distributed into 3, 4, 5, 6
    expect(result.state.pits[3]).toBe(1);
    expect(result.state.pits[4]).toBe(1);
    expect(result.state.pits[5]).toBe(1);
    expect(result.state.pits[6]).toBe(1);
  });

  it("capture: landing on own empty pit captures opposite shells", () => {
    // P1 picks pit 1 (2 shells) → drops in 2, 3.
    // Pit 3 was empty (now 1), and opposite pit (16-3=13) has shells → capture.
    const pits = [0, 2, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 5, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;

    expect(result.state.pits[3]).toBe(0);  // captured from here
    expect(result.state.pits[13]).toBe(0); // opposite pit emptied
    // P1 store gets 1 (own) + 5 (captured) = 6
    expect(result.state.pits[P1_STORE]).toBe(6);
  });

  it("no capture when opposite pit is empty", () => {
    // P1 picks pit 1 (2 shells) → drops in 2, 3.
    // Pit 3 was empty (now 1), but opposite pit (13) is also empty → no capture.
    const pits = [0, 2, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;

    expect(result.state.pits[3]).toBe(1); // shell stays
    expect(result.state.pits[P1_STORE]).toBe(0);
  });

  it("no capture when landing on opponent's side", () => {
    // P1 picks pit 7 (3 shells) → drops in 9, 10, 11 (P2's side).
    // Even if pit 11 was empty before, no capture because it's opponent's pit.
    const pits = [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 7)!;

    expect(result.state.pits[P1_STORE]).toBe(0);
  });

  it("skips opponent store during sowing (P1 skips P2 store)", () => {
    // P1 distribution order: 1,2,3,4,5,6,7,9,10,11,12,13,14,15,0
    // P2 store (index 8) is NOT in this order → always skipped.
    // P1 picks pit 7 (9 shells) → fills 9,10,11,12,13,14,15,0,1
    // Index 8 should remain 0.
    const pits = [0, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 7)!;

    expect(result.state.pits[P2_STORE]).toBe(0);
  });

  it("skips burnt pits during sowing", () => {
    // Pit 2 is burnt, P1 picks pit 1 (3 shells) → drops in 3, 4, 5 (skipping 2)
    const pits = [0, 3, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1, burntPits: [2] });
    const result = makeMove(state, 1)!;

    expect(result.state.pits[2]).toBe(0); // skipped
    expect(result.state.pits[3]).toBe(1);
    expect(result.state.pits[4]).toBe(1);
    expect(result.state.pits[5]).toBe(1);
  });

  it("detects round over when a side is emptied", () => {
    // P1 has 8 shells in pit 7 only. Sowing reaches P1 store (extra turn).
    // P1 side is empty → checkSideEmpty → round over.
    const pits = [0, 0, 0, 0, 0, 0, 0, 8, 0, 7, 7, 7, 7, 7, 7, 7];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 7)!;

    expect(result.state.roundOver).toBe(true);
    expect(result.state.roundWinner).toBe(PLAYER_2);
  });

  it("collects remaining shells to stores when round ends", () => {
    // Same setup: P1 side empties after landing in store.
    // Remaining P2 shells get collected to P2 store.
    const pits = [0, 0, 0, 0, 0, 0, 0, 8, 0, 7, 7, 7, 7, 7, 7, 7];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 7)!;

    expect(result.state.roundOver).toBe(true);
    for (const i of P2_PITS) expect(result.state.pits[i]).toBe(0);
    // P2 store should have collected all shells (7*7 original + 7 dropped = 56)
    expect(result.state.pits[P2_STORE]).toBeGreaterThan(0);
  });

  it("does not mutate the original state", () => {
    const state = makeState({
      pits: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      currentPlayer: PLAYER_1,
    });
    const originalPits = [...state.pits];
    makeMove(state, 1);
    expect(state.pits).toEqual(originalPits);
  });

  it("produces animation steps with pickup and drop types", () => {
    const pits = [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;

    const pickups = result.steps.filter((s) => s.type === "pickup");
    const drops = result.steps.filter((s) => s.type === "drop");
    expect(pickups.length).toBeGreaterThanOrEqual(1);
    expect(drops.length).toBe(2);
  });

  it("detects round over when next player has no valid moves", () => {
    // P1 moves, switches to P2, but P2 has no shells → round over
    const pits = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_1 });
    const result = makeMove(state, 1)!;
    expect(result.state.roundOver).toBe(true);
  });

  it("P2 captures when landing on own empty pit", () => {
    // P2 picks pit 9 (2 shells) → drops in 10, 11.
    // Pit 11 was empty (now 1), opposite pit (16-11=5) has shells → capture.
    const pits = [0, 7, 0, 0, 0, 4, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0];
    const state = makeState({ pits, currentPlayer: PLAYER_2 });
    const result = makeMove(state, 9)!;

    expect(result.state.pits[11]).toBe(0);
    expect(result.state.pits[5]).toBe(0);
    expect(result.state.pits[P2_STORE]).toBe(5); // 1 + 4
  });

  it("shell conservation: total shells remain 98 after a move from initial-like state", () => {
    const state = makeState({
      pits: [0, 7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7],
      currentPlayer: PLAYER_1,
    });
    const result = makeMove(state, 1)!;
    const total = result.state.pits.reduce((a, b) => a + b, 0);
    expect(total).toBe(98);
  });
});

// ─── makeSimultaneousFirstMove ──────────────────────────────────────

describe("makeSimultaneousFirstMove", () => {
  it("returns null for invalid P1 pit", () => {
    const state = createInitialState();
    expect(makeSimultaneousFirstMove(state, 9, 12)).toBeNull(); // pit 9 is P2's
  });

  it("returns null for invalid P2 pit", () => {
    const state = createInitialState();
    expect(makeSimultaneousFirstMove(state, 3, 3)).toBeNull(); // pit 3 is P1's
  });

  it("returns null for empty pit", () => {
    const state = createInitialState();
    state.pits[1] = 0;
    expect(makeSimultaneousFirstMove(state, 1, 9)).toBeNull();
  });

  it("returns null for burnt pit", () => {
    const state = createInitialState();
    state.burntPits = [1];
    expect(makeSimultaneousFirstMove(state, 1, 9)).toBeNull();
  });

  it("executes simultaneous sowing and clears isFirstMove", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 4, 12)!;

    expect(result).not.toBeNull();
    expect(result.state.isFirstMove).toBe(false);
  });

  it("determines first player by fewer animation steps", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 1, 9)!;

    // The player with fewer or equal steps goes first
    if (result.p1Steps.length <= result.p2Steps.length) {
      expect(result.state.currentPlayer).toBe(PLAYER_1);
    } else {
      expect(result.state.currentPlayer).toBe(PLAYER_2);
    }
  });

  it("produces both p1Steps and p2Steps", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 3, 11)!;

    expect(result.p1Steps.length).toBeGreaterThan(0);
    expect(result.p2Steps.length).toBeGreaterThan(0);
  });

  it("interleaves steps in the combined steps array", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 3, 11)!;

    expect(result.steps.length).toBe(
      result.p1Steps.length + result.p2Steps.length,
    );
  });

  it("conserves total shells (98)", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 5, 13)!;
    const total = result.state.pits.reduce((a, b) => a + b, 0);
    expect(total).toBe(98);
  });

  it("records move history", () => {
    const state = createInitialState();
    const result = makeSimultaneousFirstMove(state, 2, 10)!;
    expect(result.state.moveHistory).toEqual([2, 10]);
  });

  it("does not mutate original state", () => {
    const state = createInitialState();
    const originalPits = [...state.pits];
    makeSimultaneousFirstMove(state, 4, 12);
    expect(state.pits).toEqual(originalPits);
    expect(state.isFirstMove).toBe(true);
  });
});

// ─── calculateNextRound ─────────────────────────────────────────────

describe("calculateNextRound", () => {
  it("redistributes shells: 7 per pit, leftover to store", () => {
    // P1 has 50 in store → fills 7 pits (49 shells), 1 leftover
    // P2 has 48 in store → fills 6 pits (42 shells), 6 leftover
    const state = makeState({
      pits: [50, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);

    // P1: all 7 pits filled (50 = 7*7 + 1)
    for (const i of P1_PITS) expect(next.pits[i]).toBe(7);
    expect(next.pits[P1_STORE]).toBe(1);

    // P2: first 6 pits filled, 7th becomes burnt (48 = 6*7 + 6)
    let filledCount = 0;
    for (const i of P2_PITS) {
      if (next.pits[i] === 7) filledCount++;
    }
    expect(filledCount).toBe(6);
    expect(next.pits[P2_STORE]).toBe(6);
  });

  it("creates burnt pits for unfillable pits", () => {
    const state = makeState({
      pits: [50, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);

    // P2 can only fill 6 pits (48/7 = 6 remainder 6), so 1 pit becomes burnt
    const p2Burnt = next.burntPits.filter((p) => P2_PITS.includes(p));
    expect(p2Burnt.length).toBe(1);
  });

  it("preserves existing burnt pits and adds new ones", () => {
    const state = makeState({
      pits: [50, 0, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
      burntPits: [15], // one already burnt
    });
    const next = calculateNextRound(state);

    expect(next.burntPits).toContain(15);
    // P2 has 20 shells, with pit 15 burnt → 6 pits available, can fill 2 (14 shells), 4 become burnt
    const p2Burnt = next.burntPits.filter((p) => P2_PITS.includes(p));
    expect(p2Burnt.length).toBeGreaterThan(1);
  });

  it("loser of previous round goes first", () => {
    const state = makeState({
      pits: [50, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);
    expect(next.currentPlayer).toBe(PLAYER_2); // loser starts
  });

  it("P1 starts if round was a draw", () => {
    const state = makeState({
      pits: [49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: null,
    });
    const next = calculateNextRound(state);
    expect(next.currentPlayer).toBe(PLAYER_1);
  });

  it("resets round flags for the new round", () => {
    const state = makeState({
      pits: [49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
      round: 1,
      moveHistory: [1, 2, 3],
    });
    const next = calculateNextRound(state);

    expect(next.roundOver).toBe(false);
    expect(next.roundWinner).toBeNull();
    expect(next.isFirstMove).toBe(true);
    expect(next.round).toBe(2);
    expect(next.moveHistory).toEqual([]);
    expect(next.lastMove).toBeNull();
    expect(next.gameOver).toBe(false);
    expect(next.matchOver).toBe(false);
    expect(next.winner).toBeNull();
  });

  it("ends match when a player has fewer than 7 shells", () => {
    const state = makeState({
      pits: [92, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);

    expect(next.matchOver).toBe(true);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe(PLAYER_1);
  });

  it("ends match when both players have fewer than 7 shells", () => {
    const state = makeState({
      pits: [5, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);

    expect(next.matchOver).toBe(true);
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe(PLAYER_1); // 5 > 3
  });

  it("match ends in draw when both have equal but insufficient shells", () => {
    const state = makeState({
      pits: [3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: null,
    });
    const next = calculateNextRound(state);

    expect(next.matchOver).toBe(true);
    expect(next.winner).toBeNull();
  });

  it("conserves total shells across rounds", () => {
    const state = makeState({
      pits: [55, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
    });
    const next = calculateNextRound(state);
    const total = next.pits.reduce((a, b) => a + b, 0);
    expect(total).toBe(98);
  });

  it("skips already-burnt pits during redistribution", () => {
    // Pit 1 is burnt. P1 has 49 shells. Should fill pits 2-7 (42) + 7 leftover in store.
    const state = makeState({
      pits: [49, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0],
      roundOver: true,
      roundWinner: PLAYER_1,
      burntPits: [1],
    });
    const next = calculateNextRound(state);

    expect(next.pits[1]).toBe(0); // still burnt, not filled
    expect(next.burntPits).toContain(1);
    // 6 available pits × 7 = 42 filled, 7 leftover
    expect(next.pits[P1_STORE]).toBe(7);
  });
});
