// Checked against bwip-js, whose bars match reference renders
import { test, expect } from "vitest";
import bwipjs from "bwip-js";
import { encodeCode39 } from "./code39.js";
import { encodeInterleaved2of5 } from "./interleaved2of5.js";

const bwip = (bcid: string, text: string) => {
  const [symbol] = bwipjs.raw(bcid, text, "");
  if (!("sbs" in symbol)) throw new Error("expected a linear symbol");
  // bwip-js ends with the gap after the last character
  return symbol.sbs.slice(0, -1).map((w) => (w === 1 ? 1 : 3));
};

test.each(Array.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%"))(
  "Code 39 encodes %j",
  (char) => {
    expect(encodeCode39(char, false, 1, 3).widths).toStrictEqual(
      bwip("code39", char)
    );
  }
);

test.each([
  ["AB1", false, "*AB1*"],
  ["AB1", true, "*AB1M*"],
  ["ab-1", false, "*AB-1*"],
  ["A_B", false, "*AB*"],
])("Code 39 text for %j with check digit %s", (data, check, text) => {
  expect(encodeCode39(data, check, 1, 3).text).toBe(text);
});

test.each(["00", "12", "34", "56", "78", "90", "1234567890"])(
  "Interleaved 2 of 5 encodes %s",
  (digits) => {
    expect(encodeInterleaved2of5(digits, false, 1, 3).widths).toStrictEqual(
      bwip("interleaved2of5", digits)
    );
  }
);

test.each([
  ["123", false, "0123"],
  ["123", true, "1236"],
  ["1234", true, "012342"],
  ["12A34", false, "1234"],
])(
  "Interleaved 2 of 5 text for %s with check digit %s",
  (data, check, text) => {
    expect(encodeInterleaved2of5(data, check, 1, 3).text).toBe(text);
  }
);
