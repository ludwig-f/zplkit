import ZplError from "./ZplError.js";

/**
 * A length with an explicit unit. Bare numbers are not accepted anywhere a
 * Length is expected, so mixing up millimeters and dots is a type error.
 */
type Length = { readonly mm: number } | { readonly dots: number };

const assertNonNegative = (value: number, unit: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new ZplError(`Length must be a non-negative number of ${unit}`);
  }
};

/**
 * A length in millimeters, converted to dots using the label's resolution
 */
const mm = (value: number): Length => {
  assertNonNegative(value, "millimeters");
  return { mm: value };
};

/**
 * A length in inches, converted to dots using the label's resolution
 */
const inches = (value: number): Length => {
  assertNonNegative(value, "inches");
  return { mm: value * 25.4 };
};

/**
 * A length in printer dots, ZPL's native unit
 */
const dots = (value: number): Length => {
  assertNonNegative(value, "dots");

  if (!Number.isInteger(value)) {
    throw new ZplError(`Dots must be a whole number, got ${value}`);
  }

  return { dots: value };
};

/**
 * Convert a length to dots
 * @param length Length to convert
 * @param dpmm Dots per millimeter of the printer
 */
const toDots = (length: Length, dpmm: number): number => {
  // Types require a Length, but JavaScript and unchecked code can leave one out
  if (typeof length !== "object" || length === null) {
    throw new ZplError(
      `Expected a length like mm(5) or dots(40), got ${String(length)}`
    );
  }
  return "dots" in length ? length.dots : Math.round(length.mm * dpmm);
};

export type { Length };
export { mm, inches, dots, toDots };
