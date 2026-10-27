/**
 * Interleaved 2 of 5 (^B2): pairs of digits, the first in the bars and the
 * second in the spaces, two of each five wide. Wide elements are ^BY's ratio
 * times the module width.
 */

/** Wide (1) and narrow (0) elements of each digit */
const patterns = [
  "00110",
  "10001",
  "01001",
  "11000",
  "00101",
  "10100",
  "01100",
  "00011",
  "10010",
  "01010",
];

/**
 * Mod-10 check digit, with digits weighted 3 and 1 from the left (not from
 * the right as in GS1), matching reference renders
 */
const checkDigitFor = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

/**
 * Widths in dots of the bars and spaces, and the digits as printed: only
 * digits are kept, the check digit is added, and then a leading zero if
 * that leaves an odd number.
 */
const encodeInterleaved2of5 = (
  data: string,
  checkDigit: boolean,
  narrow: number,
  wide: number
) => {
  let digits = data.replace(/\D/g, "");
  if (checkDigit) digits += checkDigitFor(digits);
  if (digits.length % 2) digits = `0${digits}`;

  const width = (element: string) => (element === "1" ? wide : narrow);
  const widths = [narrow, narrow, narrow, narrow];
  for (let i = 0; i < digits.length; i += 2) {
    const bars = patterns[Number(digits[i])];
    const spaces = patterns[Number(digits[i + 1])];
    for (let j = 0; j < 5; j++) widths.push(width(bars[j]), width(spaces[j]));
  }
  widths.push(wide, narrow, narrow);
  return { widths, text: digits };
};

export { encodeInterleaved2of5 };
