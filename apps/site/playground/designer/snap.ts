import type { Rect } from "@zplkit/render/internal";

/** A line the moving rect snapped to: x for a vertical line, y for a horizontal one */
type Guide = { axis: "x" | "y"; at: number };

/** The start, middle and end of a span */
const lines = (start: number, size: number): number[] => [
  start,
  start + size / 2,
  start + size,
];

/**
 * The smallest shift that puts one of `own` on one of `targets`, within the
 * threshold (0 when a line is already on a target), and every target the
 * shifted lines then sit on
 */
const snapAxis = (
  own: number[],
  targets: number[],
  threshold: number
): { shift: number; at: number[] } | undefined => {
  let shift: number | undefined;
  for (const line of own) {
    for (const target of targets) {
      const candidate = target - line;
      if (
        Math.abs(candidate) <= threshold &&
        (shift === undefined || Math.abs(candidate) < Math.abs(shift))
      ) {
        shift = candidate;
      }
    }
  }
  if (shift === undefined) return undefined;

  const at = new Set<number>();
  for (const line of own) {
    for (const target of targets) {
      if (target - line === shift) at.add(target);
    }
  }
  return { shift, at: [...at] };
};

/**
 * Adjust a move so the moving rect's left, center or right lines up with
 * another rect's left, center or right, or the label's edges and center,
 * within `threshold` dots; the same for top, middle and bottom. `others`
 * must not include the moving rect
 */
const snapMove = (
  moving: Rect,
  dx: number,
  dy: number,
  others: Rect[],
  label: { width: number; height: number },
  threshold = 4
): { dx: number; dy: number; guides: Guide[] } => {
  const guides: Guide[] = [];
  const targetsX = [
    ...lines(0, label.width),
    ...others.flatMap(({ x, width }) => lines(x, width)),
  ];
  const targetsY = [
    ...lines(0, label.height),
    ...others.flatMap(({ y, height }) => lines(y, height)),
  ];

  const x = snapAxis(lines(moving.x + dx, moving.width), targetsX, threshold);
  const y = snapAxis(lines(moving.y + dy, moving.height), targetsY, threshold);
  for (const at of x?.at ?? []) guides.push({ axis: "x", at });
  for (const at of y?.at ?? []) guides.push({ axis: "y", at });

  // Moves are whole dots, so a half dot from an odd-sized center rounds
  return {
    dx: dx + Math.round(x?.shift ?? 0),
    dy: dy + Math.round(y?.shift ?? 0),
    guides,
  };
};

export { snapMove };
export type { Guide };
