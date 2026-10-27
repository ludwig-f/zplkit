import type { LabelLength } from "./share";
import type { Unit } from "./settings";

/**
 * The dots per inch printers are sold as, for each dots per millimeter.
 * Labels are measured with them: a 4 inch label at 203 dpi is 812 dots.
 */
const dpiFor = (dpmm: number): number =>
  ({ 6: 152, 8: 203, 12: 300, 24: 600 }[dpmm] ?? dpmm * 25.4);

/**
 * A label side in millimeters, for the renderer. Inches use the printer's
 * dpi, so 6 in at 300 dpi is exactly 1800 dots.
 */
const toMm = (length: LabelLength, dpmm: number): number =>
  "mm" in length ? length.mm : Math.round(length.inches * dpiFor(dpmm)) / dpmm;

/** Dots in a unit */
const fromDots = (dots: number, unit: Unit, dpmm: number): number =>
  unit === "dots" ? dots : unit === "mm" ? dots / dpmm : dots / dpiFor(dpmm);

/** Inches show two decimals, millimeters one, dots none */
const decimals: Record<Unit, number> = { mm: 1, in: 2, dots: 0 };

/** Dots as a number in a unit, like 101.5 for 812 dots in mm at 8 dpmm */
const formatDots = (dots: number, unit: Unit, dpmm: number): string =>
  fromDots(dots, unit, dpmm).toFixed(decimals[unit]);

/** A label's size in a unit, like "4.00 × 6.00 in" */
const formatSize = (
  widthDots: number,
  heightDots: number,
  unit: Unit,
  dpmm: number
): string =>
  `${formatDots(widthDots, unit, dpmm)} × ${formatDots(
    heightDots,
    unit,
    dpmm
  )} ${unit}`;

/** A length typed in a unit. Dots are kept as the length they are now. */
const toLength = (value: number, unit: Unit, dpmm: number): LabelLength =>
  unit === "in"
    ? { inches: value }
    : { mm: unit === "mm" ? value : value / dpmm };

/** A label side as a number in a unit, for the custom size fields */
const lengthIn = (length: LabelLength, unit: Unit, dpmm: number): number =>
  unit === "in" && "inches" in length
    ? length.inches
    : fromDots(Math.round(toMm(length, dpmm) * dpmm), unit, dpmm);

type Tick = {
  /** Where the tick is, in the ruler's unit */
  at: number;
  kind: "major" | "mid" | "minor";
  /** The number shown at major ticks */
  label?: number;
};

/** The steps between ticks, in the ruler's unit */
const stepsFor = (length: number, unit: Unit) => {
  if (unit === "in") {
    const minor = length > 8 ? 1 / 4 : 1 / 8;
    return { minor, mid: 1 / 2, major: 1 };
  }
  if (unit === "mm") {
    return { minor: length > 120 ? 5 : 1, mid: 5, major: 10 };
  }
  // Dots: round numbers, with at most ten labels
  const major =
    [50, 100, 200, 250, 500, 1000, 2000].find((step) => length / step <= 10) ??
    5000;
  return { minor: major / 10, mid: major / 2, major };
};

/** The ticks of a ruler as long as a label side, in a unit */
const ticksFor = (length: number, unit: Unit): Tick[] => {
  const { minor, mid, major } = stepsFor(length, unit);
  const count = Math.floor(length / minor + 1e-9);
  const perMajor = Math.round(major / minor);
  const perMid = Math.round(mid / minor);
  return Array.from({ length: count + 1 }, (_, index) => {
    const at = index * minor;
    if (index % perMajor === 0) {
      return {
        at,
        kind: "major" as const,
        label: index > 0 ? Math.round(at * 1000) / 1000 : undefined,
      };
    }
    return { at, kind: index % perMid === 0 ? "mid" : "minor" };
  });
};

export {
  dpiFor,
  toMm,
  fromDots,
  formatDots,
  formatSize,
  toLength,
  lengthIn,
  ticksFor,
};
export type { Tick };
