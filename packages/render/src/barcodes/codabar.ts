/**
 * ANSI Codabar (^BK): digits and - $ : / . + between start and stop
 * characters A to D. Each character is four bars and three spaces, narrow
 * or wide, with a narrow space between characters.
 */

const characters = "0123456789-$:/.+ABCD";

/** Which of bar, space, bar, space, bar, space, bar are wide */
const patterns = [
  "0000011",
  "0000110",
  "0001001",
  "1100000",
  "0010010",
  "1000010",
  "0100001",
  "0100100",
  "0110000",
  "1001000",
  "0001100",
  "0011000",
  "1000101",
  "1010001",
  "1010100",
  "0010101",
  "0011010",
  "0101001",
  "0001011",
  "0001110",
];

/**
 * Widths in dots of alternating bars and spaces, and the interpretation
 * line, which shows the start and stop characters
 */
const encodeCodabar = (
  data: string,
  start: string,
  stop: string,
  narrow: number,
  wide: number
) => {
  const body = Array.from(data)
    .filter((char) => characters.slice(0, 16).includes(char))
    .join("");
  const text = start + body + stop;
  const widths: number[] = [];
  Array.from(text).forEach((char, i) => {
    if (i > 0) widths.push(narrow);
    for (const element of patterns[characters.indexOf(char)]) {
      widths.push(element === "1" ? wide : narrow);
    }
  });
  return { widths, text };
};

export { encodeCodabar };
