import type { ReactNode } from "react";

/**
 * The Markdown release-please writes in a change: **scope:** in bold,
 * `code`, and links, with commit links shown as short hashes
 */
export function InlineMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const key = index;
    if (match[1]) {
      parts.push(
        <strong key={key} className="font-semibold">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      parts.push(
        <code
          key={key}
          className="rounded-[3px] bg-code-inline px-1 font-mono text-[0.9em]"
        >
          {match[2]}
        </code>
      );
    } else {
      const commit = /\/commit\/[0-9a-f]+$/.test(match[4]);
      parts.push(
        <a
          key={key}
          href={match[4]}
          className={
            commit
              ? "font-mono text-[0.85em] text-muted hover:text-accent"
              : "text-accent hover:underline"
          }
        >
          {match[3]}
        </a>
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
