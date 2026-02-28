import type { GameState } from "./sungka-engine";
import type { Difficulty } from "./sungka-ai";
import type { AIWorkerRequest, AIWorkerResponse } from "./ai-worker";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./ai-worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

/**
 * Request an AI move asynchronously via Web Worker.
 * Returns a promise that resolves with the chosen pit index (or null).
 */
export function getAIMoveAsync(
  state: GameState,
  difficulty: Difficulty,
): Promise<number | null> {
  return new Promise((resolve) => {
    const w = getWorker();

    const handler = (e: MessageEvent<AIWorkerResponse>) => {
      w.removeEventListener("message", handler);
      resolve(e.data.move);
    };

    w.addEventListener("message", handler);
    w.postMessage({ state, difficulty } satisfies AIWorkerRequest);
  });
}

/**
 * Terminate the worker (for cleanup on unmount).
 */
export function terminateAIWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
