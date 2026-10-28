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

export type { LabelBox };
export { labelAt, pxToDots, toDots, toScreen };
