/**
 * Code 93 (^BA): 47 characters, each three bars and three spaces nine
 * modules wide, between start and stop characters, with two check
 * characters.
 */

/** Characters by value; 43 to 46 are the shift characters */
const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";

/** Widths of bar, space, bar, space, bar, space for each value */
const patterns = [
  "131112",
  "111213",
  "111312",
  "111411",
  "121113",
  "121212",
  "121311",
  "111114",
  "131211",
  "141111",
  "211113",
  "211212",
  "211311",
  "221112",
  "221211",
  "231111",
  "112113",
  "112212",
  "112311",
  "122112",
  "132111",
  "111123",
  "111222",
  "111321",
  "121122",
  "131121",
  "212112",
  "212211",
  "211122",
  "211221",
  "221121",
  "222111",
  "112122",
  "112221",
  "122121",
  "123111",
  "121131",
  "311112",
  "311211",
  "321111",
  "112131",
  "113121",
  "211131",
  "121221",
  "312111",
  "311121",
  "122211",
];

const START = "111141";

/** A check character: values weighted 1, 2, 3 and so on from the right */
const check = (values: number[], maxWeight: number) => {
  let sum = 0;
  values.forEach((value, i) => {
    sum += value * (((values.length - 1 - i) % maxWeight) + 1);
  });
  return sum % 47;
};

/**
 * Module widths of alternating bars and spaces, and what the interpretation
 * line prints: the data, and the check characters if asked for
 */
const encodeCode93 = (data: string, printCheckDigit: boolean) => {
  const text = Array.from(data.toUpperCase())
    .filter((char) => characters.includes(char))
    .join("");
  const values = Array.from(text, (char) => characters.indexOf(char));
  const c = check(values, 20);
  const k = check([...values, c], 15);

  const widths = Array.from(START, Number);
  for (const value of [...values, c, k]) {
    widths.push(...Array.from(patterns[value], Number));
  }
  // Stop: the start character and a termination bar
  widths.push(...Array.from(START, Number), 1);

  // The four shift characters print as a, b, c and d
  const printed = (value: number) =>
    value < 43 ? characters[value] : "abcd"[value - 43];
  const checks = printCheckDigit ? printed(c) + printed(k) : "";
  return { widths, text: text + checks };
};

export { encodeCode93 };
