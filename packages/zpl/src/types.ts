import type { Length } from "./units.js";

/**
 * A 1-bit image as ASCII hex, e.g. the result of ImageConverter.toZPL
 */
type Graphic = {
  /** Size of the graphic data in bytes */
  totalBytes: number;
  /** Bytes in each row, 8 dots to a byte */
  bytesPerRow: number;
  /** The image as hex, optionally compressed */
  data: string;
};

enum ZebraFontFamily {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  H = "H",
  P = "P",
  Q = "Q",
  R = "R",
  S = "S",
  T = "T",
  U = "U",
  V = "V",
  ZERO = "0",
}

enum Orientation {
  Normal = "N",
  Rotated90Degrees = "R",
  Inverted180Degrees = "I",
  BottomUp270Degrees = "B",
}

/** Where an element starts, measured from the label home */
type Position = {
  /** Distance from the left */
  x: Length;
  /** Distance from the top */
  y: Length;
};

export type { Graphic, Position };
export { ZebraFontFamily, Orientation };
