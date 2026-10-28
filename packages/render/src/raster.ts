/**
 * Anti-aliased polygon filling into a grid of printer dots.
 *
 * A raster samples shapes one of two ways:
 * - "center": a dot is printed when its center is inside the shape, which is
 *   how printers decide. Ink is 0 or 1.
 * - "coverage": each dot stores how much of it is covered, from 0 to 1, for
 *   smooth anti-aliased images.
 *
 * Coverage is computed exactly with signed-area accumulation, the technique
 * used by font-rs (https://github.com/raphlinus/font-rs): every edge adds the
 * area it covers in each dot to an accumulation buffer, and a running sum
 * along each row turns that into coverage.
 */

type Point = readonly [x: number, y: number];

/** One or more closed contours. Reverse a contour's direction to cut a hole. */
type Path = readonly (readonly Point[])[];

/** B draws ink, W removes it */
type Color = "B" | "W";

type Sampling = "center" | "coverage";

/** A rectangle of dots, from left and top up to but not including right and bottom */
type Dirty = { left: number; top: number; right: number; bottom: number };

/**
 * A rendered label: how much ink each dot gets, from 0 (blank) to 1
 * (printed), row by row
 */
class Raster {
  /** Ink per dot from 0 to 1, row by row */
  readonly ink: Float32Array;
  /** How many times the label prints in a row, from ^PQ */
  copies = 1;
  /**
   * Where drawing may have changed ink since this was last set, when set:
   * each draw grows it to hold the dots it can reach
   */
  dirty?: Dirty;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly sampling: Sampling = "coverage"
  ) {
    this.ink = new Float32Array(width * height);
  }

  /** Grow the dirty rectangle, if it's tracked, to hold an area of dots */
  touch(left: number, top: number, right: number, bottom: number): void {
    const { dirty } = this;
    if (!dirty) return;
    dirty.left = Math.max(0, Math.min(dirty.left, Math.floor(left)));
    dirty.top = Math.max(0, Math.min(dirty.top, Math.floor(top)));
    dirty.right = Math.min(this.width, Math.max(dirty.right, Math.ceil(right)));
    dirty.bottom = Math.min(
      this.height,
      Math.max(dirty.bottom, Math.ceil(bottom))
    );
  }
}

/**
 * Fill by sampling each dot's center: for every row, find where the edges
 * cross the row's center line and fill the dots between crossings with a
 * nonzero winding number.
 */
const fillCenters = (
  raster: Raster,
  path: Path,
  color: Color,
  dropouts: boolean
): void => {
  const { width, height } = raster;
  const value = color === "B" ? 1 : 0;

  // The edges that aren't horizontal, and the rows they span: only rows
  // whose center line the path crosses can get ink
  const edges: [x0: number, y0: number, x1: number, y1: number][] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const contour of path) {
    for (let i = 0; i < contour.length; i++) {
      const [x0, y0] = contour[i];
      const [x1, y1] = contour[(i + 1) % contour.length];
      if (y0 === y1) continue;
      edges.push([x0, y0, x1, y1]);
      minY = Math.min(minY, y0, y1);
      maxY = Math.max(maxY, y0, y1);
    }
  }
  const first = Math.max(0, Math.floor(minY - 0.5));
  const last = Math.min(height - 1, Math.ceil(maxY - 0.5));

  for (let row = first; row <= last; row++) {
    const yc = row + 0.5;
    const crossings: [x: number, winding: number][] = [];

    for (const [x0, y0, x1, y1] of edges) {
      // Half-open, so a point shared by two edges is counted once
      if ((y0 <= yc && yc < y1) || (y1 <= yc && yc < y0)) {
        crossings.push([
          x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0),
          y0 < y1 ? 1 : -1,
        ]);
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a[0] - b[0]);

    let winding = 0;
    for (let i = 0; i < crossings.length - 1; i++) {
      winding += crossings[i][1];
      if (winding === 0) continue;

      // Dots whose center lies between the two crossings
      const from = crossings[i][0];
      const to = crossings[i + 1][0];
      const start = Math.max(0, Math.ceil(from - 0.5));
      const end = Math.min(width, Math.ceil(to - 0.5));
      if (end > start) {
        raster.ink.fill(value, row * width + start, row * width + end);
      } else if (dropouts) {
        dropout(raster, Math.floor((from + to) / 2), row, value);
      }
    }
  }

  if (dropouts) fillColumnDropouts(raster, path, value);
};

const dropout = (raster: Raster, x: number, y: number, value: number) => {
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return;
  raster.ink[y * raster.width + x] = value;
};

/**
 * Dropout control for strokes thinner than a dot running across the rows:
 * the same as for each row, down each column's center line
 */
const fillColumnDropouts = (raster: Raster, path: Path, value: number) => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const contour of path) {
    for (const [x] of contour) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  const first = Math.max(0, Math.floor(minX));
  const last = Math.min(raster.width - 1, Math.ceil(maxX));
  for (let column = first; column <= last; column++) {
    const xc = column + 0.5;
    const crossings: [y: number, winding: number][] = [];
    for (const contour of path) {
      for (let i = 0; i < contour.length; i++) {
        const [x0, y0] = contour[i];
        const [x1, y1] = contour[(i + 1) % contour.length];
        if ((x0 <= xc && xc < x1) || (x1 <= xc && xc < x0)) {
          crossings.push([
            y0 + ((xc - x0) * (y1 - y0)) / (x1 - x0),
            x0 < x1 ? 1 : -1,
          ]);
        }
      }
    }
    if (crossings.length < 2) continue;
    crossings.sort((a, b) => a[0] - b[0]);

    let winding = 0;
    for (let i = 0; i < crossings.length - 1; i++) {
      winding += crossings[i][1];
      if (winding === 0) continue;
      const from = crossings[i][0];
      const to = crossings[i + 1][0];
      // Only spans that miss every dot center
      if (Math.ceil(to - 0.5) > Math.ceil(from - 0.5)) continue;
      dropout(raster, column, Math.floor((from + to) / 2), value);
    }
  }
};

/**
 * Accumulate one edge into `acc`, a buffer covering columns 0 to `width`
 * (plus a spare column) for rows `top` to `top + rows`. x must already be
 * within 0 and `width`.
 */
const accumulateLine = (
  acc: Float32Array,
  stride: number,
  top: number,
  rows: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void => {
  if (y0 === y1) return;

  let direction = 1;
  if (y0 > y1) {
    [x0, y0, x1, y1] = [x1, y1, x0, y0];
    direction = -1;
  }

  const dxdy = (x1 - x0) / (y1 - y0);
  let x = x0;

  // Clip to the rows the buffer covers
  const yStart = Math.max(y0, top);
  const yEnd = Math.min(y1, top + rows);
  if (yStart >= yEnd) return;
  x += (yStart - y0) * dxdy;

  for (let y = Math.floor(yStart); y < yEnd; y++) {
    const rowStart = (y - top) * stride;
    const dy = Math.min(y + 1, yEnd) - Math.max(y, yStart);
    const xNext = x + dxdy * dy;
    const d = dy * direction;
    const left = Math.min(x, xNext);
    const right = Math.max(x, xNext);
    const leftFloor = Math.floor(left);
    const rightCeil = Math.ceil(right);

    if (rightCeil <= leftFloor + 1) {
      // The edge stays within one dot in this row
      const middle = 0.5 * (x + xNext) - leftFloor;
      acc[rowStart + leftFloor] += d - d * middle;
      acc[rowStart + leftFloor + 1] += d * middle;
    } else {
      const s = 1 / (right - left);
      const leftFraction = left - leftFloor;
      const a0 = 0.5 * s * (1 - leftFraction) ** 2;
      const rightFraction = right - rightCeil + 1;
      const aEnd = 0.5 * s * rightFraction ** 2;

      acc[rowStart + leftFloor] += d * a0;

      if (rightCeil === leftFloor + 2) {
        acc[rowStart + leftFloor + 1] += d * (1 - a0 - aEnd);
      } else {
        const a1 = s * (1.5 - leftFraction);
        acc[rowStart + leftFloor + 1] += d * (a1 - a0);
        for (let xi = leftFloor + 2; xi < rightCeil - 1; xi++) {
          acc[rowStart + xi] += d * s;
        }
        const a2 = a1 + (rightCeil - leftFloor - 3) * s;
        acc[rowStart + rightCeil - 1] += d * (1 - a2 - aEnd);
      }
      acc[rowStart + rightCeil] += d * aEnd;
    }

    x = xNext;
  }
};

/**
 * Split an edge where it crosses x = 0 and x = width, and move the parts
 * outside onto those borders. Coverage stays exact: ink left of the raster
 * still fills the row from the left, and ink right of it is dropped.
 */
const clipEdgeX = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number
): [number, number, number, number][] => {
  const points: [number, number][] = [[x0, y0]];

  for (const border of [0, width]) {
    if ((x0 < border && x1 > border) || (x0 > border && x1 < border)) {
      const t = (border - x0) / (x1 - x0);
      points.push([border, y0 + t * (y1 - y0)]);
    }
  }
  points.push([x1, y1]);

  // Order the split points along the edge
  if (points.length > 2) {
    const inner = points.slice(1, -1);
    inner.sort((a, b) => Math.abs(a[0] - x0) - Math.abs(b[0] - x0));
    points.splice(1, inner.length, ...inner);
  }

  const clamp = (x: number) => Math.min(width, Math.max(0, x));
  const edges: [number, number, number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    edges.push([clamp(ax), ay, clamp(bx), by]);
  }
  return edges;
};

/**
 * Fill a path with ink (B) or remove ink (W), anti-aliased. Overlapping
 * contours in the same direction don't add up past full ink, and a contour in
 * the opposite direction cuts a hole.
 * @param options.dropouts With center sampling, print a dot where a stroke
 * thinner than a dot passes between dot centers, as font rasterizers do
 */
const fillPath = (
  raster: Raster,
  path: Path,
  color: Color,
  options: { dropouts?: boolean } = {}
): void => {
  if (raster.dirty) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const contour of path) {
      for (const [x, y] of contour) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    // A dot past the edges, for dropouts and the dots edges partly cover
    if (minX <= maxX) raster.touch(minX - 1, minY - 1, maxX + 2, maxY + 2);
  }

  if (raster.sampling === "center") {
    fillCenters(raster, path, color, options.dropouts ?? false);
    return;
  }

  const { width, height } = raster;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const contour of path) {
    for (const [, y] of contour) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const top = Math.max(0, Math.floor(minY));
  const bottom = Math.min(height, Math.ceil(maxY));
  if (top >= bottom) return;

  const rows = bottom - top;
  const stride = width + 2;
  const acc = new Float32Array(stride * rows);

  for (const contour of path) {
    for (let i = 0; i < contour.length; i++) {
      const [x0, y0] = contour[i];
      const [x1, y1] = contour[(i + 1) % contour.length];
      for (const edge of clipEdgeX(x0, y0, x1, y1, width)) {
        accumulateLine(acc, stride, top, rows, ...edge);
      }
    }
  }

  for (let row = 0; row < rows; row++) {
    let sum = 0;
    const accStart = row * stride;
    const inkStart = (top + row) * width;

    for (let x = 0; x < width; x++) {
      sum += acc[accStart + x];
      const coverage = Math.min(1, Math.abs(sum));
      if (coverage === 0) continue;

      const i = inkStart + x;
      raster.ink[i] =
        color === "B"
          ? raster.ink[i] + coverage * (1 - raster.ink[i])
          : raster.ink[i] * (1 - coverage);
    }
  }
};

export type { Point, Path, Color, Sampling, Dirty };
export { Raster, fillPath };
