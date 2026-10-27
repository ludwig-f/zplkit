/**
 * Industrial 2 of 5 (^BI) and Standard 2 of 5 (^BJ): each digit is five
 * bars, two of them wide, with narrow spaces. They differ only in their
 * start and stop patterns.
 */

/** Wide (1) and narrow (0) bars of each digit */
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

/** Start and stop elements, bar first, as narrow (0) and wide (1) */
const frames = {
  industrial: { start: "101000", stop: "10001" },
  standard: { start: "0000", stop: "100" },
};

/**
 * Widths in dots of alternating bars and spaces, and the digits for the
 * interpretation line
 */
const encodeTwoOf5 = (
  kind: keyof typeof frames,
  data: string,
  narrow: number,
  wide: number
) => {
  const text = data.replace(/\D/g, "");
  const width = (element: string) => (element === "1" ? wide : narrow);
  const { start, stop } = frames[kind];
  const widths = Array.from(start, width);
  for (const digit of text) {
    for (const bar of patterns[Number(digit)]) widths.push(width(bar), narrow);
  }
  widths.push(...Array.from(stop, width));
  return { widths, text };
};

export { encodeTwoOf5 };
