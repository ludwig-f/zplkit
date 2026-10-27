/**
 * Code 128 (^BC) the way Zebra printers encode it. Without a mode, field
 * data is read with Zebra's invocation codes: subset B unless a start code
 * says otherwise, and >x codes for start, shift and function characters.
 * Automatic mode leaves choosing subsets to bwip-js.
 */
import { encodeLinear } from "./bwip.js";
import { patterns } from "./code128-patterns.js";
import type { LinearSymbol } from "./linear.js";

type Mode = "N" | "U" | "A" | "D";

const STOP = 106;
const FNC1 = 102;

/** Values the >x invocation codes stand for */
const invocations: Record<string, number> = {
  "<": 62,
  "0": 30,
  "=": 94,
  "1": 95,
  "2": 96,
  "3": 97,
  "4": 98,
  "5": 99,
  "6": 100,
  "7": 101,
  "8": 102,
  "9": 103,
  ":": 104,
  ";": 105,
};

const isDigit = (char: string | undefined) =>
  char !== undefined && char >= "0" && char <= "9";

/**
 * Symbol values for field data with Zebra's invocation codes, from the
 * start character to the check character.
 */
const code128Values = (data: string): number[] => {
  const values: number[] = [];
  let subset: "A" | "B" | "C" = "B";
  let shifted = false;
  let i = 0;

  const start = /^>[9:;]/.exec(data);
  if (start) {
    values.push(invocations[data[1]]);
    subset = data[1] === "9" ? "A" : data[1] === ":" ? "B" : "C";
    i = 2;
  } else {
    values.push(104);
  }

  while (i < data.length) {
    const char = data[i];
    const code = invocations[data[i + 1]];
    if (char === ">" && code !== undefined) {
      values.push(code);
      // Code C, B and A switch subsets (or are FNC 4 in the subset they name)
      if (code === 99) subset = "C";
      if (code === 100) subset = "B";
      if (code === 101) subset = "A";
      i += 2;
      // In subset A, the character after a shift is read as subset B
      shifted = code === 98 && subset === "A";
      continue;
    }

    if (subset === "B" || shifted) {
      shifted = false;
      values.push((char.charCodeAt(0) - 32) & 0x7f);
      i++;
      continue;
    }

    // Subsets A and C take pairs of digits as values. A pair that doesn't
    // start with a digit loses that character; one that doesn't end with a
    // digit is dropped, as is a digit without a partner.
    if (!isDigit(char)) {
      i++;
      continue;
    }
    const next = data[i + 1];
    if (isDigit(next)) values.push(Number(char + next));
    i += next === ">" && invocations[data[i + 2]] !== undefined ? 1 : 2;
  }

  // Check character: start plus each value times its position, modulo 103
  const sum = values.reduce(
    (total, value, position) => total + value * Math.max(position, 1),
    0
  );
  values.push(sum % 103);
  return values;
};

/** Field data as printed in the interpretation line */
const readable = (data: string) =>
  data
    .replace(/>([0=])/g, (_, code: string) => (code === "0" ? ">" : "~"))
    .replace(/>[<1-9:;]/g, "");

const widthsFor = (values: number[]) =>
  [...values, STOP].flatMap((value) => patterns[value]);

/** GS1 check digit: digits weighted 3 and 1 from the right, modulo 10 */
const gs1CheckDigit = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

/** Bar and space widths from bwip-js, which picks subsets itself */
const automatic = (text: string, parsefnc = false): number[] =>
  encodeLinear("code128", text, parsefnc ? "parsefnc" : "");

const encodeCode128 = (data: string, mode: Mode = "N"): LinearSymbol => {
  switch (mode) {
    case "A":
      return { widths: automatic(data), text: data };
    case "D": {
      // UCC/EAN-128: parentheses and spaces only show in the text
      const content = data.replace(/[()\s]/g, "").replace(/>8/g, "^FNC1");
      const text = data.replace(/>8/g, "");
      const fnc = content.startsWith("^FNC1") ? content : `^FNC1${content}`;
      return { widths: automatic(fnc, true), text };
    }
    case "U": {
      // 19 digits, padded with zeros, then a check digit, all in subset C
      const digits = data.replace(/\D/g, "").padEnd(19, "0").slice(0, 19);
      const all = digits + gs1CheckDigit(digits);
      const pairs = all.match(/../g)!.map(Number);
      const values = [105, FNC1, ...pairs];
      const sum = values.reduce(
        (total, value, position) => total + value * Math.max(position, 1),
        0
      );
      return { widths: widthsFor([...values, sum % 103]), text: all };
    }
    default:
      return { widths: widthsFor(code128Values(data)), text: readable(data) };
  }
};

export type { Mode as Code128Mode };
export { code128Values, encodeCode128 };
