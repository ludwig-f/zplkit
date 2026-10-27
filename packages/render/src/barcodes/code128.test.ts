// Symbol values decoded from reference bars, check digit last
import { describe, test, expect } from "vitest";
import { code128Values, encodeCode128 } from "./code128.js";

describe("code128Values without a mode", () => {
  test.each([
    // Subset B unless a start code says otherwise
    ["12345678", [104, 17, 18, 19, 20, 21, 22, 23, 24, 60]],
    ["", [104, 1]],
    // Subset A takes pairs of digits as values and skips anything else
    [">90102", [103, 1, 2, 5]],
    [">9ABC", [103, 0]],
    // Subset C drops an unpaired digit at the end
    [">;123", [105, 12, 14]],
    [">;12345", [105, 12, 34, 82]],
    // Invocation codes stand for their value
    [">:AB>5123456", [104, 33, 34, 99, 12, 34, 56, 26]],
    ["AB>612>7CD", [104, 33, 34, 100, 17, 18, 101, 33]],
    [">;12>6AB", [105, 12, 100, 33, 34, 37]],
    ["a>0b", [104, 65, 30, 66, 15]],
    ["x>=y", [104, 88, 94, 89, 29]],
    [">8123", [104, 102, 17, 18, 19, 61]],
    [">;>812345678", [105, 102, 12, 34, 56, 78, 20]],
  ])("%s", (data, values) => {
    expect(code128Values(data)).toStrictEqual(values);
  });
});

describe("encodeCode128", () => {
  test("turns values into bar and space widths, ending with the stop", () => {
    // Reference bars for ^BCN,50,N^FD12345678 with ^BY1
    expect(encodeCode128("12345678", "N").widths.join(",")).toBe(
      "2,1,1,2,1,4,1,2,3,2,2,1,2,2,3,2,1,1,2,2,1,1,3,2,2,2,1,2,3,1,2,1,3,2,1,2,2,2,3,1,1,2,3,1,2,1,3,1,3,1,1,2,2,2,3,1,4,1,1,1,2,3,3,1,1,1,2"
    );
  });

  test("automatic mode packs digits into subset C", () => {
    expect(encodeCode128("12345678", "A").widths.join(",")).toBe(
      "2,1,1,2,3,2,1,1,2,2,3,2,1,3,1,1,2,3,3,3,1,1,2,1,2,4,1,1,1,2,1,3,3,1,2,1,2,3,3,1,1,1,2"
    );
  });

  test("the interpretation line leaves out invocation codes", () => {
    expect(encodeCode128(">:AB>5123456", "N").text).toBe("AB123456");
    expect(encodeCode128("a>0b>=c", "N").text).toBe("a>b~c");
  });
});
