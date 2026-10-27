/**
 * Decoding of ASCII graphic data (^GF A and ~DG): hex, with the compression
 * scheme from Zebra's ZPL II Programming Guide, or base64 as :B64: and :Z64:.
 */
import { decodeObjectData } from "./data.js";

/**
 * How many times the next hex digit repeats, for a repeat character: G to Y
 * mean 1 to 19, g to z mean 20 to 400 in steps of 20, and 0 for anything else
 */
const repeatsOf = (char: string): number => {
  if (char >= "G" && char <= "Y") return char.charCodeAt(0) - 70;
  if (char >= "g" && char <= "z") return (char.charCodeAt(0) - 102) * 20;
  return 0;
};

/**
 * Decode ASCII graphic data to `totalBytes` bytes, in rows of `bytesPerRow`.
 * Compressed data can put a repeat count before a hex digit, end a row early
 * with `,` (the rest is 0) or `!` (the rest is 1), and repeat the previous
 * row with `:`. Data that runs out leaves the rest of the graphic blank.
 */
const decodeGraphicData = (
  data: string,
  bytesPerRow: number,
  totalBytes: number
): Uint8Array => {
  const bytes = new Uint8Array(totalBytes);

  if (/^:[BZ]64:/.test(data)) {
    const decoded = decodeObjectData(data) ?? new Uint8Array();
    bytes.set(decoded.subarray(0, totalBytes));
    return bytes;
  }

  const digitsPerRow = bytesPerRow * 2;
  // Digits are written straight into the bytes, a row at a time
  let rowStart = 0;
  let digit = 0;
  let repeats = 0;

  const write = (value: number) => {
    const index = rowStart + Math.floor(digit / 2);
    if (index < totalBytes) bytes[index] |= digit % 2 ? value : value << 4;
    digit++;
  };

  for (const char of data) {
    if (/\s/.test(char)) continue;

    // A full row moves on to the next; a long run spills over into it
    if (digit >= digitsPerRow) {
      rowStart += Math.max(bytesPerRow, Math.ceil(digit / 2));
      digit = 0;
    }
    if (rowStart >= totalBytes) break;

    const count = repeatsOf(char);
    if (count) {
      repeats += count;
      continue;
    }

    if (char === ",") {
      digit = digitsPerRow;
    } else if (char === "!") {
      while (digit < digitsPerRow) write(0xf);
    } else if (char === ":") {
      const row = bytes.subarray(rowStart, rowStart + bytesPerRow);
      row.fill(0);
      if (rowStart >= bytesPerRow) {
        row.set(bytes.subarray(rowStart - bytesPerRow, rowStart));
      }
      digit = digitsPerRow;
    } else {
      const value = parseInt(char, 16);
      for (let i = 0; i < Math.max(repeats, 1); i++) {
        write(Number.isNaN(value) ? 0 : value);
      }
    }
    repeats = 0;
  }

  return bytes;
};

export { decodeGraphicData };
