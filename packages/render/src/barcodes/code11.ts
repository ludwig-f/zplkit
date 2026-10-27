/**
 * Code 11 (^B1): digits and dashes, each three bars and two spaces, narrow
 * or wide. Wide elements are ^BY's ratio times the module width.
 */
const characters = "0123456789-";

/** Wide (1) and narrow (0) elements of each character, bar first */
const patterns: Record<string, string> = {
  "0": "00001",
  "1": "10001",
  "2": "01001",
  "3": "11000",
  "4": "00101",
  "5": "10100",
  "6": "01100",
  "7": "00011",
  "8": "10010",
  "9": "10000",
  "-": "00100",
  "*": "00110",
};

/** Check character: weights counting up from the right, wrapping at `wrap` */
const checkCharacter = (data: string, wrap: number) => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const value = characters.indexOf(data[data.length - 1 - i]);
    sum += value * ((i % wrap) + 1);
  }
  return characters[sum % 11];
};

/**
 * Widths in dots of the bars and spaces, and the text with its check
 * characters. Characters Code 11 can't hold are left out.
 */
const encodeCode11 = (
  data: string,
  checkDigits: 1 | 2,
  narrow: number,
  wide: number
) => {
  let text = Array.from(data)
    .filter((char) => characters.includes(char))
    .join("");
  text += checkCharacter(text, 10);
  if (checkDigits === 2) text += checkCharacter(text, 9);

  const widths: number[] = [];
  for (const char of `*${text}*`) {
    if (widths.length) widths.push(narrow);
    for (const element of patterns[char]) {
      widths.push(element === "1" ? wide : narrow);
    }
  }
  return { widths, text };
};

export { encodeCode11 };
