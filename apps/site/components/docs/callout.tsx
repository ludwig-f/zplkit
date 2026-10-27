import type { ReactNode } from "react";

type CalloutType = "info" | "note" | "warn" | "warning" | "error";

const styles = {
  info: {
    box: "border-accent-line bg-accent-soft",
    title: "text-accent",
    marker: "rounded-full bg-accent",
  },
  warn: {
    box: "border-warn-line bg-warn-soft",
    title: "text-warn",
    marker: "rotate-45 bg-warn",
  },
  error: {
    box: "border-err-line bg-err-soft",
    title: "text-err",
    marker: "bg-err",
  },
};

/**
 * A note, warning or error in the docs. The marker's shape says which (circle,
 * diamond or square), so the color isn't the only cue.
 */
export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const kind =
    type === "warn" || type === "warning"
      ? "warn"
      : type === "error"
      ? "error"
      : "info";
  const style = styles[kind];
  return (
    <aside
      role="note"
      className={`not-prose my-5 grid grid-cols-[22px_minmax(0,1fr)] gap-3 rounded-md border px-4 py-3.5 ${style.box}`}
    >
      <span
        aria-hidden="true"
        className={`ml-[5px] mt-2 size-2.5 ${style.marker}`}
      />
      <div className="flex flex-col gap-0.5 text-[15px] leading-relaxed [&_code]:font-mono [&_code]:text-[0.9em]">
        {title && (
          <strong className={`font-bold ${style.title}`}>{title}</strong>
        )}
        <div>{children}</div>
      </div>
    </aside>
  );
}
