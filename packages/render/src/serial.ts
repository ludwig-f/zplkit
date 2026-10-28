/**
 * Serialized field data: what ^SN and ^SF print on each copy that ^PQ
 * prints, as measured from reference renders. `step` counts the copies with
 * different data, from 0 for the first.
 */

/**
 * ^SN: the last run of digits in the start value counts by the increment,
 * within its width. While it fits, leading zeros print as spaces unless
 * kept; once it wraps around, the zeros print.
 */
const serialNumber = (
  start = "1",
  increment = 1,
  leadingZeros = false,
  step: number
): string => {
  const match = /(\d+)(\D*)$/.exec(start);
  if (!match) return start;
  const [, digits, after] = match;
  const before = start.slice(0, match.index);
  const width = digits.length;
  const range = 10 ** width;
  const value = Number(digits) + increment * step;

  let counted: string;
  if (value >= 0 && value < range) {
    counted = String(value).padStart(width, "0");
    if (!leadingZeros) {
      counted = counted.replace(/^0+(?=\d)/, (zeros) =>
        " ".repeat(zeros.length)
      );
    }
  } else {
    counted = String(((value % range) + range) % range).padStart(width, "0");
  }
  return before + counted + after;
};

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The digits each ^SF mask character counts through, in order. The mask's
 * case sets the case of its letters.
 */
const alphabets: Record<string, string> = {
  d: DIGITS,
  D: DIGITS,
  o: "01234567",
  O: "01234567",
  H: DIGITS + "ABCDEF",
  h: DIGITS + "abcdef",
  A: LETTERS,
  a: LETTERS.toLowerCase(),
  N: DIGITS + LETTERS,
  n: DIGITS + LETTERS.toLowerCase(),
};

/**
 * ^SF: the mask lines up with the start of the data and the increment with
 * the end of the mask. Each run of positions holding a digit of their mask
 * is a counter, carrying from one mask character to the next; a carry stops
 * at %, or at a character that isn't one of its mask's digits. The
 * increment's characters are digits of the positions they line up with.
 */
const serializedField = (
  data: string,
  mask: string,
  increment = "1",
  step: number
): string => {
  const negative = increment.startsWith("-");
  const incrementDigits = increment.replace(/^[-+]/, "");
  // The increment's character at each position of the mask, right-aligned
  const offset = mask.length - incrementDigits.length;
  const incrementAt = (position: number) => {
    const digit = alphabets[mask[position]].indexOf(
      incrementDigits[position - offset] ?? ""
    );
    return Math.max(digit, 0);
  };

  /** The digits at a position, if its character is one of them */
  const alphabet = (position: number) => {
    const digits = alphabets[mask[position]];
    const char = data[position];
    return digits && char !== undefined && digits.includes(char)
      ? digits
      : undefined;
  };

  const chars = data.split("");
  let end = Math.min(mask.length, data.length);
  while (end > 0) {
    // A run of counted positions, ending at `end`
    let start = end;
    while (start > 0 && alphabet(start - 1) !== undefined) start--;
    if (start === end) {
      end--;
      continue;
    }

    let value = 0;
    let added = 0;
    let range = 1;
    for (let position = end - 1; position >= start; position--) {
      const digits = alphabet(position)!;
      value += digits.indexOf(chars[position]) * range;
      added += incrementAt(position) * range;
      range *= digits.length;
    }
    const total = value + (negative ? -1 : 1) * added * step;
    let wrapped = ((total % range) + range) % range;
    for (let position = end - 1; position >= start; position--) {
      const digits = alphabet(position)!;
      chars[position] = digits[wrapped % digits.length];
      wrapped = Math.floor(wrapped / digits.length);
    }
    end = start;
  }
  return chars.join("");
};

export { serialNumber, serializedField };
