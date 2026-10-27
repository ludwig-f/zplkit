/**
 * EAN-8 (^B8), UPC-A (^BU), UPC-E (^B9) and the 2 and 5 digit add-ons
 * (^BS). Like EAN-13, each digit is two bars and two spaces seven modules
 * wide, from one of three sets.
 */

/** Widths of space, bar, space, bar for set A (odd parity) digits */
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

/**
 * A digit's widths. Set A starts with a space; set B is set A backwards;
 * set C has set A's widths but starts with a bar, so it's the same list.
 */
const digit = (value: string, set: "A" | "B" | "C") => {
  const widths = Array.from(setA[Number(value)], Number);
  return set === "B" ? widths.reverse() : widths;
};

/** Mod-10 check digit, with digits weighted 3 and 1 from the right */
const checkDigit = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - i;
    sum += Number(digits[i]) * (fromRight % 2 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

const onlyDigits = (data: string, length: number) =>
  data.replace(/\D/g, "").slice(0, length).padStart(length, "0");

/**
 * Builds a symbol from guards and digits, remembering which bars are
 * guards so they can reach below the others
 */
const builder = () => {
  const widths: number[] = [];
  const guards: number[] = [];
  return {
    widths,
    guards,
    /** Guard elements, alternating from whatever comes next */
    guard(pattern: number[]) {
      pattern.forEach((width) => {
        // Even indexes are bars
        if (widths.length % 2 === 0) guards.push(widths.length);
        widths.push(width);
      });
    },
    digits(text: string, sets: string, extend = false) {
      Array.from(text).forEach((value, i) => {
        const start = widths.length;
        widths.push(...digit(value, sets[i] as "A" | "B" | "C"));
        if (extend) {
          for (let j = start; j < widths.length; j++) {
            if (j % 2 === 0) guards.push(j);
          }
        }
      });
    },
  };
};

/** EAN-8: 7 digits and a check digit, four under each half */
const encodeEan8 = (data: string) => {
  const digits = onlyDigits(data, 7);
  const text = digits + checkDigit(digits);
  const symbol = builder();
  symbol.guard([1, 1, 1]);
  symbol.digits(text.slice(0, 4), "AAAA");
  symbol.guard([1, 1, 1, 1, 1]);
  symbol.digits(text.slice(4), "CCCC");
  symbol.guard([1, 1, 1]);
  return { widths: symbol.widths, guards: symbol.guards, text };
};

/**
 * UPC-A: 11 digits and a check digit. The first and last digits print
 * outside the bars, and their bars reach down like the guards.
 */
const encodeUpcA = (data: string) => {
  const digits = onlyDigits(data, 11);
  const text = digits + checkDigit(digits);
  const symbol = builder();
  symbol.guard([1, 1, 1]);
  symbol.digits(text[0], "A", true);
  symbol.digits(text.slice(1, 6), "AAAAA");
  symbol.guard([1, 1, 1, 1, 1]);
  symbol.digits(text.slice(6, 11), "CCCCC");
  symbol.digits(text[11], "C", true);
  symbol.guard([1, 1, 1]);
  return { widths: symbol.widths, guards: symbol.guards, text };
};

/** Which of UPC-E's six digits use set B, by check digit, for number system 0 */
const upcEParities = [
  "BBBAAA",
  "BBABAA",
  "BBAABA",
  "BBAAAB",
  "BABBAA",
  "BAABBA",
  "BAAABB",
  "BABABA",
  "BABAAB",
  "BAABAB",
];

/**
 * UPC-A's manufacturer and product numbers compressed to six digits, by
 * how many zeros the manufacturer number ends in
 */
const compress = (manufacturer: string, product: string) => {
  const m = manufacturer;
  const p = product;
  if (/^[012]$/.test(m[2]) && m.endsWith("00")) {
    return m.slice(0, 2) + p.slice(2) + m[2];
  }
  if (m.endsWith("00")) return m.slice(0, 3) + p.slice(3) + "3";
  if (m.endsWith("0")) return m.slice(0, 4) + p[4] + "4";
  return m + p[4];
};

/**
 * UPC-E: a UPC-A number (10 digits with number system 0, or 11 starting with
 * the number system) compressed to six digits. The number system and the
 * UPC-A check digit print outside the bars and choose each digit's set.
 */
const encodeUpcE = (data: string) => {
  const all = data.replace(/\D/g, "");
  const digits =
    all.length >= 11 ? all.slice(0, 11) : "0" + onlyDigits(all, 10);
  const system = digits[0] === "1" ? "1" : "0";
  const check = checkDigit(system + digits.slice(1));
  const six = compress(digits.slice(1, 6), digits.slice(6, 11));
  let sets = upcEParities[Number(check)];
  if (system === "1") {
    sets = Array.from(sets, (set) => (set === "A" ? "B" : "A")).join("");
  }
  const symbol = builder();
  symbol.guard([1, 1, 1]);
  symbol.digits(six, sets);
  symbol.guard([1, 1, 1, 1, 1, 1]);
  return {
    widths: symbol.widths,
    guards: symbol.guards,
    text: system + six + check,
  };
};

/** Which of the 2 digit add-on's digits use set B, by its value mod 4 */
const twoDigitParities = ["AA", "AB", "BA", "BB"];

/** Which of the 5 digit add-on's digits use set B, by its checksum */
const fiveDigitParities = [
  "BBAAA",
  "BABAA",
  "BAABA",
  "BAAAB",
  "ABBAA",
  "AABBA",
  "AAABB",
  "ABABA",
  "ABAAB",
  "AABAB",
];

/**
 * The 2 or 5 digit add-on (^BS): a start pattern, then digits with a space
 * and a bar between them. Data that isn't 2 digits is padded to 5.
 */
const encodeUpcEanExtension = (data: string) => {
  const all = data.replace(/\D/g, "");
  const text = all.length <= 2 ? all.padStart(2, "0") : onlyDigits(all, 5);
  let sets: string;
  if (text.length === 2) {
    sets = twoDigitParities[Number(text) % 4];
  } else {
    const d = Array.from(text, Number);
    const sum = 3 * (d[0] + d[2] + d[4]) + 9 * (d[1] + d[3]);
    sets = fiveDigitParities[sum % 10];
  }
  // Start: bar, space, double bar
  const widths = [1, 1, 2];
  Array.from(text).forEach((value, i) => {
    if (i > 0) widths.push(1, 1);
    widths.push(...digit(value, sets[i] as "A" | "B"));
  });
  return { widths, text };
};

export { encodeEan8, encodeUpcA, encodeUpcE, encodeUpcEanExtension };
