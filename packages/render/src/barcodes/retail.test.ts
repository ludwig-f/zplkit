// Bars checked against bwip-js; text follows the examples in Zebra's guide
import { describe, test, expect } from "vitest";
import bwipjs from "bwip-js";
import {
  encodeEan8,
  encodeUpcA,
  encodeUpcE,
  encodeUpcEanExtension,
} from "./upc-ean.js";
import { encodeCode93 } from "./code93.js";
import { encodeCodabar } from "./codabar.js";

const bwip = (bcid: string, text: string, options = "") => {
  const [symbol] = bwipjs.raw(bcid, text, options);
  if (!("sbs" in symbol)) throw new Error("expected a linear symbol");
  return symbol.sbs;
};

describe("EAN-8", () => {
  test.each(["1234567", "9638507", "0000000"])("encodes %s", (data) => {
    expect(encodeEan8(data).widths).toStrictEqual(bwip("ean8", data));
  });

  test("adds the check digit to the text", () => {
    expect(encodeEan8("1234567").text).toBe("12345670");
  });
});

describe("UPC-A", () => {
  test.each(["07000002198", "03600029145", "12345678901"])(
    "encodes %s",
    (data) => {
      expect(encodeUpcA(data).widths).toStrictEqual(bwip("upca", data));
    }
  );

  test("adds the check digit to the text", () => {
    expect(encodeUpcA("07000002198").text).toBe("070000021985");
  });
});

describe("UPC-E", () => {
  test.each([
    // Manufacturer numbers ending in 000, 100 or 200
    ["1200000345", "01234505"],
    // ending in 300 to 900, as in Zebra's example
    ["1230000045", "01234531"],
    // ending in a single 0
    ["1234000005", "01234543"],
    // not ending in 0
    ["1234500006", "01234565"],
    // number system 1
    ["11230000045", "11234538"],
  ])("compresses %s to %s", (data, text) => {
    expect(encodeUpcE(data).text).toBe(text);
    expect(encodeUpcE(data).widths).toStrictEqual(bwip("upce", text));
  });
});

describe("UPC/EAN add-ons", () => {
  test.each([
    ["12", "ean2"],
    ["53", "ean2"],
    ["04414", "ean5"],
    ["52495", "ean5"],
  ])("encodes %s", (data, bcid) => {
    expect(encodeUpcEanExtension(data).widths).toStrictEqual(bwip(bcid, data));
  });
});

describe("Code 93", () => {
  test.each(["12345ABCDE", "TEST93", "A-B. $/+%"])("encodes %j", (data) => {
    expect(encodeCode93(data, false).widths).toStrictEqual(
      bwip("code93", data, "includecheck")
    );
  });

  test("prints shift check characters as a to d", () => {
    // The C check character is 45, the third shift character
    expect(encodeCode93("12345ABCDE", true).text).toBe("12345ABCDEcO");
  });

  test("prints the check characters only when asked", () => {
    expect(encodeCode93("12345ABCDE", false).text).toBe("12345ABCDE");
    expect(encodeCode93("TEST93", true).text).toMatch(/^TEST93..$/);
  });
});

describe("Codabar", () => {
  test.each(["123456", "31117013206375", "-$:/.+"])("encodes %s", (data) => {
    // bwip-js ends with the gap after the stop character
    expect(encodeCodabar(data, "A", "B", 1, 3).widths).toStrictEqual(
      bwip("rationalizedCodabar", `A${data}B`).slice(0, -1)
    );
  });

  test("shows the start and stop characters", () => {
    expect(encodeCodabar("123456", "A", "A", 1, 3).text).toBe("A123456A");
  });
});
