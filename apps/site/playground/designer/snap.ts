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
 * threshold; a line already on a target wins with a shift of 0
 */
const snapAxis = (
  own: number[],
  targets: number[],
  threshold: number
): { shift: number; at: number } | undefined => {
  let best: { shift: number; at: number } | undefined;
  for (const line of own) {
    for (const at of targets) {
      const shift = at - line;
      if (
        Math.abs(shift) <= threshold &&
        (!best || Math.abs(shift) < Math.abs(best.shift))
      ) {
        best = { shift, at };
      }
    }
  }
  return best;
};

/**
 * Adjust a move so the moving rect's left, center or right lines up with
 * another rect's left, center or right, or the label's edges and center,
 * within `threshold` dots; the same for top, middle and bottom
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
  // A line that was already in place didn't snap, so it has no guide
  if (x?.shift) guides.push({ axis: "x", at: x.at });
  if (y?.shift) guides.push({ axis: "y", at: y.at });

  // Moves are whole dots, so a half dot from an odd-sized center rounds
  return {
    dx: dx + Math.round(x?.shift ?? 0),
    dy: dy + Math.round(y?.shift ?? 0),
    guides,
  };
};

export { snapMove };
export type { Guide };
