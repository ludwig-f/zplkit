"use client";

import { useEffect, useRef, useState } from "react";

type Tab = { id: string; code: string; html: string };

/**
 * A code block in the site's style: tabs or a file name on the left, Copy on
 * the right. The code is highlighted on the server.
 */
export function CodePanel({
  tabs,
  title,
}: {
  tabs: Tab[];
  /** Shown instead of tabs when there's only one */
  title?: string;
}) {
  const [current, setCurrent] = useState(tabs[0].id);
  const tab = tabs.find((t) => t.id === current) ?? tabs[0];

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-rule-strong bg-code">
      <div className="flex h-10 items-center border-b border-rule">
        {tabs.length > 1 ? (
          <div role="tablist" className="flex h-full">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => setCurrent(t.id)}
                className={`px-3.5 font-mono text-[13px] [outline-offset:-2px] ${
                  t.id === tab.id
                    ? "text-ink shadow-[inset_0_-2px_0_var(--zk-accent)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-3.5 font-mono text-[13px] text-muted">
            {title}
          </span>
        )}
        <div className="flex-1" />
        <CopyButton text={tab.code} className="mr-1.5 h-[30px] text-xs" />
      </div>
      <div
        className="overflow-x-auto px-[18px] py-4 font-mono text-[13.5px] leading-[1.7] [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: tab.html }}
      />
    </div>
  );
}

/** Copies text, then says so for a moment */
export function CopyButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      aria-live="polite"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
      className={`rounded border px-2.5 font-semibold transition-colors ${
        copied
          ? "border-ok/40 bg-ok-soft text-ok"
          : "border-rule text-muted hover:text-ink"
      } ${className}`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
