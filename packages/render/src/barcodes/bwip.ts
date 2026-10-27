/**
 * bwip-js encoders, imported by name so bundlers leave out the 120-odd
 * symbologies we don't use. Named encoders only draw, so a drawing that
 * records lines and polygons at one pixel per module turns them back into
 * what bwip-js's raw() returns: module grids and bar widths.
 *
 * Where bwip-js places lines isn't documented, so its version is pinned:
 * bump it only when bwip.test.ts, which compares with raw(), still passes.
 */
import {
  azteccode,
  code128,
  databarexpanded,
  databarexpandedstacked,
  databarlimited,
  databaromni,
  databarstacked,
  databarstackedomni,
  databartruncated,
  datamatrix,
  maxicode,
  micropdf417,
  onecode,
  pdf417,
  planet,
  postnet,
  qrcode,
} from "bwip-js";
import type { Path } from "../raster.js";

const encoders = {
  azteccode,
  code128,
  databarexpanded,
  databarexpandedstacked,
  databarlimited,
  databaromni,
  databarstacked,
  databarstackedomni,
  databartruncated,
  datamatrix,
  micropdf417,
  pdf417,
  qrcode,
};

/** Encoders for bars of different heights */
const barEncoders = { onecode, planet, postnet };

type Bcid = keyof typeof encoders;
type Edge = [x0: number, y0: number, x1: number, y1: number];

/** "eclevel=Q compact" as bwip-js options */
const parseOptions = (options: string) =>
  Object.fromEntries(
    options
      .split(/\s+/)
      .filter(Boolean)
      .map((option) => {
        const [key, value] = option.split("=");
        return [key, value ?? true];
      })
  );

/** Draw a symbol into a grid of modules, row by row from the top */
const draw = (bcid: string, text: string, options: string) => {
  const encoder = encoders[bcid as Bcid];
  if (!encoder) throw new Error(`bwip-js encoder ${bcid} isn't included`);

  let width = 0;
  let height = 0;
  const edges: Edge[] = [];
  const outline = (points: number[][]) =>
    points.forEach(([x0, y0], i) => {
      const [x1, y1] = points[(i + 1) % points.length];
      edges.push([x0, y0, x1, y1]);
    });

  encoder({ ...parseOptions(options), bcid, text, scale: 1 }, {
    setopts() {},
    scale() {},
    measure: () => ({ width: 0, ascent: 0, descent: 0 }),
    init(w: number, h: number) {
      width = w;
      height = h;
    },
    // Bars are lines as wide as the bar, around their center rounded up,
    // or for GS1 DataBar, the center of the bar one module narrower
    line(x0: number, y0: number, x1: number, y1: number, lw: number) {
      const half = bcid.startsWith("databar")
        ? Math.floor((lw - 1) / 2)
        : Math.ceil(lw / 2);
      if (x0 === x1) {
        const left = x0 - half;
        outline([
          [left, y0],
          [left + lw, y0],
          [left + lw, y1],
          [left, y1],
        ]);
      } else {
        const top = y0 - half;
        outline([
          [x0, top],
          [x1, top],
          [x1, top + lw],
          [x0, top + lw],
        ]);
      }
    },
    polygon: outline,
    hexagon: outline,
    ellipse() {},
    fill() {},
    clip() {},
    unclip() {},
    text() {},
    end() {},
  } as never);

  // Symbols may be drawn larger than asked: a module is the largest size
  // every coordinate is a multiple of
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  let size = gcd(width, height);
  for (const edge of edges) for (const value of edge) size = gcd(size, value);
  const columns = width / size;
  const rows = height / size;

  // Even-odd fill at each module's center
  const modules = new Array<number>(columns * rows).fill(0);
  for (let row = 0; row < rows; row++) {
    const yc = (row + 0.5) * size;
    const crossings: number[] = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= yc && yc < y1) || (y1 <= yc && yc < y0)) {
        crossings.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = Math.max(0, Math.ceil(crossings[i] / size - 0.5));
      const end = Math.min(columns, Math.ceil(crossings[i + 1] / size - 0.5));
      for (let x = start; x < end; x++) modules[row * columns + x] = 1;
    }
  }
  return { modules, columns };
};

/** A 2D symbol's dark modules, row by row, as bwip-js's raw() pixs */
const encodeMatrix = (bcid: string, text: string, options = "") =>
  draw(bcid, text, options);

/** A linear symbol's bar and space widths in modules, as raw()'s sbs */
const encodeLinear = (bcid: string, text: string, options = "") => {
  // Bars may stop short of the bottom, so read the top row
  const { modules, columns } = draw(bcid, text, options);
  const widths: number[] = [];
  let last = 1;
  for (let x = 0; x < columns; x++) {
    const dark = modules[x];
    if (widths.length && dark === last) widths[widths.length - 1]++;
    else widths.push(1);
    last = dark;
  }
  return widths;
};

/**
 * MaxiCode's hexagons and bullseye as paths, fitted to a box from 0 to 1 in
 * each direction. Rings of the bullseye wind in turns, so a nonzero fill
 * leaves the gaps between them white.
 */
const encodeMaxiCode = (text: string, mode: number): Path => {
  const paths: [number, number][][] = [];
  maxicode(
    // Drawn large, as bwip-js rounds coordinates to half pixels
    { bcid: "maxicode", text, mode, parse: false, scale: 10 } as never,
    {
      setopts() {},
      scale() {},
      measure: () => ({ width: 0, ascent: 0, descent: 0 }),
      init() {},
      line() {},
      polygon(points: number[][]) {
        paths.push(points.map(([x, y]) => [x, y]));
      },
      hexagon(points: number[][]) {
        paths.push(points.map(([x, y]) => [x, y]));
      },
      ellipse(x: number, y: number, rx: number, ry: number, ccw: boolean) {
        const steps = 64;
        const points: [number, number][] = [];
        for (let i = 0; i < steps; i++) {
          const angle = ((ccw ? -i : i) / steps) * 2 * Math.PI;
          points.push([x + rx * Math.cos(angle), y + ry * Math.sin(angle)]);
        }
        paths.push(points);
      },
      fill() {},
      clip() {},
      unclip() {},
      text() {},
      end() {},
    } as never
  );

  const all = paths.flat();
  const minX = Math.min(...all.map(([x]) => x));
  const maxX = Math.max(...all.map(([x]) => x));
  const minY = Math.min(...all.map(([, y]) => y));
  const maxY = Math.max(...all.map(([, y]) => y));
  return paths.map((path) =>
    path.map(
      ([x, y]) =>
        [(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)] as const
    )
  );
};

/**
 * The bars of a postal code, left to right, with their bottoms and tops as
 * fractions of the tallest bar, measured from the bottom
 */
const encodeBars = (bcid: string, text: string, options = "") => {
  const encoder = barEncoders[bcid as keyof typeof barEncoders];
  if (!encoder) throw new Error(`bwip-js encoder ${bcid} isn't included`);

  let height = 0;
  const lines: { x: number; y0: number; y1: number }[] = [];
  // Drawn large, as bwip-js rounds coordinates to whole pixels
  encoder({ ...parseOptions(options), bcid, text, scale: 20 }, {
    setopts() {},
    scale() {},
    measure: () => ({ width: 0, ascent: 0, descent: 0 }),
    init(_w: number, h: number) {
      height = h;
    },
    line(x0: number, y0: number, x1: number, y1: number) {
      if (x0 === x1) {
        lines.push({ x: x0, y0: Math.min(y0, y1), y1: Math.max(y0, y1) });
      }
    },
    polygon() {},
    hexagon() {},
    ellipse() {},
    fill() {},
    clip() {},
    unclip() {},
    text() {},
    end() {},
  } as never);

  // y grows downwards from the top of the drawing
  const top = Math.min(...lines.map((line) => line.y0));
  const bottom = Math.max(...lines.map((line) => line.y1));
  const span = bottom - top || height;
  return lines
    .sort((a, b) => a.x - b.x)
    .map((line) => ({
      bottom: (bottom - line.y1) / span,
      top: (bottom - line.y0) / span,
    }));
};

export { encodeBars, encodeLinear, encodeMatrix, encodeMaxiCode };
