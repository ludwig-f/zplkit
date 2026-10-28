import { describe, expect, test } from "vitest";
import { alignMoves, distributeMoves } from "./align";

const rect = (x: number, width: number, y = 0, height = 10) => ({
  x,
  y,
  width,
  height,
});

describe("alignMoves", () => {
  test("aligns left edges", () => {
    const moves = alignMoves(
      new Map([
        [1, rect(10, 20)],
        [2, rect(30, 20)],
        [3, rect(50, 20)],
      ]),
      "left"
    );
    expect([...moves]).toEqual([
      [1, { dx: 0, dy: 0 }],
      [2, { dx: -20, dy: 0 }],
      [3, { dx: -40, dy: 0 }],
    ]);
  });

  test("aligns centers", () => {
    const moves = alignMoves(
      new Map([
        [1, rect(0, 20)],
        [2, rect(100, 40)],
      ]),
      "center"
    );
    // The combined bounds span 0 to 140, so the center is 70
    expect(moves.get(1)).toEqual({ dx: 60, dy: 0 });
    expect(moves.get(2)).toEqual({ dx: -50, dy: 0 });
  });
});

describe("distributeMoves", () => {
  test("distributes with equal gaps", () => {
    const moves = distributeMoves(
      new Map([
        [1, rect(0, 10)],
        [2, rect(15, 10)],
        [3, rect(90, 10)],
      ]),
      "x"
    );
    expect(moves.get(1)).toEqual({ dx: 0, dy: 0 });
    expect(moves.get(2)).toEqual({ dx: 30, dy: 0 });
    expect(moves.get(3)).toEqual({ dx: 0, dy: 0 });
  });
});
