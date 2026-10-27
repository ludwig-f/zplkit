/// <reference lib="webworker" />
/**
 * Runs playground code away from the page: compiles TypeScript and JSX with
 * Sucrase, runs it with zplkit as its only import, and posts back the ZPL
 * of what it exports. Shared links run other people's code, so it never
 * sees the page, and an endless loop can be stopped by ending the worker.
 */
import { run } from "./run-code-core";
import type { Outcome } from "./run-code-core";

type RunRequest = { id: number; code: string };

type RunResult = Outcome & { id: number };

// Code from shared links shouldn't reach other servers or start workers of
// its own. zplkit is bundled into this worker, so nothing needs these. Some
// live on WorkerGlobalScope.prototype rather than on self, so each is removed
// from every object in the chain, where code could otherwise still find it.
const blocked = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "WebTransport",
  "EventSource",
  "importScripts",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "indexedDB",
  "caches",
];
for (
  let scope: object | null = self;
  scope && scope !== Object.prototype;
  scope = Object.getPrototypeOf(scope)
) {
  for (const name of blocked) {
    if (Object.prototype.hasOwnProperty.call(scope, name) || scope === self) {
      Object.defineProperty(scope, name, {
        value: undefined,
        writable: false,
        configurable: false,
      });
    }
  }
}

self.onmessage = (event: MessageEvent<RunRequest>) => {
  const { id, code } = event.data;
  self.postMessage({ id, ...run(code) } satisfies RunResult);
};

export type { RunRequest, RunResult, Outcome };
