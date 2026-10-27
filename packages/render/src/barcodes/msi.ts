/**
 * MSI (^BM): each digit is four bits, most significant first, between start
 * and stop patterns. A 1 is a wide bar and a narrow space, a 0 the reverse.
 */

/** Mod 10: every other digit from the right doubled, the digits summed */
const mod10 = (digits: string) => {
  let sum = 0;
  Array.from(digits)
    .reverse()
    .forEach((digit, i) => {
      const value = Number(digit) * (i % 2 === 0 ? 2 : 1);
      sum += Math.floor(value / 10) + (value % 10);
    });
  return String((10 - (sum % 10)) % 10);
};

/** Mod 11 with weights 2 to 7 from the right; 10 is written as two digits */
const mod11 = (digits: string) => {
  let sum = 0;
  Array.from(digits)
    .reverse()
    .forEach((digit, i) => {
      sum += Number(digit) * ((i % 6) + 2);
    });
  return String((11 - (sum % 11)) % 11);
};

/** The data followed by its check digits */
const withCheckDigits = (digits: string, checkDigits: string) => {
  switch (checkDigits) {
    case "A":
      return digits;
    case "C": {
      const once = digits + mod10(digits);
      return once + mod10(once);
    }
    case "D": {
      const once = digits + mod11(digits);
      return once + mod10(once);
    }
    default:
      return digits + mod10(digits);
  }
};

/**
 * Widths in dots of alternating bars and spaces, and the interpretation
 * line: the data, with the check digits if asked for
 */
const encodeMsi = (
  data: string,
  checkDigits: string,
  printCheckDigit: boolean,
  narrow: number,
  wide: number
) => {
  const digits = data.replace(/\D/g, "");
  const encoded = withCheckDigits(digits, checkDigits);
  const widths = [wide, narrow];
  for (const digit of encoded) {
    for (const bit of Number(digit).toString(2).padStart(4, "0")) {
      widths.push(...(bit === "1" ? [wide, narrow] : [narrow, wide]));
    }
  }
  widths.push(narrow, wide, narrow);
  return { widths, text: printCheckDigit ? encoded : digits };
};

export { encodeMsi };
