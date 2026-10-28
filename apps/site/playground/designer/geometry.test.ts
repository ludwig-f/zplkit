import { describe, expect, test } from "vitest";
import { labelAt, pxToDots, toDots, toScreen } from "./geometry";
import type { LabelBox } from "./geometry";

/** A 400 x 200 dot label shown at 200 x 100 px from (10, 20) */
const box: LabelBox = {
  left: 10,
  top: 20,
  width: 200,
  height: 100,
  dotsWide: 400,
  dotsHigh: 200,
};

describe("toScreen", () => {
  test("scales a rect in dots to px, offset by the label", () => {
    expect(toScreen(box, { x: 100, y: 50, width: 40, height: 20 })).toEqual({
      x: 60,
      y: 45,
      width: 20,
      height: 10,
    });
  });
});

describe("toDots", () => {
  test("inverts toScreen", () => {
    expect(toDots(box, 60, 45)).toEqual({ x: 100, y: 50 });
  });
});

describe("pxToDots", () => {
  test("scales a distance in px to dots", () => {
    expect(pxToDots(box, 3)).toBe(6);
  });
});

describe("labelAt", () => {
  const stacked: LabelBox[] = [
    { left: 0, top: 0, width: 100, height: 50, dotsWide: 200, dotsHigh: 100 },
    { left: 0, top: 80, width: 100, height: 50, dotsWide: 200, dotsHigh: 100 },
  ];

  test("picks the box containing the point", () => {
    expect(labelAt(stacked, 50, 100)).toBe(1);
  });

  test("is undefined in the gap between boxes", () => {
    expect(labelAt(stacked, 50, 60)).toBeUndefined();
  });
});
