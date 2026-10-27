/**
 * Plessey (^BP): hex digits, each four bits from the least significant,
 * after a start pattern and followed by an 8-bit CRC. A 1 is a wide bar and
 * a narrow space, a 0 the reverse.
 */

/** CRC polynomial x^8 + x^7 + x^6 + x^5 + x^3 + 1 */
const POLYNOMIAL = [1, 1, 1, 1, 0, 1, 0, 0, 1];

/** The 8 check bits of the data bits */
const crc = (bits: number[]) => {
  const work = [...bits, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < bits.length; i++) {
    if (!work[i]) continue;
    POLYNOMIAL.forEach((bit, j) => {
      work[i + j] ^= bit;
    });
  }
  return work.slice(bits.length);
};

/**
 * Widths in dots of alternating bars and spaces, and the interpretation
 * line: the data, with the check characters as two hex digits if asked for
 */
const encodePlessey = (
  data: string,
  printCheckDigit: boolean,
  narrow: number,
  wide: number
) => {
  const text = data.toUpperCase().replace(/[^0-9A-F]/g, "");
  const bits: number[] = [];
  for (const char of text) {
    const value = parseInt(char, 16);
    for (let i = 0; i < 4; i++) bits.push((value >> i) & 1);
  }
  const check = crc(bits);

  const widths: number[] = [];
  for (const bit of [1, 1, 0, 1, ...bits, ...check]) {
    widths.push(...(bit ? [wide, narrow] : [narrow, wide]));
  }
  // A bar as wide as a whole bit, then the start pattern reversed
  widths.push(
    narrow + wide,
    wide,
    narrow,
    wide,
    narrow,
    narrow,
    wide,
    narrow,
    wide
  );

  const hex = (bits: number[]) =>
    bits
      .reduce((value, bit, i) => value | (bit << i), 0)
      .toString(16)
      .toUpperCase();
  const checks = hex(check.slice(0, 4)) + hex(check.slice(4));
  return { widths, text: printCheckDigit ? text + checks : text };
};

export { encodePlessey };
