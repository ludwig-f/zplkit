import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFont, flattenGlyph } from "./font.js";
import type { Font } from "./font.js";

const load = (path: string) =>
  parseFont(new Uint8Array(readFileSync(new URL(path, import.meta.url))));

const font0 = load("../fonts/font0.ttf");
// Roboto Condensed cut down to A, e, Å and é, whose accented letters are composite glyphs
const composite = load("./__fixtures__/composite.ttf");

/** Contour count and bounds of a glyph's flattened outline, in font units */
const outline = (font: Font, char: string) => {
  const contours = flattenGlyph(
    font,
    font.glyphIndex(char.codePointAt(0)!),
    0.5
  );
  const points = contours.flat();
  return {
    contours: contours.length,
    bounds: [
      Math.round(Math.min(...points.map((p) => p[0]))),
      Math.round(Math.min(...points.map((p) => p[1]))),
      Math.round(Math.max(...points.map((p) => p[0]))),
      Math.round(Math.max(...points.map((p) => p[1]))),
    ],
  };
};

// Expected values come from fontTools
describe("parseFont", () => {
  test("reads the font's metrics", () => {
    expect([font0.unitsPerEm, font0.capHeight, font0.numGlyphs]).toStrictEqual([
      1000, 686, 269,
    ]);
  });

  test("measures the capital height from H when the font doesn't say", () => {
    // DejaVu's OS/2 table predates the capital height field
    const dejavu = load("../fonts/DejaVuSansMono.ttf");
    expect([dejavu.unitsPerEm, dejavu.capHeight]).toStrictEqual([2048, 1493]);
  });

  test("maps characters to glyphs", () => {
    expect(font0.glyphIndex("H".codePointAt(0)!)).toBe(30);
    expect(font0.glyphIndex("Å".codePointAt(0)!)).toBe(8);
    expect(font0.glyphIndex(0x10ffff)).toBe(0);
  });

  test("reads advance widths", () => {
    expect(font0.advance(30)).toBe(525);
    expect(font0.advance(136)).toBe(430);
  });
});

describe("flattenGlyph", () => {
  test("outlines a simple glyph", () => {
    expect(outline(font0, "H")).toStrictEqual({
      contours: 1,
      bounds: [52, 0, 473, 687],
    });
  });

  test("flattens curves to within the tolerance", () => {
    const { contours, bounds } = outline(font0, "o");
    expect(contours).toBe(2);
    const expected = [29, -12, 401, 539];
    bounds.forEach((value, i) =>
      expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(1)
    );
  });

  test("assembles composite glyphs from their parts", () => {
    expect(outline(composite, "Å").bounds).toStrictEqual([23, 0, 1203, 1935]);
    const { bounds } = outline(composite, "é");
    const expected = [78, -20, 922, 1537];
    bounds.forEach((value, i) =>
      expect(Math.abs(value - expected[i])).toBeLessThanOrEqual(1)
    );
  });

  test("glyphs without an outline have no contours", () => {
    expect(flattenGlyph(font0, font0.glyphIndex(32), 0.5)).toStrictEqual([]);
  });
});
