import { describe, test, expect } from "vitest";
import { Raster, fillPath } from "./raster.js";
import type { Path } from "./raster.js";

const rect = (x0: number, y0: number, x1: number, y1: number): Path => [
  [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
];

/** Ink of each dot, rounded, as rows for readable expectations */
const rows = (raster: Raster) =>
  Array.from({ length: raster.height }, (_, y) =>
    Array.from(
      { length: raster.width },
      (_, x) => Math.round(raster.ink[y * raster.width + x] * 100) / 100
    )
  );

const total = (raster: Raster) => raster.ink.reduce((sum, v) => sum + v, 0);

describe("fillPath", () => {
  test("fills a rectangle on dot boundaries exactly", () => {
    const raster = new Raster(5, 4);
    fillPath(raster, rect(1, 1, 4, 3), "B");

    expect(rows(raster)).toStrictEqual([
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ]);
  });

  test("dots partly covered get partial ink", () => {
    const raster = new Raster(3, 1);
    fillPath(raster, rect(0.5, 0, 2.5, 1), "B");

    expect(rows(raster)).toStrictEqual([[0.5, 1, 0.5]]);
  });

  test("gives the same result for either contour direction", () => {
    const clockwise = new Raster(6, 6);
    const counterClockwise = new Raster(6, 6);
    fillPath(clockwise, rect(1.3, 0.7, 4.6, 5.2), "B");
    fillPath(
      counterClockwise,
      [[...rect(1.3, 0.7, 4.6, 5.2)[0]].reverse()],
      "B"
    );

    expect(rows(clockwise)).toStrictEqual(rows(counterClockwise));
  });

  test("a reversed inner contour cuts a hole", () => {
    const raster = new Raster(5, 5);
    fillPath(
      raster,
      [rect(0, 0, 5, 5)[0], [...rect(1, 1, 4, 4)[0]].reverse()],
      "B"
    );

    expect(rows(raster)).toStrictEqual([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
  });

  test("overlapping contours don't add up to more than full ink", () => {
    const raster = new Raster(4, 1);
    fillPath(raster, [rect(0, 0, 3, 1)[0], rect(1, 0, 4, 1)[0]], "B");

    expect(rows(raster)).toStrictEqual([[1, 1, 1, 1]]);
  });

  test("the ink of a diagonal shape equals its area", () => {
    const raster = new Raster(10, 10);
    fillPath(
      raster,
      [
        [
          [1, 1],
          [9, 3],
          [4, 8.5],
        ],
      ],
      "B"
    );

    // Shoelace area of the triangle
    const area = Math.abs((9 - 1) * (8.5 - 1) - (4 - 1) * (3 - 1)) / 2;
    expect(total(raster)).toBeCloseTo(area, 5);
  });

  test("shapes are clipped to the raster", () => {
    const raster = new Raster(4, 4);
    fillPath(raster, rect(-2, -3, 2.5, 10), "B");

    expect(rows(raster)).toStrictEqual([
      [1, 1, 0.5, 0],
      [1, 1, 0.5, 0],
      [1, 1, 0.5, 0],
      [1, 1, 0.5, 0],
    ]);
  });

  test("slanted edges crossing the left side keep their slope", () => {
    const raster = new Raster(4, 4);
    // The edge from (4, 0) to (-4, 8) runs along x = 4 - y inside the raster
    fillPath(
      raster,
      [
        [
          [-4, 0],
          [4, 0],
          [-4, 8],
        ],
      ],
      "B"
    );

    expect(total(raster)).toBeCloseTo(8, 5);
  });

  test("shapes past the right side don't spill into the next row", () => {
    const raster = new Raster(4, 2);
    fillPath(raster, rect(2.5, 0, 10, 1), "B");

    expect(rows(raster)).toStrictEqual([
      [0, 0, 0.5, 1],
      [0, 0, 0, 0],
    ]);
  });

  test("shapes entirely outside the raster draw nothing", () => {
    const raster = new Raster(4, 4);
    fillPath(raster, rect(5, 5, 9, 9), "B");
    fillPath(raster, rect(-9, -9, -5, -5), "B");

    expect(total(raster)).toBe(0);
  });

  test("white removes ink", () => {
    const raster = new Raster(4, 1);
    fillPath(raster, rect(0, 0, 4, 1), "B");
    fillPath(raster, rect(1, 0, 3, 1), "W");

    expect(rows(raster)).toStrictEqual([[1, 0, 0, 1]]);
  });
});

describe("fillPath with center sampling", () => {
  test("prints a dot when its center is inside the shape", () => {
    const raster = new Raster(3, 1, "center");
    fillPath(raster, rect(0.4, 0, 1.6, 1), "B");

    // Centers at 0.5 and 1.5 are inside; 2.5 isn't
    expect(rows(raster)).toStrictEqual([[1, 1, 0]]);
  });

  test("a dot whose center is just outside a curved edge stays white", () => {
    const raster = new Raster(20, 20, "center");
    // A ring like ^GC20,3: outer radius 10, inner radius 7, centered at (10, 10)
    const circle = (r: number) =>
      Array.from({ length: 64 }, (_, i) => {
        const a = (i / 64) * 2 * Math.PI;
        return [10 + r * Math.cos(a), 10 + r * Math.sin(a)] as const;
      });
    fillPath(raster, [circle(10), circle(7).reverse()], "B");

    // The dot at (3, 7) has its center 6.96 from the middle: inside the hole
    expect(raster.ink[7 * 20 + 3]).toBe(0);
    expect(raster.ink[7 * 20 + 2]).toBe(1);
  });

  test("holes and white work the same way", () => {
    const raster = new Raster(5, 1, "center");
    fillPath(raster, rect(0, 0, 5, 1), "B");
    fillPath(raster, rect(1, 0, 3, 1), "W");

    expect(rows(raster)).toStrictEqual([[1, 0, 0, 1, 1]]);
  });
});

describe("fillPath with dropout control", () => {
  const rect = (x0: number, y0: number, x1: number, y1: number): Path => [
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  ];
  const dotsOf = (raster: Raster) =>
    Array.from(raster.ink.entries())
      .filter(([, ink]) => ink === 1)
      .map(([i]) => [i % raster.width, Math.floor(i / raster.width)]);

  test("prints a stem narrower than a dot that misses every center", () => {
    const raster = new Raster(6, 6, "center");
    fillPath(raster, rect(2.55, 1, 3.3, 4), "B", { dropouts: true });
    expect(dotsOf(raster)).toStrictEqual([
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
  });

  test("prints a thin horizontal stroke too", () => {
    const raster = new Raster(6, 6, "center");
    fillPath(raster, rect(1, 2.55, 4, 3.3), "B", { dropouts: true });
    expect(dotsOf(raster)).toStrictEqual([
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
  });

  test("leaves strokes that cover a center alone", () => {
    const raster = new Raster(6, 6, "center");
    fillPath(raster, rect(1.2, 1, 2.8, 3), "B", { dropouts: true });
    expect(dotsOf(raster)).toStrictEqual([
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ]);
  });

  test("is off by default", () => {
    const raster = new Raster(6, 6, "center");
    fillPath(raster, rect(2.6, 1, 3.4, 4), "B");
    expect(dotsOf(raster)).toStrictEqual([]);
  });
});
