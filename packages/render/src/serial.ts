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

/** The base each ^SF mask character counts in */
const bases: Record<string, number> = { d: 10, o: 8, h: 16 };

/** Whether a mask has characters the renderer doesn't count yet */
const hasUncountedMask = (mask: string): boolean => /[an]/i.test(mask);

/**
 * ^SF: the mask lines up with the start of the data and the increment with
 * the end of the mask. Each run of characters the mask counts is its own
 * counter: a carry stops at %, at a mask character we don't count, or at a
 * character that isn't a digit in the mask's base.
 */
const serializedField = (
  data: string,
  mask: string,
  increment = "1",
  step: number
): string => {
  const negative = increment.startsWith("-");
  const incrementDigits = increment.replace(/^[-+]/, "");
  // The increment's digit at each position of the mask, right-aligned
  const offset = mask.length - incrementDigits.length;
  const incrementAt = (position: number) => {
    const char = incrementDigits[position - offset];
    return char === undefined ? 0 : parseInt(char, 36) || 0;
  };

  const base = (position: number) => {
    const char = data[position];
    const radix = bases[mask[position]?.toLowerCase()];
    if (!radix || char === undefined) return undefined;
    const digit = parseInt(char, 36);
    return Number.isNaN(digit) || digit >= radix ? undefined : radix;
  };

  const chars = data.split("");
  let end = Math.min(mask.length, data.length);
  while (end > 0) {
    // A run of counted positions, ending at `end`
    let start = end;
    while (start > 0 && base(start - 1) !== undefined) start--;
    if (start === end) {
      end--;
      continue;
    }

    let value = 0;
    let added = 0;
    let range = 1;
    for (let position = end - 1; position >= start; position--) {
      const radix = base(position)!;
      value += parseInt(chars[position], 36) * range;
      added += incrementAt(position) * range;
      range *= radix;
    }
    const total = value + (negative ? -1 : 1) * added * step;
    let wrapped = ((total % range) + range) % range;
    const lowercase = /[a-z]/.test(data.slice(start, end));
    for (let position = end - 1; position >= start; position--) {
      const radix = base(position)!;
      const digit = (wrapped % radix).toString(radix);
      chars[position] = lowercase ? digit : digit.toUpperCase();
      wrapped = Math.floor(wrapped / radix);
    }
    end = start;
  }
  return chars.join("");
};

export { serialNumber, serializedField, hasUncountedMask };
