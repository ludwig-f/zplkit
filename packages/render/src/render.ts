import { parse } from "@zplkit/core";
import { Raster, fillPath } from "./raster.js";
import { boxPath, circlePath, diagonalPath, ellipsePath } from "./shapes.js";
import { countCopies } from "./copies.js";
import { expandFormats } from "./formats.js";
import { layout } from "./layout.js";
import { drawText, textWidth } from "./text.js";
import { drawBarcode, drawPlaceholder } from "./barcode.js";
import { drawSymbol } from "./symbols.js";
import type { Command } from "@zplkit/core";
import type { Element } from "./layout.js";
import type { Color } from "./raster.js";

type RenderOptions = {
  /** Label width in millimeters */
  widthMm: number;
  /** Label height in millimeters */
  heightMm: number;
  /** Dots per millimeter: 6, 8, 12 or 24 */
  dpmm: number;
  /**
   * Anti-alias edges instead of printing whole dots like a printer
   * @defaultValue false
   */
  antialias?: boolean;
  /**
   * Fonts already on the printer, by path like "E:ARIAL.TTF". Without a
   * device ("ARIAL.TTF"), a font matches references to any device.
   */
  fonts?: Record<string, Uint8Array>;
  /**
   * A TrueType or OpenType font to draw font 0 with, instead of the
   * open-licensed stand-in, like the printer's own if you have a license
   */
  font0?: Uint8Array;
  /**
   * Render only the first labels, counting each different copy, for
   * previews of many serialized labels
   */
  limit?: number;
};

type TextElement = Extract<Element, { kind: "text" }>;

const textOptions = (element: TextElement, dpmm: number) => ({
  x: element.x,
  y: element.y,
  fromBottom: element.fromBottom,
  font: element.font,
  height: element.height,
  width: element.width,
  typeface: element.typeface,
  font0: element.font0,
  orientation: element.orientation,
  block: element.block,
  dpmm,
});

/**
 * A right-justified element moved to end just before its x: text by its
 * laid-out width, anything else by where its dots end, found by drawing it
 * once at the left edge
 */
const justified = (element: Element, raster: Raster, dpmm: number): Element => {
  if (!element.right) return element;
  if (element.kind === "text") {
    return {
      ...element,
      x: element.x - textWidth(element.text, textOptions(element, dpmm)),
    };
  }
  const trial = new Raster(raster.width, raster.height, raster.sampling);
  draw(trial, { ...element, x: 0 }, dpmm);
  let end = 0;
  for (let i = 0; i < trial.ink.length; i++) {
    if (trial.ink[i] > 0) end = Math.max(end, (i % trial.width) + 1);
  }
  return { ...element, x: element.x - end };
};

/** Draw an element in the given color, ignoring reverse printing */
const draw = (
  raster: Raster,
  element: Element,
  dpmm: number,
  color: Color = "B"
): void => {
  const { x, y } = element;

  switch (element.kind) {
    case "box":
      fillPath(
        raster,
        boxPath(
          x,
          y,
          element.width,
          element.height,
          element.thickness,
          element.rounding
        ),
        element.color === "W" ? "W" : color
      );
      break;
    case "circle":
      fillPath(
        raster,
        circlePath(x, y, element.diameter, element.thickness),
        element.color === "W" ? "W" : color
      );
      break;
    case "ellipse":
      fillPath(
        raster,
        ellipsePath(x, y, element.width, element.height, element.thickness),
        element.color === "W" ? "W" : color
      );
      break;
    case "diagonal":
      fillPath(
        raster,
        diagonalPath(
          x,
          y,
          element.width,
          element.height,
          element.thickness,
          element.direction
        ),
        element.color === "W" ? "W" : color
      );
      break;
    case "text":
      drawText(raster, element.text, textOptions(element, dpmm), color);
      break;
    case "barcode":
      drawBarcode(raster, element, dpmm, color);
      break;
    case "symbol":
      drawSymbol(raster, element, color);
      break;
    case "placeholder":
      drawPlaceholder(raster, element, dpmm, color);
      break;
    case "bitmap": {
      const {
        bytes,
        bytesPerRow,
        rows,
        magnificationX: mx,
        magnificationY: my,
      } = element;
      for (let row = 0; row < rows; row++) {
        for (let bit = 0; bit < bytesPerRow * 8; bit++) {
          const byte = bytes[row * bytesPerRow + (bit >> 3)];
          if (!((byte >> (7 - (bit & 7))) & 1)) continue;

          for (let dy = 0; dy < my; dy++) {
            const py = y + row * my + dy;
            if (py < 0 || py >= raster.height) continue;
            for (let dx = 0; dx < mx; dx++) {
              const px = x + bit * mx + dx;
              if (px < 0 || px >= raster.width) continue;
              raster.ink[py * raster.width + px] = color === "B" ? 1 : 0;
            }
          }
        }
      }
      break;
    }
  }
};

/** Draw a reversed element: wherever it has ink, invert what's underneath */
const drawReversed = (raster: Raster, element: Element, dpmm: number): void => {
  const mask = new Raster(raster.width, raster.height, raster.sampling);
  draw(mask, element, dpmm);
  for (let i = 0; i < raster.ink.length; i++) {
    const m = mask.ink[i];
    if (m > 0) raster.ink[i] = raster.ink[i] + m * (1 - 2 * raster.ink[i]);
  }
};

/**
 * Most dots in a label, about three times the largest real ones (8.5 by 39
 * inches at 300 dpi), so a mistyped size fails fast instead of taking
 * seconds or running out of memory
 */
const MAX_DOTS = 100_000_000;

/**
 * Most different labels to render without a limit, so ^PQ with ^SN can't
 * ask for millions of images by accident
 */
const MAX_LABELS = 10_000;

/**
 * Render each label in ZPL (or parsed commands) to a raster of ink coverage.
 * Labels without ^PW use the full width; narrower print widths are centered,
 * like printers do.
 */
const renderLabels = (
  zpl: string | readonly Command[],
  options: RenderOptions
): Raster[] => {
  const commands = typeof zpl === "string" ? parse(zpl).commands : zpl;
  const width = Math.ceil(options.widthMm * options.dpmm - 1e-9);
  const height = Math.ceil(options.heightMm * options.dpmm - 1e-9);
  const sampling = options.antialias ? "coverage" : "center";
  if (width * height > MAX_DOTS) {
    throw new RangeError(
      `The label is ${width} × ${height} dots, too large to render. The largest real labels have about 30 million dots.`
    );
  }

  if (options.limit === undefined) {
    const { labels } = countCopies(expandFormats(commands));
    if (labels > MAX_LABELS) {
      throw new RangeError(
        `The ZPL prints ${labels} different labels, more than ${MAX_LABELS} at once. Pass a limit to render the first ones.`
      );
    }
  }

  return layout(commands, {
    fonts: options.fonts,
    font0: options.font0,
    dpmm: options.dpmm,
    limit: options.limit,
  }).map((label) => {
    const printWidth = Math.min(width, label.printWidth ?? width);
    const printed = new Raster(printWidth, height, sampling);

    for (const given of label.elements) {
      const element = justified(given, printed, options.dpmm);
      if (element.reverse) drawReversed(printed, element, options.dpmm);
      else draw(printed, element, options.dpmm);
    }

    // Mirrored: each row of the print area runs the other way
    if (label.mirrored) {
      for (let y = 0; y < height; y++) {
        printed.ink.subarray(y * printWidth, (y + 1) * printWidth).reverse();
      }
    }

    // Upside down: turning the print area half a turn reverses its dots
    if (label.inverted) printed.ink.reverse();

    printed.copies = label.copies;
    if (printWidth === width) return printed;

    // Center the printed area on the label
    const raster = new Raster(width, height, sampling);
    const offset = Math.floor((width - printWidth) / 2);
    for (let y = 0; y < height; y++) {
      raster.ink.set(
        printed.ink.subarray(y * printWidth, (y + 1) * printWidth),
        y * width + offset
      );
    }
    raster.copies = label.copies;
    return raster;
  });
};

export type { RenderOptions };
export { renderLabels };
