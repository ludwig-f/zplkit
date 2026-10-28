import type { Rect } from "@zplkit/render/internal";

/** Where a label image is on screen, in px, and its size in dots */
type LabelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  dotsWide: number;
  dotsHigh: number;
};

/** Px per dot on each axis */
const scaleOf = (box: LabelBox) => ({
  x: box.width / box.dotsWide,
  y: box.height / box.dotsHigh,
});

/** A rect in dots on a label, as px in the overlay */
const toScreen = (box: LabelBox, rect: Rect): Rect => {
  const scale = scaleOf(box);
  return {
    x: box.left + rect.x * scale.x,
    y: box.top + rect.y * scale.y,
    width: rect.width * scale.x,
    height: rect.height * scale.y,
  };
};

/** A point in px in the overlay, as dots on the label (not clamped) */
const toDots = (
  box: LabelBox,
  x: number,
  y: number
): { x: number; y: number } => {
  const scale = scaleOf(box);
  return {
    x: (x - box.left) / scale.x,
    y: (y - box.top) / scale.y,
  };
};

/** A distance in px, as dots */
const pxToDots = (box: LabelBox, px: number): number => px / scaleOf(box).x;

/** The label box under a point, by index, or undefined */
const labelAt = (
  boxes: LabelBox[],
  x: number,
  y: number
): number | undefined => {
  const index = boxes.findIndex(
    (box) =>
      x >= box.left &&
      x < box.left + box.width &&
      y >= box.top &&
      y < box.top + box.height
  );
  return index === -1 ? undefined : index;
};

/** A rect grown by a margin on every side */
const grow = (rect: Rect, by: number): Rect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

/** A rect shifted by a distance */
const moved = (rect: Rect, dx: number, dy: number): Rect => ({
  ...rect,
  x: rect.x + dx,
  y: rect.y + dy,
});

/** The rect between two corners, in any order */
const spanning = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** The smallest rect around all of them; there must be at least one */
const union = (rects: readonly Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
};

export type { LabelBox };
export { grow, labelAt, moved, pxToDots, spanning, toDots, toScreen, union };
