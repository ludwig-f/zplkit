import type { Rect } from "@zplkit/render/internal";

type Edge = "left" | "center" | "right" | "top" | "middle" | "bottom";
type Move = { dx: number; dy: number };

/** Round to whole dots, without a negative zero */
const whole = (value: number): number => Math.round(value) + 0;

/** How far each rect moves to line up with the others' outermost edge, or their common center */
const alignMoves = (
  rects: Map<number, Rect>,
  edge: Edge
): Map<number, Move> => {
  const all = [...rects.values()];
  const horizontal = edge === "left" || edge === "center" || edge === "right";
  const starts = all.map((r) => (horizontal ? r.x : r.y));
  const ends = all.map((r) => (horizontal ? r.x + r.width : r.y + r.height));
  const min = Math.min(...starts);
  const max = Math.max(...ends);

  const moves = new Map<number, Move>();
  for (const [key, r] of rects) {
    const start = horizontal ? r.x : r.y;
    const size = horizontal ? r.width : r.height;
    let shift: number;
    if (edge === "left" || edge === "top") shift = min - start;
    else if (edge === "right" || edge === "bottom")
      shift = max - (start + size);
    else shift = (min + max) / 2 - (start + size / 2);
    moves.set(key, {
      dx: horizontal ? whole(shift) : 0,
      dy: horizontal ? 0 : whole(shift),
    });
  }
  return moves;
};

/** How far each rect moves so the gaps between them are equal, keeping the first and last */
const distributeMoves = (
  rects: Map<number, Rect>,
  axis: "x" | "y"
): Map<number, Move> => {
  const start = (r: Rect): number => (axis === "x" ? r.x : r.y);
  const size = (r: Rect): number => (axis === "x" ? r.width : r.height);

  const moves = new Map<number, Move>();
  for (const key of rects.keys()) moves.set(key, { dx: 0, dy: 0 });

  // Left to right (or top to bottom); the first and last stay put
  const sorted = [...rects].sort(([, a], [, b]) => start(a) - start(b));
  if (sorted.length < 3) return moves;
  const first = sorted[0][1];
  const last = sorted[sorted.length - 1][1];
  const free =
    start(last) +
    size(last) -
    start(first) -
    sorted.reduce((sum, [, r]) => sum + size(r), 0);
  const gap = free / (sorted.length - 1);

  let at = start(first) + size(first) + gap;
  for (const [key, r] of sorted.slice(1, -1)) {
    const shift = whole(at - start(r));
    moves.set(key, axis === "x" ? { dx: shift, dy: 0 } : { dx: 0, dy: shift });
    at += size(r) + gap;
  }
  return moves;
};

export { alignMoves, distributeMoves };
export type { Edge };
