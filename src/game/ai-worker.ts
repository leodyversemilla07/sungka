import { getAIMove } from "./sungka-ai";
import type { GameState } from "./sungka-engine";
import type { Difficulty } from "./sungka-ai";

export interface AIWorkerRequest {
  requestId: number;
  state: GameState;
  difficulty: Difficulty;
}

export interface AIWorkerResponse {
  requestId: number;
  move: number | null;
}

self.onmessage = (e: MessageEvent<AIWorkerRequest>) => {
  const { requestId, state, difficulty } = e.data;
  const move = getAIMove(state, difficulty);
  self.postMessage({ requestId, move } satisfies AIWorkerResponse);
};
