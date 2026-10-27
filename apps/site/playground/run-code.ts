import type { Outcome, RunRequest, RunResult } from "./run-code.worker";

/** How long code may run before it's stopped, in milliseconds */
const TIMEOUT = 2000;

/**
 * Runs playground code in a worker. A newer run supersedes one still
 * going, and code that takes too long is stopped by replacing the worker.
 */
const createRunner = () => {
  let worker: Worker | undefined;
  let next = 0;
  let pending:
    | {
        id: number;
        resolve: (outcome: Outcome | undefined) => void;
        timer: number;
      }
    | undefined;

  const start = () => {
    const created = new Worker(
      new URL("./run-code.worker.ts", import.meta.url),
      { type: "module" }
    );
    created.onmessage = (event: MessageEvent<RunResult>) => {
      if (!pending || event.data.id !== pending.id) return;
      const { id: _id, ...outcome } = event.data;
      void _id;
      clearTimeout(pending.timer);
      pending.resolve(outcome as Outcome);
      pending = undefined;
    };
    return created;
  };

  const stop = () => {
    worker?.terminate();
    worker = undefined;
  };

  return {
    /** Run code; resolves undefined if a newer run replaced this one */
    run(code: string): Promise<Outcome | undefined> {
      // The newer run's result is the one wanted. If the worker is stuck
      // on the older one, the newer run times out and replaces it.
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(undefined);
        pending = undefined;
      }
      worker ??= start();
      const id = ++next;
      return new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          stop();
          pending = undefined;
          resolve({
            ok: false,
            message: `The code ran for more than ${
              TIMEOUT / 1000
            } seconds and was stopped. Is there an endless loop?`,
          });
        }, TIMEOUT);
        pending = { id, resolve, timer };
        worker!.postMessage({ id, code } satisfies RunRequest);
      });
    },
    dispose: stop,
  };
};

export { createRunner };
export type { Outcome };
