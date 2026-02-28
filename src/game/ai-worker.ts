import { getAIMove } from "./sungka-ai";
import type { GameState } from "./sungka-engine";
import type { Difficulty } from "./sungka-ai";

export interface AIWorkerRequest {
  state: GameState;
  difficulty: Difficulty;
}

export interface AIWorkerResponse {
  move: number | null;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest>) => {
  const { state, difficulty } = e.data;
  const move = getAIMove(state, difficulty);
  self.postMessage({ move } satisfies AIWorkerResponse);
};
