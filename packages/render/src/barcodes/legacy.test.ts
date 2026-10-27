// Bars checked against bwip-js, and Plessey's against reference renders
import { describe, test, expect } from "vitest";
import bwipjs from "bwip-js";
import { encodeTwoOf5 } from "./two-of-five.js";
import { encodeMsi } from "./msi.js";
import { encodePlessey } from "./plessey.js";

/** bwip-js's bars with narrow elements 1 dot and wide ones 3 */
const bwip = (bcid: string, text: string, options = "") => {
  const [symbol] = bwipjs.raw(bcid, text, options);
  if (!("sbs" in symbol)) throw new Error("expected a linear symbol");
  return symbol.sbs.filter((w) => w > 0).map((w) => (w > 1.01 ? 3 : 1));
};

/** Without the gap bwip-js leaves after the last bar */
const trimmed = (widths: number[]) =>
  widths.length % 2 === 0 ? widths.slice(0, -1) : widths;

describe("2 of 5", () => {
  test.each(["123456", "0", "9876543210"])("Industrial encodes %s", (data) => {
    expect(encodeTwoOf5("industrial", data, 1, 3).widths).toStrictEqual(
      trimmed(bwip("industrial2of5", data))
    );
  });

  test.each(["123456", "0", "9876543210"])("Standard encodes %s", (data) => {
    expect(encodeTwoOf5("standard", data, 1, 3).widths).toStrictEqual(
      trimmed(bwip("iata2of5", data))
    );
  });
});

describe("MSI", () => {
  test.each([
    ["A", ""],
    ["B", "includecheck checktype=mod10"],
    ["C", "includecheck checktype=mod1010"],
    ["D", "includecheck checktype=mod1110"],
  ])("check digits %s", (checkDigits, options) => {
    for (const data of ["123456", "12345678901", "9"]) {
      expect(encodeMsi(data, checkDigits, false, 1, 3).widths).toStrictEqual(
        trimmed(bwip("msi", data, options))
      );
    }
  });

  test("prints the check digits only when asked", () => {
    expect(encodeMsi("123456", "B", false, 1, 3).text).toBe("123456");
    expect(encodeMsi("123456", "B", true, 1, 3).text).toBe("1234566");
  });
});

describe("Plessey", () => {
  test("matches a reference render of 12345", () => {
    expect(encodePlessey("12345", false, 2, 6).widths.join(" ")).toBe(
      "6 2 6 2 2 6 6 2 6 2 2 6 2 6 2 6 2 6 6 2 2 6 2 6 6 2 6 2 2 6 2 6 2 6 2 6 6 2 2 6 6 2 2 6 6 2 2 6 2 6 6 2 6 2 2 6 2 6 6 2 6 2 6 2 8 6 2 6 2 2 6 2 6"
    );
  });

  test("adds the check characters to the text when asked", () => {
    expect(encodePlessey("12345", false, 2, 6).text).toBe("12345");
    expect(encodePlessey("12345", true, 2, 6).text).toMatch(
      /^12345[0-9A-F]{2}$/
    );
  });
});
