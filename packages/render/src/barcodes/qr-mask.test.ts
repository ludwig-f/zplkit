import { describe, test, expect } from "vitest";
import { encodeMatrix } from "./bwip.js";
import { remask } from "./qr-mask.js";

describe("remask", () => {
  // Sizes from version 1 to 27, with alignment patterns and version info
  test.each([
    ["hello", "Q"],
    ["https://zplkit.fingal.dev/docs/commands", "M"],
    ["0123456789".repeat(16), "L"],
    ["The quick brown fox jumps over the lazy dog. ".repeat(4), "H"],
    ["ZPLKIT ".repeat(150), "L"],
  ])("gives what bwip-js gives with the mask set: %s", (text, eclevel) => {
    const first = encodeMatrix("qrcode", text, `eclevel=${eclevel} mask=1`);
    for (let mask = 0; mask < 8; mask++) {
      const expected = encodeMatrix(
        "qrcode",
        text,
        `eclevel=${eclevel} mask=${mask + 1}`
      );
      expect(remask(first, mask)).toEqual(expected);
    }
  });
});
