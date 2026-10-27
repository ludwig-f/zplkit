/**
 * Graphic symbols (^GS): ®, ©, ™ and the UL and CSA marks, picked by the
 * field data's first character, A to E. Printers draw them from a bitmap
 * font in 24-dot cells, magnified in whole steps. The marks' artwork isn't
 * ours to copy, so they're drawn as rings and letters of the same size.
 */
import { fillPath } from "./raster.js";
import { drawGlyphs, faceFor, placeLine, placement } from "./text.js";
import type { Element } from "./layout.js";
import type { Color, Raster } from "./raster.js";
import type { Place } from "./text.js";

type SymbolElement = Extract<Element, { kind: "symbol" }>;

/** Height of the symbol font's cell at magnification 1 */
const CELL = 24;

/** Each symbol's size at magnification 1, its letters, and if it's ringed */
const symbols: Record<
  string,
  { width: number; height: number; letters: string; ring: boolean }
> = {
  A: { width: 15, height: 15, letters: "R", ring: true },
  B: { width: 15, height: 15, letters: "C", ring: true },
  C: { width: 19, height: 10, letters: "TM", ring: false },
  D: { width: 24, height: 24, letters: "UL", ring: true },
  E: { width: 22, height: 24, letters: "CSA", ring: true },
};

/** An ellipse as a closed path of points, clockwise unless reversed */
const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  reverse = false
) =>
  Array.from({ length: 64 }, (_, i) => {
    const angle = ((reverse ? -i : i) / 64) * 2 * Math.PI;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)] as const;
  });

/** Letters in font 0 whose ink fills the box from (u, v) */
const drawLetters = (
  raster: Raster,
  text: string,
  box: { u: number; v: number; width: number; height: number },
  place: Place,
  color: Color
) => {
  // Font 0's capitals are three quarters of its height; lay the letters out
  // at width 100, then stretch them so their ink spans the box
  const height = box.height / 0.75;
  const unit = faceFor({ font: "0", height, width: 100, dpmm: 8 });
  const glyphs = placeLine(unit, text, 0, 0);
  let left = Infinity;
  let right = -Infinity;
  for (const { font, glyph, pen, scaleX } of glyphs) {
    for (const point of font.outline(glyph).flat()) {
      left = Math.min(left, pen + point.x * scaleX);
      right = Math.max(right, pen + point.x * scaleX);
    }
  }
  const stretch = box.width / (right - left);
  const face = faceFor({ font: "0", height, width: 100 * stretch, dpmm: 8 });
  drawGlyphs(
    raster,
    placeLine(face, text, box.u - left * stretch, box.v + box.height),
    place,
    color
  );
};

const drawSymbol = (
  raster: Raster,
  symbol: SymbolElement,
  color: Color
): void => {
  const shape = symbols[symbol.symbol];
  if (!shape) return;
  const { magX, magY } = symbol;
  const width = shape.width * magX;
  const height = shape.height * magY;
  const cell = CELL * magY;
  const place = placement(
    { width, height: cell, ascent: cell, lastBaseline: 0 },
    symbol
  );

  // The symbol hangs from the top of its cell
  const top = -cell;
  if (!shape.ring) {
    drawLetters(
      raster,
      shape.letters,
      { u: 0, v: top, width, height },
      place,
      color
    );
    return;
  }

  const rx = width / 2;
  const ry = height / 2;
  const thickness = Math.max(1, 0.1 * Math.min(width, height));
  fillPath(
    raster,
    [
      ellipse(rx, top + ry, rx, ry),
      ellipse(rx, top + ry, rx - thickness, ry - thickness, true),
    ].map((path) => path.map(([u, v]) => place(u, v))),
    color
  );
  // Letters fill the middle of the ring
  const inner = 2 * (Math.min(rx, ry) - thickness);
  const letterHeight = 0.5 * inner;
  const letterWidth = Math.min(
    0.75 * inner,
    letterHeight * 0.7 * shape.letters.length
  );
  drawLetters(
    raster,
    shape.letters,
    {
      u: rx - letterWidth / 2,
      v: top + ry - letterHeight / 2,
      width: letterWidth,
      height: letterHeight,
    },
    place,
    color
  );
};

export { drawSymbol };
