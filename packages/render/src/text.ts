/**
 * Drawing text in ZPL's built-in fonts with open-licensed stand-ins.
 *
 * Font 0 is scalable: letter shapes come from Archivo, stretched to the
 * advance widths measured from reference renders of font 0, so text takes up the same
 * room as on a printer.
 *
 * Fonts A to H are bitmap fonts with fixed character cells that can only be
 * magnified in whole steps. Letter shapes come from DejaVu Sans Mono, placed
 * in each cell where reference renders print them.
 */
import { parseFont, flattenGlyph } from "./font.js";
import { font0Advances, font0Data, font0Ink } from "./fonts/font0.js";
import { dejavuMonoBoldData, dejavuMonoData } from "./fonts/dejavu.js";
import { fillPath } from "./raster.js";
import type { Font } from "./font.js";
import type { Color, Raster } from "./raster.js";

/** Font 0's capitals are three quarters of the character height */
const CAP_HEIGHT = 0.75;

/** What a character font 0 doesn't have advances, per 100 dots of width */
const MISSING_ADVANCE = 29.5;

const decodeBase64 = (data: string) =>
  Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

const cache = new Map<string, Font>();
const load = (name: string, data: string): Font => {
  let font = cache.get(name);
  if (!font) {
    font = parseFont(decodeBase64(data));
    cache.set(name, font);
  }
  return font;
};

let font0Widths: Map<number, number> | undefined;
const font0AdvanceTable = () =>
  (font0Widths ??= new Map(
    font0Advances.split(",").map((pair) => {
      const [code, width] = pair.split(":");
      return [parseInt(code, 36), Number(width)] as const;
    })
  ));

let font0InkExtents: Map<number, [number, number]> | undefined;
const font0InkTable = () =>
  (font0InkExtents ??= new Map(
    font0Ink.split(",").map((triple) => {
      const [code, left, right] = triple.split(":");
      return [parseInt(code, 36), [Number(left), Number(right)]] as const;
    })
  ));

/** Where a glyph's ink starts and ends, in font units */
const inkCache = new WeakMap<Font, Map<number, [number, number] | null>>();
const inkExtent = (font: Font, glyph: number) => {
  let extents = inkCache.get(font);
  if (!extents) inkCache.set(font, (extents = new Map()));
  if (!extents.has(glyph)) {
    const xs = flattenGlyph(font, glyph, 1).flatMap((contour) =>
      contour.map(([x]) => x)
    );
    extents.set(glyph, xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  }
  return extents.get(glyph);
};

/**
 * A bitmap font's character cell at magnification 1, in dots: from Zebra's
 * ZPL II Programming Guide (cell, gap, baseline) and reference renders (where H's
 * ink sits in the cell). Magnified letters are scaled, not their dots, so
 * the ink positions were measured at 10x and are fractions of a dot.
 */
type Cell = {
  width: number;
  height: number;
  gap: number;
  /** Rows from the top of the cell to the baseline (font E's is off the grid) */
  baseline: number;
  /** H's printed dots: first column, width, and first row */
  inkLeft: number;
  inkWidth: number;
  capTop: number;
  bold?: boolean;
  /** B has capitals only; H has capitals, digits and symbols only */
  letters?: "upper" | "no-lower";
};

const cells: Record<string, Cell> = {
  A: {
    width: 5,
    height: 9,
    gap: 1,
    baseline: 7,
    inkLeft: 0.3,
    inkWidth: 4.46,
    capTop: 0,
  },
  B: {
    width: 7,
    height: 11,
    gap: 2,
    baseline: 11,
    inkLeft: 0,
    inkWidth: 7.1,
    capTop: 0,
    bold: true,
    letters: "upper",
  },
  C: {
    width: 10,
    height: 18,
    gap: 2,
    baseline: 14,
    inkLeft: 0.4,
    inkWidth: 9,
    capTop: 0,
  },
  D: {
    width: 10,
    height: 18,
    gap: 2,
    baseline: 14,
    inkLeft: 0.4,
    inkWidth: 9,
    capTop: 0,
  },
  E: {
    width: 15,
    height: 28,
    gap: 5,
    baseline: 23.3,
    inkLeft: 0.8,
    inkWidth: 12.3,
    capTop: 3.26,
  },
  F: {
    width: 13,
    height: 26,
    gap: 3,
    baseline: 21,
    inkLeft: 0,
    inkWidth: 13.52,
    capTop: 0,
  },
  G: {
    width: 40,
    height: 60,
    gap: 8,
    baseline: 48,
    inkLeft: 4.5,
    inkWidth: 30.8,
    capTop: 0,
  },
  H: {
    width: 13,
    height: 21,
    gap: 6,
    baseline: 21,
    inkLeft: 0,
    inkWidth: 13.5,
    capTop: 0,
    letters: "no-lower",
  },
};

/** Fonts E and H have different cells on 6 and 12 dpmm printheads; scale them */
const cellFor = (name: string, dpmm: number): Cell | undefined => {
  const cell = cells[name];
  if (!cell || (name !== "E" && name !== "H") || dpmm === 8) return cell;

  const size: Record<string, Record<number, [number, number]>> = {
    E: { 6: [21, 10], 12: [42, 20], 24: [42, 20] },
    H: { 6: [17, 11], 12: [34, 22], 24: [34, 22] },
  };
  const [height, width] = size[name][dpmm] ?? [cell.height, cell.width];
  const sy = height / cell.height;
  const sx = width / cell.width;
  return {
    ...cell,
    width,
    height,
    gap: Math.round(cell.gap * sx),
    baseline: cell.baseline * sy,
    inkLeft: cell.inkLeft * sx,
    inkWidth: cell.inkWidth * sx,
    capTop: cell.capTop * sy,
  };
};

type Orientation = "N" | "R" | "I" | "B";

/** ^FB: wrap the text into lines within a block */
type TextBlockOptions = {
  width: number;
  maxLines: number;
  lineSpacing: number;
  justification: "L" | "C" | "R" | "J";
  hangingIndent: number;
};

type TextOptions = {
  x: number;
  /** Top of the text, or the baseline when fromBottom is set */
  y: number;
  fromBottom: boolean;
  font: string;
  /** Height and width as given in ^A or ^CF; either may be missing */
  height?: number;
  width?: number;
  /** A downloaded font to use instead of `font` */
  typeface?: Font;
  /** A font file to draw font 0 with instead of the stand-in */
  font0?: Font;
  orientation: Orientation;
  block?: TextBlockOptions;
  dpmm: number;
};

/** A glyph scaled from font units to dots, and where it sits from its pen position */
type Glyph = {
  font: Font;
  glyph: number;
  offset: number;
  scaleX: number;
  scaleY: number;
};

/** A font at a given size: how far each character advances, and its glyph */
type Face = {
  /** Height of a line and how far its top is above the baseline */
  height: number;
  ascent: number;
  advance: (char: string) => number;
  /** Undefined for characters that print nothing */
  glyph: (char: string) => Glyph | undefined;
};

const font0Face = (options: Pick<TextOptions, "height" | "width">): Face => {
  const font = load("0", font0Data);
  const advances = font0AdvanceTable();
  const inks = font0InkTable();
  // A missing dimension takes the other's value
  const height = options.height ?? options.width ?? 9;
  const width = options.width ?? height;
  const scaleY = (CAP_HEIGHT * height) / font.capHeight;

  return {
    height,
    ascent: CAP_HEIGHT * height,
    advance: (char) =>
      ((advances.get(char.codePointAt(0)!) ?? MISSING_ADVANCE) * width) / 100,
    glyph: (char) => {
      const code = char.codePointAt(0)!;
      const advance = advances.get(code);
      if (advance === undefined) return undefined;
      const glyph = font.glyphIndex(code);
      // Ink goes where font 0 prints it, so marks like - and | keep their
      // size. Characters whose stand-in shape differs, like 1 with its foot,
      // are stretched to fill their advance instead.
      const target = inks.get(code);
      const own = inkExtent(font, glyph);
      if (target && own && own[1] > own[0]) {
        const [left, right] = target.map((x) => (x * width) / 100);
        const scaleX = (right - left) / (own[1] - own[0]);
        return { font, glyph, offset: left - own[0] * scaleX, scaleY, scaleX };
      }
      const scaleX = (advance * width) / 100 / font.advance(glyph);
      return { font, glyph, offset: 0, scaleX, scaleY };
    },
  };
};

/**
 * Font 0 drawn with a font file passed in: sized like the stand-in, with
 * capitals three quarters of the height, and spaced by the font's own widths
 */
const font0FileFace = (
  font: Font,
  options: Pick<TextOptions, "height" | "width">
): Face => {
  const height = options.height ?? options.width ?? 9;
  const width = options.width ?? height;
  const scaleY = (CAP_HEIGHT * height) / font.capHeight;
  const scaleX = (scaleY * width) / height;
  const glyphOf = (char: string) => font.glyphIndex(char.codePointAt(0)!);

  return {
    height,
    ascent: CAP_HEIGHT * height,
    // Characters the font lacks print nothing, as with font 0
    advance: (char) => {
      const glyph = glyphOf(char);
      return glyph
        ? font.advance(glyph) * scaleX
        : (MISSING_ADVANCE * width) / 100;
    },
    glyph: (char) => {
      const glyph = glyphOf(char);
      return glyph ? { font, glyph, offset: 0, scaleX, scaleY } : undefined;
    },
  };
};

/** Whole-step magnification from 1 to 10 for a size in dots */
const magnification = (dots: number | undefined, base: number) =>
  dots === undefined
    ? undefined
    : Math.min(10, Math.max(1, Math.round(dots / base)));

const bitmapFace = (cell: Cell, magX: number, magY: number): Face => {
  const font = cell.bold
    ? load("mono-bold", dejavuMonoBoldData)
    : load("mono", dejavuMonoData);

  // Map the stand-in font's H onto where the printer's H sits in the cell
  const h = font.glyphIndex(0x48);
  const hPoints = font.outline(h).flat();
  const hLeft = Math.min(...hPoints.map((p) => p.x));
  const hRight = Math.max(...hPoints.map((p) => p.x));
  const scaleX = (cell.inkWidth * magX) / (hRight - hLeft);
  const scaleY = ((cell.baseline - cell.capTop) * magY) / font.capHeight;
  const offset = cell.inkLeft * magX - hLeft * scaleX;

  return {
    height: cell.height * magY,
    ascent: cell.baseline * magY,
    advance: () => (cell.width + cell.gap) * magX,
    glyph: (char) => {
      if (cell.letters === "upper") char = char.toUpperCase();
      if (cell.letters === "no-lower" && char !== char.toUpperCase()) {
        return undefined;
      }
      const glyph = font.glyphIndex(char.codePointAt(0)!);
      return { font, glyph, offset, scaleX, scaleY };
    },
  };
};

/** A glyph placed in the text block: along the baseline, and which baseline */
type PlacedGlyph = Glyph & { pen: number; baseline: number };

/** Text laid out unrotated, with the first baseline at 0 */
type TextBlock = {
  glyphs: PlacedGlyph[];
  /** Size of the block, and how far its top is above the first baseline */
  width: number;
  height: number;
  ascent: number;
  /** The baseline ^FT positions */
  lastBaseline: number;
};

const advanceOf = (face: Face, text: string) => {
  let advance = 0;
  for (const char of text) advance += face.advance(char);
  return advance;
};

/** Place a line's glyphs from pen position `start`, widening its spaces by `extra` */
const placeLine = (
  face: Face,
  text: string,
  start: number,
  baseline: number,
  extra = 0
): PlacedGlyph[] => {
  const glyphs: PlacedGlyph[] = [];
  let pen = start;
  for (const char of text) {
    const glyph = face.glyph(char);
    if (glyph) glyphs.push({ ...glyph, pen: pen + glyph.offset, baseline });
    pen += face.advance(char);
    if (char === " ") pen += extra;
  }
  return glyphs;
};

const layoutLine = (face: Face, text: string): TextBlock => ({
  glyphs: placeLine(face, text, 0, 0),
  // Printers turn the line as a block one dot short of its advance
  width: Math.ceil(advanceOf(face, text) - 1e-9) - 1,
  height: face.height,
  ascent: face.ascent,
  lastBaseline: 0,
});

type Line = {
  text: string;
  /** Whether the line ended at a space, which counts when aligning it */
  trailingSpace: boolean;
  /** Whether \& ended the line */
  broken: boolean;
};

/**
 * Wrap text into lines no wider than the block: at spaces, or between
 * letters for words that don't fit on a line of their own. \& breaks a line.
 */
const wrap = (face: Face, text: string, block: TextBlockOptions): Line[] => {
  const lines: Line[] = [];
  const paragraphs = text.split("\\&");

  paragraphs.forEach((paragraph, p) => {
    const broken = p < paragraphs.length - 1;
    const room = () =>
      block.width - (lines.length > 0 ? block.hangingIndent : 0);
    let line = "";
    let pending = "";

    const finish = (trailingSpace: boolean, lineBroken: boolean) => {
      lines.push({ text: line, trailingSpace, broken: lineBroken });
      line = "";
      pending = "";
    };

    for (const token of paragraph.split(/( +)/)) {
      if (token === "") continue;
      if (token.startsWith(" ")) {
        // Spaces at the start of a line don't print
        if (line) pending = token;
        continue;
      }
      if (line && advanceOf(face, line + pending + token) <= room()) {
        line += pending + token;
        pending = "";
        continue;
      }
      if (line) finish(true, false);
      // A word that doesn't fit on a line of its own breaks between letters
      for (const char of token) {
        if (line && advanceOf(face, line + char) > room()) {
          finish(false, false);
        }
        line += char;
      }
    }
    lines.push({ text: line, trailingSpace: pending !== "", broken });
  });

  return lines;
};

const layoutBlock = (
  face: Face,
  text: string,
  block: TextBlockOptions
): TextBlock => {
  const pitch = face.height + block.lineSpacing;
  const lines = wrap(face, text, block);
  const space = face.advance(" ");
  const glyphs: PlacedGlyph[] = [];

  lines.forEach((line, i) => {
    // Lines past the last print over it
    const baseline = Math.min(i, block.maxLines - 1) * pitch;
    const advance = advanceOf(face, line.text);
    const indent = i > 0 ? block.hangingIndent : 0;
    const last = i === lines.length - 1;

    let start = 0;
    let extra = 0;
    switch (block.justification) {
      case "L":
        start = indent;
        break;
      case "J": {
        start = indent;
        const gaps = line.text.split(" ").length - 1;
        if (!last && gaps > 0) {
          extra = (block.width - indent - advance) / gaps;
        }
        break;
      }
      case "R":
        // Right-aligned lines round up, centered ones to the nearest dot
        start = Math.ceil(
          block.width - advance - (line.trailingSpace ? space : 0) - 1e-9
        );
        break;
      case "C": {
        // Centering counts a space after the line, unless \& ended it
        const counted = line.trailingSpace || (last && !line.broken);
        start = Math.round((block.width - advance - (counted ? space : 0)) / 2);
        break;
      }
    }
    glyphs.push(...placeLine(face, line.text, start, baseline, extra));
  });

  return {
    glyphs,
    width: block.width,
    height: block.maxLines * pitch,
    ascent: face.ascent,
    lastBaseline: (block.maxLines - 1) * pitch,
  };
};

/**
 * Where a point of the text block lands on the label, given its distance u
 * along the baseline and v below the first baseline. Printers turn the
 * laid-out block in whole dots: ^FO puts the turned block's top-left corner
 * at the origin, ^FT turns it about the start of the last baseline.
 */
const placement = (
  block: Pick<TextBlock, "width" | "height" | "ascent" | "lastBaseline">,
  options: Pick<TextOptions, "x" | "y" | "fromBottom" | "orientation">
): Place => {
  const { x, y } = options;
  if (options.fromBottom) {
    const last = block.lastBaseline;
    switch (options.orientation) {
      case "R":
        return (u, v) => [x - v + last, y + u];
      case "I":
        return (u, v) => [x - u, y - v + last];
      case "B":
        return (u, v) => [x + v - last, y - u];
      default:
        return (u, v) => [x + u, y + v - last];
    }
  }

  const { width, height, ascent } = block;
  switch (options.orientation) {
    case "R":
      return (u, v) => [x + height - ascent - v, y + u];
    case "I":
      return (u, v) => [x + width - u, y + height - ascent - v];
    case "B":
      return (u, v) => [x + ascent + v, y + width - u];
    default:
      return (u, v) => [x + u, y + ascent + v];
  }
};

/**
 * A downloaded TrueType font: the em is the character height, stretched to
 * the width, with the baseline three quarters down as for font 0
 */
const trueTypeFace = (
  font: Font,
  options: Pick<TextOptions, "height" | "width">
): Face => {
  const height = options.height ?? options.width ?? 9;
  const width = options.width ?? height;
  const scaleX = width / font.unitsPerEm;
  const scaleY = height / font.unitsPerEm;
  const glyphOf = (char: string) => font.glyphIndex(char.codePointAt(0)!);

  return {
    height,
    ascent: CAP_HEIGHT * height,
    advance: (char) => font.advance(glyphOf(char)) * scaleX,
    // Characters the font lacks print its missing glyph
    glyph: (char) => ({
      font,
      glyph: glyphOf(char),
      offset: 0,
      scaleX,
      scaleY,
    }),
  };
};

/** A built-in font at the size given in ^A or ^CF */
const faceFor = (
  options: Pick<
    TextOptions,
    "font" | "height" | "width" | "typeface" | "font0" | "dpmm"
  >
): Face => {
  if (options.typeface) return trueTypeFace(options.typeface, options);
  const cell = cellFor(options.font, options.dpmm);
  // Font 0 stands in for fonts we don't have yet
  if (!cell) {
    return options.font0
      ? font0FileFace(options.font0, options)
      : font0Face(options);
  }

  // A missing dimension takes the other's magnification
  const givenY = magnification(options.height, cell.height);
  const givenX = magnification(options.width, cell.width);
  return bitmapFace(cell, givenX ?? givenY ?? 1, givenY ?? givenX ?? 1);
};

/** A bitmap font scaled freely, as for barcode interpretation lines */
const scaledFace = (font: string, scale: number, dpmm: number): Face =>
  bitmapFace(cellFor(font, dpmm)!, scale, scale);

/** Draw text in one of the built-in fonts, on one line or wrapped in a block */
const drawText = (
  raster: Raster,
  text: string,
  options: TextOptions,
  color: Color
): void => {
  const face = faceFor(options);
  const block = options.block
    ? layoutBlock(face, text, options.block)
    : layoutLine(face, text);
  drawGlyphs(raster, block.glyphs, placement(block, options), color);
};

type Place = (u: number, v: number) => readonly [number, number];

/** Fill placed glyphs, mapping text coordinates onto the label with `place` */
const drawGlyphs = (
  raster: Raster,
  glyphs: PlacedGlyph[],
  place: Place,
  color: Color
): void => {
  for (const { font, glyph, pen, baseline, scaleX, scaleY } of glyphs) {
    const contours = flattenGlyph(font, glyph, 0.1 / scaleY).map((contour) =>
      contour.map(([gx, gy]) =>
        place(pen + gx * scaleX, baseline - gy * scaleY)
      )
    );
    if (contours.length) fillPath(raster, contours, color, { dropouts: true });
  }
};

export type { Face, Orientation, Place, PlacedGlyph, TextBlockOptions };
export { drawText, drawGlyphs, faceFor, scaledFace, placeLine, placement };
