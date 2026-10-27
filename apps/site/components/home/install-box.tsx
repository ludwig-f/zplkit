"use client";

import { useState } from "react";
import { CopyButton } from "./code-panel";

const commands = {
  npm: "npm i @zplkit/core",
  pnpm: "pnpm add @zplkit/core",
  yarn: "yarn add @zplkit/core",
  bun: "bun add @zplkit/core",
};

type PackageManager = keyof typeof commands;

/** The install command for each package manager, with Copy */
export function InstallBox() {
  const [manager, setManager] = useState<PackageManager>("npm");
  const command = commands[manager];

  return (
    <div className="max-w-[460px] overflow-hidden rounded-md border border-rule-strong bg-code">
      <div
        role="tablist"
        aria-label="Package manager"
        className="flex border-b border-rule"
      >
        {(Object.keys(commands) as PackageManager[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === manager}
            onClick={() => setManager(id)}
            className={`px-3.5 py-2 font-mono text-[13px] [outline-offset:-2px] ${
              id === manager
                ? "text-ink shadow-[inset_0_-2px_0_var(--zk-accent)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 py-1 pl-4 pr-1">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[15px] font-medium">
          <span className="text-muted">$ </span>
          {command}
        </code>
        <CopyButton
          text={command}
          className="h-10 min-w-[84px] border-rule-strong bg-surface text-[13px] text-ink"
        />
      </div>
    </div>
  );
}
