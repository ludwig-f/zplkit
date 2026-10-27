import ZplError from "./ZplError.js";

/**
 * A length with an explicit unit. Bare numbers are not accepted anywhere a
 * Length is expected, so mixing up units is a type error.
 */
type Length =
  | { readonly mm: number }
  | { readonly inches: number }
  | { readonly dots: number };

/**
 * The dots per inch printers are sold as, for each dots per millimeter. They
 * aren't exact conversions (8 dpmm is 203.2 dpi), but labels are measured
 * with them: a 4 inch label at 203 dpi is 812 dots wide.
 */
const dpiByDpmm: Record<number, number> = { 6: 152, 8: 203, 12: 300, 24: 600 };

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
 * A length in inches, converted to dots with the printer's dots per inch,
 * so 6 inches at 300 dpi is 1800 dots
 */
const inches = (value: number): Length => {
  assertNonNegative(value, "inches");
  return { inches: value };
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
  if ("dots" in length) return length.dots;
  if ("inches" in length) {
    return Math.round(length.inches * (dpiByDpmm[dpmm] ?? dpmm * 25.4));
  }
  return Math.round(length.mm * dpmm);
};

export type { Length };
export { mm, inches, dots, toDots };
