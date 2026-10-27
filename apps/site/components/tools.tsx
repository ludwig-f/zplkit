import type { SVGProps } from "react";

/** The playground's icon: a pair of code brackets */
export function PlaygroundIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5" />
    </svg>
  );
}

/** The viewer's icon: a barcode in a scanner's frame */
export function ViewerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8.5 9v6M12 9v6M15.5 9v6" />
    </svg>
  );
}

/**
 * The two tools: the playground, for writing labels in code, and the
 * viewer, for ZPL someone already has. Each has its own accent color.
 */
export const tools = {
  playground: {
    href: "/playground",
    name: "Playground",
    /** In the nav, next to Docs */
    short: "Playground",
    tagline: "Write labels in code.",
    Icon: PlaygroundIcon,
    /** Text in the accent color */
    text: "text-accent",
    /** The icon's tile */
    tile: "bg-accent-soft text-accent",
    /** The underline of the active nav link */
    bar: "shadow-[inset_0_-2px_0_var(--zk-accent)]",
  },
  viewer: {
    href: "/viewer",
    name: "ZPL viewer",
    short: "Viewer",
    tagline: "Preview ZPL before it prints.",
    Icon: ViewerIcon,
    text: "text-view",
    tile: "bg-view-soft text-view",
    bar: "shadow-[inset_0_-2px_0_var(--zk-view)]",
  },
};

export type Tool = keyof typeof tools;
