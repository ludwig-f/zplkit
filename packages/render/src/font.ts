/**
 * A small TrueType reader: character mapping (cmap formats 4 and 12),
 * advance widths (hmtx) and glyph outlines (glyf), including composite
 * glyphs. Enough to draw text; hinting and kerning aren't applied.
 */
import type { Point } from "./raster.js";

type Font = {
  unitsPerEm: number;
  capHeight: number;
  numGlyphs: number;
  /** Glyph for a Unicode code point, 0 (the missing glyph) if there is none */
  glyphIndex: (codePoint: number) => number;
  /** Advance width of a glyph, in font units */
  advance: (glyph: number) => number;
  /** Raw outline of a glyph, before flattening */
  outline: (glyph: number) => Contour[];
};

/** A closed contour of on-curve points and quadratic control points */
type Contour = { x: number; y: number; onCurve: boolean }[];

const parseFont = (bytes: Uint8Array): Font => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => view.getUint16(o);
  const i16 = (o: number) => view.getInt16(o);
  const u32 = (o: number) => view.getUint32(o);

  const tables = new Map<string, number>();
  const numTables = u16(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    tables.set(tag, u32(record + 8));
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Font has no ${tag} table`);
    return offset;
  };

  const head = table("head");
  const unitsPerEm = u16(head + 18);
  const longLoca = i16(head + 50) === 1;
  const numGlyphs = u16(table("maxp") + 4);
  const numberOfHMetrics = u16(table("hhea") + 34);
  const hmtx = table("hmtx");
  const loca = table("loca");
  const glyf = table("glyf");
  const os2 = tables.get("OS/2");
  // Read once the glyphs are available: fonts with an older OS/2 table don't
  // state the capital height, so it's measured from H instead
  let capHeight: number | undefined =
    os2 !== undefined && u16(os2) >= 2 ? i16(os2 + 88) : undefined;

  // Character to glyph mapping: prefer the full Unicode table (format 12)
  const cmap = table("cmap");
  let format4: number | undefined;
  let format12: number | undefined;
  for (let i = 0; i < u16(cmap + 2); i++) {
    const record = cmap + 4 + i * 8;
    const platform = u16(record);
    const encoding = u16(record + 2);
    const subtable = cmap + u32(record + 4);
    const format = u16(subtable);
    const unicode =
      platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) format12 ??= subtable;
    if (format === 4) format4 ??= subtable;
  }

  const glyphIndex = (codePoint: number): number => {
    if (format12 !== undefined) {
      const groups = u32(format12 + 12);
      for (let i = 0; i < groups; i++) {
        const group = format12 + 16 + i * 12;
        const start = u32(group);
        if (codePoint >= start && codePoint <= u32(group + 4)) {
          return u32(group + 8) + codePoint - start;
        }
      }
      return 0;
    }
    if (format4 !== undefined && codePoint <= 0xffff) {
      const segments = u16(format4 + 6) / 2;
      const ends = format4 + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let i = 0; i < segments; i++) {
        if (codePoint > u16(ends + i * 2)) continue;
        const start = u16(starts + i * 2);
        if (codePoint < start) return 0;
        const rangeOffset = u16(rangeOffsets + i * 2);
        if (rangeOffset === 0)
          return (codePoint + i16(deltas + i * 2)) & 0xffff;
        const glyph = u16(
          rangeOffsets + i * 2 + rangeOffset + (codePoint - start) * 2
        );
        return glyph === 0 ? 0 : (glyph + i16(deltas + i * 2)) & 0xffff;
      }
    }
    return 0;
  };

  const advance = (glyph: number): number =>
    u16(hmtx + Math.min(glyph, numberOfHMetrics - 1) * 4);

  const glyphOffset = (glyph: number): [number, number] =>
    longLoca
      ? [u32(loca + glyph * 4), u32(loca + glyph * 4 + 4)]
      : [u16(loca + glyph * 2) * 2, u16(loca + glyph * 2 + 2) * 2];

  const outline = (glyph: number, depth = 0): Contour[] => {
    const [start, end] = glyphOffset(glyph);
    if (start === end || depth > 8) return [];
    const offset = glyf + start;
    const numberOfContours = i16(offset);

    if (numberOfContours < 0) {
      // Composite glyph: transformed copies of other glyphs
      const contours: Contour[] = [];
      let p = offset + 10;
      let flags: number;
      do {
        flags = u16(p);
        const component = u16(p + 2);
        p += 4;
        let dx: number;
        let dy: number;
        if (flags & 1) {
          dx = i16(p);
          dy = i16(p + 2);
          p += 4;
        } else {
          dx = view.getInt8(p);
          dy = view.getInt8(p + 1);
          p += 2;
        }
        let [a, b, c, d] = [1, 0, 0, 1];
        const f2dot14 = (o: number) => i16(o) / 16384;
        if (flags & 8) {
          a = d = f2dot14(p);
          p += 2;
        } else if (flags & 64) {
          a = f2dot14(p);
          d = f2dot14(p + 2);
          p += 4;
        } else if (flags & 128) {
          [a, b, c, d] = [
            f2dot14(p),
            f2dot14(p + 2),
            f2dot14(p + 4),
            f2dot14(p + 6),
          ];
          p += 8;
        }
        // Offsets given as point numbers instead of x/y aren't supported
        if (!(flags & 2)) dx = dy = 0;

        for (const contour of outline(component, depth + 1)) {
          contours.push(
            contour.map((pt) => ({
              x: a * pt.x + c * pt.y + dx,
              y: b * pt.x + d * pt.y + dy,
              onCurve: pt.onCurve,
            }))
          );
        }
      } while (flags & 32);
      return contours;
    }

    // Simple glyph
    const endPoints = Array.from({ length: numberOfContours }, (_, i) =>
      u16(offset + 10 + i * 2)
    );
    const pointCount = numberOfContours
      ? endPoints[numberOfContours - 1] + 1
      : 0;
    let p = offset + 10 + numberOfContours * 2;
    p += 2 + u16(p); // skip instructions

    const flags: number[] = [];
    while (flags.length < pointCount) {
      const flag = bytes[p++];
      flags.push(flag);
      if (flag & 8) {
        for (let r = bytes[p++]; r > 0; r--) flags.push(flag);
      }
    }

    const coordinates = (short: number, same: number): number[] => {
      let value = 0;
      return flags.map((flag) => {
        if (flag & short) {
          const delta = bytes[p++];
          value += flag & same ? delta : -delta;
        } else if (!(flag & same)) {
          value += i16(p);
          p += 2;
        }
        return value;
      });
    };
    const xs = coordinates(2, 16);
    const ys = coordinates(4, 32);

    const contours: Contour[] = [];
    let first = 0;
    for (const last of endPoints) {
      contours.push(
        xs.slice(first, last + 1).map((x, i) => ({
          x,
          y: ys[first + i],
          onCurve: Boolean(flags[first + i] & 1),
        }))
      );
      first = last + 1;
    }
    return contours;
  };

  if (capHeight === undefined) {
    const h = outline(glyphIndex(0x48));
    const ys = h.flatMap((contour) => contour.map((pt) => pt.y));
    capHeight = ys.length ? Math.max(...ys) : Math.round(unitsPerEm * 0.7);
  }

  return {
    unitsPerEm,
    capHeight,
    numGlyphs,
    glyphIndex,
    advance,
    outline: (glyph) => outline(glyph),
  };
};

/**
 * A glyph's outline as polygons in font units (y up), with curves flattened
 * so they stray at most `tolerance` font units from the true curve.
 */
const flattenGlyph = (
  font: Font,
  glyph: number,
  tolerance: number
): Point[][] =>
  font.outline(glyph).flatMap((contour) => {
    if (contour.length < 2) return [];

    // Start from an on-curve point; between two off-curve points there's an
    // implied on-curve point halfway
    let startIndex = contour.findIndex((pt) => pt.onCurve);
    let start: { x: number; y: number };
    if (startIndex === -1) {
      const [a, b] = contour;
      start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      startIndex = 0;
    } else {
      start = contour[startIndex];
    }

    const points: Point[] = [[start.x, start.y]];
    let current = start;
    let control: { x: number; y: number } | undefined;

    const curveTo = (
      c: { x: number; y: number },
      end: { x: number; y: number }
    ) => {
      // Enough segments that the flattened curve stays within tolerance
      const deviation =
        Math.hypot(current.x - 2 * c.x + end.x, current.y - 2 * c.y + end.y) /
        4;
      const steps = Math.max(1, Math.ceil(Math.sqrt(deviation / tolerance)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        points.push([
          u * u * current.x + 2 * u * t * c.x + t * t * end.x,
          u * u * current.y + 2 * u * t * c.y + t * t * end.y,
        ]);
      }
      current = end;
    };

    for (let k = 1; k <= contour.length; k++) {
      const pt = contour[(startIndex + k) % contour.length];
      const end = k === contour.length ? start : pt;
      if (k === contour.length) {
        if (control) curveTo(control, start);
        break;
      }
      if (pt.onCurve) {
        if (control) {
          curveTo(control, end);
          control = undefined;
        } else {
          points.push([pt.x, pt.y]);
          current = pt;
        }
      } else if (control) {
        const midpoint = {
          x: (control.x + pt.x) / 2,
          y: (control.y + pt.y) / 2,
        };
        curveTo(control, midpoint);
        control = pt;
      } else {
        control = pt;
      }
    }

    return [points];
  });

export type { Font, Contour };
export { parseFont, flattenGlyph };
