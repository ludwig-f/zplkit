import { describe, expect, test } from "vitest";
import { snapMove } from "./snap";

const label = { width: 400, height: 200 };

describe("snapMove", () => {
  test("snaps to another field's left edge", () => {
    const moving = { x: 0, y: 0, width: 20, height: 20 };
    const other = { x: 100, y: 50, width: 40, height: 40 };
    expect(snapMove(moving, 97, 0, [other], label)).toEqual({
      dx: 100,
      dy: 0,
      guides: [{ axis: "x", at: 100 }],
    });
  });

  test("snaps centers", () => {
    const moving = { x: 0, y: 0, width: 20, height: 20 };
    const other = { x: 100, y: 60, width: 40, height: 40 };
    // The center lands on 118, 2 from 120; the edges are 8 from theirs
    const result = snapMove(moving, 108, 0, [other], {
      width: 1000,
      height: 1000,
    });
    expect(result.dx).toBe(110);
    expect(result.guides).toContainEqual({ axis: "x", at: 120 });
  });

  test("snaps to the label's center", () => {
    const moving = { x: 0, y: 0, width: 40, height: 20 };
    expect(snapMove(moving, 179, 30, [], label)).toEqual({
      dx: 180,
      dy: 30,
      guides: [{ axis: "x", at: 200 }],
    });
  });

  test("leaves moves alone outside the threshold", () => {
    const moving = { x: 0, y: 0, width: 40, height: 20 };
    // Left 185 is 15 from the center line, right 225 is 25 away, center 205
    // is 5 away; y 30, 40 and 50 are far from 0, 100 and 200
    expect(snapMove(moving, 185, 30, [], label)).toEqual({
      dx: 185,
      dy: 30,
      guides: [],
    });
  });
});
