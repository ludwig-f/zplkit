/**
 * Code 39 (^B3): digits, capital letters, space and - . $ / + %, each five
 * bars and four spaces, three of them wide. Wide elements are ^BY's ratio
 * times the module width, and a narrow space separates characters.
 */
const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

/** Wide (1) and narrow (0) elements of each character, bar first */
const patterns: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  A: "100001001",
  B: "001001001",
  C: "101001000",
  D: "000011001",
  E: "100011000",
  F: "001011000",
  G: "000001101",
  H: "100001100",
  I: "001001100",
  J: "000011100",
  K: "100000011",
  L: "001000011",
  M: "101000010",
  N: "000010011",
  O: "100010010",
  P: "001010010",
  Q: "000000111",
  R: "100000110",
  S: "001000110",
  T: "000010110",
  U: "110000001",
  V: "011000001",
  W: "111000000",
  X: "010010001",
  Y: "110010000",
  Z: "011010000",
  "-": "010000101",
  ".": "110000100",
  " ": "011000100",
  $: "010101000",
  "/": "010100010",
  "+": "010001010",
  "%": "000101010",
  "*": "010010100",
};

/**
 * Widths in dots of the bars and spaces, and the text between the * start
 * and stop characters. Lowercase letters are encoded as capitals, and
 * characters Code 39 can't hold are left out.
 */
const encodeCode39 = (
  data: string,
  checkDigit: boolean,
  narrow: number,
  wide: number
) => {
  let content = Array.from(data.toUpperCase())
    .filter((char) => characters.includes(char))
    .join("");
  if (checkDigit) {
    let sum = 0;
    for (const char of content) sum += characters.indexOf(char);
    content += characters[sum % 43];
  }

  const widths: number[] = [];
  for (const char of `*${content}*`) {
    if (widths.length) widths.push(narrow);
    for (const element of patterns[char]) {
      widths.push(element === "1" ? wide : narrow);
    }
  }
  return { widths, text: `*${content}*` };
};

export { encodeCode39 };
