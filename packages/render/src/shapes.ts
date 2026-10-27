/**
 * Paths for ZPL's graphic elements, in dots. Geometry follows Zebra's ZPL II
 * Programming Guide and was checked against reference renders.
 */
import type { Path, Point } from "./raster.js";

/** How far a flattened curve may stray from the true curve, in dots */
const TOLERANCE = 0.01;

/**
 * Points along a quarter circle, with enough segments that the chords stay
 * within TOLERANCE of the true arc. Chords cut inside the curve, so too few
 * of them shrink circles and the holes inside rings.
 */
const arc = (cx: number, cy: number, r: number, start: number): Point[] => {
  const maxAngle =
    r > TOLERANCE ? 2 * Math.acos(1 - TOLERANCE / r) : Math.PI / 2;
  const steps = Math.max(2, Math.ceil(Math.PI / 2 / maxAngle));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = start + (i / steps) * (Math.PI / 2);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  });
};

/** A rectangle, with corners rounded by `r`, drawn clockwise */
const roundedRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): Point[] => {
  if (r <= 0) {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }

  r = Math.min(r, w / 2, h / 2);
  return [
    ...arc(x + w - r, y + r, r, -Math.PI / 2),
    ...arc(x + w - r, y + h - r, r, 0),
    ...arc(x + r, y + h - r, r, Math.PI / 2),
    ...arc(x + r, y + r, r, Math.PI),
  ];
};

/**
 * ^GB: a box whose line grows inward from its outer edge. A box narrower or
 * shorter than its line is enlarged to the line thickness. Corner rounding
 * from 0 to 8 gives a radius of rounding / 8 × half the shorter side.
 */
const boxPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  rounding: number
): Path => {
  const w = Math.max(width, thickness);
  const h = Math.max(height, thickness);
  const outer = roundedRect(x, y, w, h, (rounding / 8) * (Math.min(w, h) / 2));

  const innerW = w - 2 * thickness;
  const innerH = h - 2 * thickness;
  if (innerW <= 0 || innerH <= 0) return [outer];

  const inner = roundedRect(
    x + thickness,
    y + thickness,
    innerW,
    innerH,
    (rounding / 8) * (Math.min(innerW, innerH) / 2)
  );
  return [outer, inner.reverse()];
};

/**
 * ^GE: a ring whose line grows inward from the width and height, as thick
 * across as it is up and down
 */
const ellipsePath = (
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number
): Path => {
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  const cy = y + ry;
  // A circle's points, squashed into the ellipse
  const ellipse = (radiusX: number, radiusY: number): Point[] => {
    const r = Math.max(radiusX, radiusY);
    return [0, 1, 2, 3].flatMap((quarter) =>
      arc(0, 0, r, (quarter * Math.PI) / 2).map(
        ([px, py]) =>
          [cx + (px * radiusX) / r, cy + (py * radiusY) / r] as const
      )
    );
  };

  const innerX = rx - thickness;
  const innerY = ry - thickness;
  return innerX > 0 && innerY > 0
    ? [ellipse(rx, ry), ellipse(innerX, innerY).reverse()]
    : [ellipse(rx, ry)];
};

/** ^GC: a ring whose line grows inward from the diameter */
const circlePath = (
  x: number,
  y: number,
  diameter: number,
  thickness: number
): Path => ellipsePath(x, y, diameter, diameter, thickness);

/**
 * ^GD: a parallelogram whose rows are as wide as the line thickness. R leans
 * right (bottom-left to top-right), L leans left.
 */
const diagonalPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  direction: "R" | "L"
): Path =>
  direction === "R"
    ? [
        [
          [x, y + height],
          [x + thickness, y + height],
          [x + width + thickness, y],
          [x + width, y],
        ],
      ]
    : [
        [
          [x, y],
          [x + thickness, y],
          [x + width + thickness, y + height],
          [x + width, y + height],
        ],
      ];

export { boxPath, circlePath, diagonalPath, ellipsePath };
