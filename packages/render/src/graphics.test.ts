// Zebra's compression scheme for ASCII graphic data, as the ZPL II
// Programming Guide describes it
import { describe, test, expect } from "vitest";
import { decodeGraphicData } from "./graphics.js";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

describe("decodeGraphicData", () => {
  test("reads plain hex, row after row", () => {
    expect(hex(decodeGraphicData("F00F0FF0", 2, 4))).toBe("F00F0FF0");
  });

  test("ignores spaces and line breaks", () => {
    expect(hex(decodeGraphicData("F00F\n0F F0", 2, 4))).toBe("F00F0FF0");
  });

  test("repeats the next digit: G to Y are 1 to 19", () => {
    expect(hex(decodeGraphicData("IFJ0", 4, 4))).toBe("FFF00000");
    expect(hex(decodeGraphicData("YA", 10, 10))).toBe(`${"A".repeat(19)}0`);
  });

  test("repeats the next digit: g to z are 20 to 400, and counts add up", () => {
    // vMB is 320 + 7 = 327 B's
    const bytes = decodeGraphicData("vMB", 164, 164);
    expect(hex(bytes)).toBe(`${"B".repeat(327)}0`);
    expect(hex(decodeGraphicData("gF", 10, 10))).toBe("F".repeat(20));
  });

  test("a comma fills the rest of the row with 0", () => {
    expect(hex(decodeGraphicData("F,FF,", 2, 4))).toBe("F000FF00");
  });

  test("an exclamation mark fills the rest of the row with 1", () => {
    expect(hex(decodeGraphicData("0!00!", 2, 4))).toBe("0FFF00FF");
  });

  test("a colon repeats the previous row", () => {
    expect(hex(decodeGraphicData("F00F::", 2, 6))).toBe("F00FF00FF00F");
    expect(hex(decodeGraphicData("HFH0:,", 2, 6))).toBe("FF00FF000000");
  });

  test("a colon on the first row is a blank row", () => {
    expect(hex(decodeGraphicData(":FF", 1, 2))).toBe("00FF");
  });

  test("short data leaves the rest blank, extra data is dropped", () => {
    expect(hex(decodeGraphicData("FF", 2, 4))).toBe("FF000000");
    expect(hex(decodeGraphicData("FFFFFFFFFF", 1, 2))).toBe("FFFF");
  });

  test("reads :B64: data", () => {
    expect(hex(decodeGraphicData(":B64:8A/wDw==:0000", 2, 4))).toBe("F00FF00F");
  });
});
