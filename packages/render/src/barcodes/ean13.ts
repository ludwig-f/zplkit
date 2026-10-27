/**
 * EAN-13 (^BE): 12 digits and a check digit. The first digit isn't drawn
 * as bars but chooses how the next six are encoded.
 */

/**
 * Widths of space, bar, space, bar for set A digits. Set C has the same
 * widths starting with a bar; set B has them backwards.
 */
const setA = [
  "3211",
  "2221",
  "2122",
  "1411",
  "1132",
  "1231",
  "1114",
  "1312",
  "1213",
  "3112",
];

/** Which of the first six digits use set B, by the leading digit */
const parities = [
  "AAAAAA",
  "AABABB",
  "AABBAB",
  "AABBBA",
  "ABAABB",
  "ABBAAB",
  "ABBBAA",
  "ABABAB",
  "ABABBA",
  "ABBABA",
];

const checkDigit = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
};

/**
 * Module widths of alternating bars and spaces, which bars are guards, and
 * the 13 digits
 */
const encodeEan13 = (data: string) => {
  const digits = data.replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  const text = digits + checkDigit(digits);

  // Start with the left guard: bar, space, bar
  const widths = [1, 1, 1];
  const guards = [0, 2];
  const add = (pattern: string, reverse: boolean) => {
    const elements = Array.from(pattern, Number);
    widths.push(...(reverse ? elements.reverse() : elements));
  };

  for (let i = 1; i <= 6; i++) {
    // Set B is set A's widths backwards
    add(setA[Number(text[i])], parities[Number(text[0])][i - 1] === "B");
  }
  // Center guard: space, bar, space, bar, space
  guards.push(widths.length + 1, widths.length + 3);
  widths.push(1, 1, 1, 1, 1);
  for (let i = 7; i <= 12; i++) add(setA[Number(text[i])], false);
  // Right guard: bar, space, bar
  guards.push(widths.length, widths.length + 2);
  widths.push(1, 1, 1);

  return { widths, guards, text };
};

export { encodeEan13 };
