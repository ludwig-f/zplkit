import { Raster } from "./raster.js";
import type { Dirty } from "./raster.js";
import { layout } from "./layout.js";
import { draw, justified } from "./render.js";
import type { Command } from "@zplkit/core";
import type { Element } from "./layout.js";
import type { RenderOptions } from "./render.js";

type Rect = { x: number; y: number; width: number; height: number };

type DesignField = {
  /** Index of the field's first command; the same on every label that prints it */
  key: number;
  kind: Element["kind"];
  /** Indices of the commands that make the field, in the parsed command list */
  commands: number[];
  /** Where its ink is, in dots on the rendered image */
  bounds: Rect;
  /** False for placeholders of commands that aren't drawn yet */
  drawn: boolean;
};

type DesignLabel = {
  /** Index of the label's ^XA in the parsed commands; copies share it */
  start: number;
  width: number;
  height: number;
  inverted: boolean;
  mirrored: boolean;
  /** In drawing order, so later fields are on top */
  fields: DesignField[];
};

/**
 * The smallest rectangle around the dots with ink in an area, if there are
 * any, clearing the area for the next element
 */
const takeInk = (raster: Raster, area: Dirty): Rect | undefined => {
  const { width, ink } = raster;
  let left = area.right;
  let top = area.bottom;
  let right = -1;
  let bottom = -1;
  for (let y = area.top; y < area.bottom; y++) {
    const row = y * width;
    for (let x = area.left; x < area.right; x++) {
      if (ink[row + x] <= 0) continue;
      ink[row + x] = 0;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return undefined;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/**
 * Lay out each label like `renderLabels()` and measure where every field's
 * ink lands on the rendered image, so a designer can select and move them.
 * Fields with no ink, like empty text, get a zero-size rect at their position.
 */
const designLabels = (
  commands: readonly Command[],
  options: RenderOptions
): DesignLabel[] => {
  const width = Math.ceil(options.widthMm * options.dpmm - 1e-9);
  const height = Math.ceil(options.heightMm * options.dpmm - 1e-9);
  const sampling = options.antialias ? "coverage" : "center";

  return layout(commands, {
    fonts: options.fonts,
    font0: options.font0,
    dpmm: options.dpmm,
    limit: options.limit,
    clock: options.clock,
  }).map((label) => {
    const printWidth = Math.min(width, label.printWidth ?? width);
    const scratch = new Raster(printWidth, height, sampling);
    const offset = Math.floor((width - printWidth) / 2);
    const fields = new Map<number, DesignField>();

    for (const given of label.elements) {
      const element = justified(given, scratch, options.dpmm);
      // Track where the element draws, so only that area is scanned
      const area = { left: printWidth, top: height, right: 0, bottom: 0 };
      scratch.dirty = area;
      draw(scratch, element, options.dpmm);
      const bounds = takeInk(scratch, area) ?? {
        x: element.x,
        y: element.y,
        width: 0,
        height: 0,
      };

      // Where the dots end up after mirroring, turning and centering
      let { x, y } = bounds;
      if (label.mirrored) x = printWidth - x - bounds.width;
      if (label.inverted) {
        x = printWidth - x - bounds.width;
        y = height - y - bounds.height;
      }
      const placed = { ...bounds, x: x + offset, y };

      const key = element.commands[0];
      const field = fields.get(key);
      if (field) {
        field.bounds = union(field.bounds, placed);
        field.commands = [...new Set([...field.commands, ...element.commands])];
      } else {
        fields.set(key, {
          key,
          kind: element.kind,
          commands: [...element.commands],
          bounds: placed,
          drawn: element.kind !== "placeholder",
        });
      }
    }

    return {
      start: label.start,
      width,
      height,
      inverted: label.inverted ?? false,
      mirrored: label.mirrored ?? false,
      fields: [...fields.values()],
    };
  });
};

export type { DesignField, DesignLabel, Rect };
export { designLabels };
