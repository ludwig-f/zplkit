import { test, expect } from "vitest";
import {
  dpiFor,
  formatDots,
  formatSize,
  lengthIn,
  ticksFor,
  toLength,
  toMm,
} from "./units";

test("printers are sold by their dots per inch", () => {
  expect([6, 8, 12, 24].map(dpiFor)).toStrictEqual([152, 203, 300, 600]);
});

test("inches convert with the printer's dpi", () => {
  // 6 in at 300 dpi is 1800 dots, at 12 dots per millimeter
  expect(toMm({ inches: 6 }, 12)).toBe(150);
  expect(toMm({ mm: 57 }, 12)).toBe(57);
});

test("dots show as millimeters, inches or dots", () => {
  expect(formatDots(812, "mm", 8)).toBe("101.5");
  expect(formatDots(1200, "in", 12)).toBe("4.00");
  expect(formatDots(812, "dots", 8)).toBe("812");
});

test("a size reads with its unit", () => {
  expect(formatSize(812, 1218, "in", 8)).toBe("4.00 × 6.00 in");
  expect(formatSize(812, 1218, "dots", 8)).toBe("812 × 1218 dots");
});

test("typed sizes keep their unit", () => {
  expect(toLength(4, "in", 8)).toStrictEqual({ inches: 4 });
  expect(toLength(57, "mm", 8)).toStrictEqual({ mm: 57 });
  // Dots are a physical length at the current resolution
  expect(toLength(812, "dots", 8)).toStrictEqual({ mm: 101.5 });
});

test("a label side shows in the unit it was picked in", () => {
  expect(lengthIn({ inches: 4 }, "in", 12)).toBe(4);
  expect(lengthIn({ inches: 4 }, "dots", 12)).toBe(1200);
  expect(lengthIn({ mm: 101.5 }, "in", 8)).toBe(4);
});

test("rulers label whole units and mark halves", () => {
  const ticks = ticksFor(2, "in");
  expect(ticks.filter((tick) => tick.label).map((tick) => tick.label)).toEqual([
    1, 2,
  ]);
  expect(ticks).toHaveLength(17);
  expect(ticks[4].kind).toBe("mid");
});

test("rulers in dots step by round numbers", () => {
  const labels = ticksFor(812, "dots")
    .filter((tick) => tick.label)
    .map((tick) => tick.label);
  expect(labels).toEqual([100, 200, 300, 400, 500, 600, 700, 800]);
});

test("rulers in millimeters label every centimeter", () => {
  const labels = ticksFor(50.8, "mm")
    .filter((tick) => tick.label)
    .map((tick) => tick.label);
  expect(labels).toEqual([10, 20, 30, 40, 50]);
});
