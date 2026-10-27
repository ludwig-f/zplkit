// The tree-shakable encoders must give exactly what bwip-js's raw() does
import { test, expect } from "vitest";
import bwipjs from "bwip-js";
import { encodeBars, encodeLinear, encodeMatrix } from "./bwip.js";

const raw = (bcid: string, text: string, options: string) => {
  const [symbol] = bwipjs.raw(bcid, text, options);
  return symbol;
};

test.each([
  ["qrcode", "hello", "eclevel=Q"],
  ["qrcode", "hello world hello world", "eclevel=L"],
  ["qrcode", "https://github.com/ludwig-f/node-zpl", "eclevel=H"],
  ["datamatrix", "hello", ""],
  ["datamatrix", "hello", "columns=20 rows=20"],
  ["datamatrix", "https://github.com/ludwig-f/node-zpl", ""],
  ["pdf417", "hello", "eclevel=0 rowmult=1 columns=3"],
  ["pdf417", "hello", "eclevel=5 rowmult=1 columns=1"],
  ["pdf417", "hello", "eclevel=0 rowmult=1 columns=3 compact"],
  ["pdf417", "The quick brown fox 1234567890", "eclevel=2 rowmult=1"],
  ["micropdf417", "ABCDEFGHIJKLMNOPQRSTUV", "columns=1 rows=20 rowmult=1"],
  ["micropdf417", "hello", "columns=2 rows=8 rowmult=1"],
])("%s %j %s", (bcid, text, options) => {
  const expected = raw(bcid, text, options) as { pixs: number[]; pixx: number };
  expect(encodeMatrix(bcid, text, options)).toStrictEqual({
    modules: expected.pixs,
    columns: expected.pixx,
  });
});

test.each([
  ["code128", "12345678", ""],
  ["code128", "AB12cd", ""],
  ["code128", "^FNC1011234567890", "parsefnc"],
])("%s %j %s", (bcid, text, options) => {
  const expected = raw(bcid, text, options) as { sbs: number[] };
  expect(encodeLinear(bcid, text, options)).toStrictEqual(expected.sbs);
});

/** Rows of modules as strings, with repeated rows given once */
const distinctRows = (modules: ArrayLike<number>, columns: number) => {
  const rows: string[] = [];
  for (let i = 0; i < modules.length; i += columns) {
    const row = Array.from(modules)
      .slice(i, i + columns)
      .join("");
    if (row !== rows[rows.length - 1]) rows.push(row);
  }
  return rows;
};

test.each([
  ["databaromni", "(01)00012345678905", "", 33],
  ["databartruncated", "(01)00012345678905", "", 13],
  ["databarlimited", "(01)00012345678905", "", 10],
  ["databarexpanded", "(01)00012345678905(21)ABC", "", 34],
  ["databarstacked", "(01)00012345678905", "", 13],
  ["databarstackedomni", "(01)00012345678905", "", 69],
  ["databarexpandedstacked", "(01)00012345678905(21)ABC", "segments=4", 71],
])("%s %j %s", (bcid, text, options, height) => {
  const expected = raw(bcid, text, options) as {
    sbs?: number[];
    pixs?: number[];
    pixx?: number;
  };
  // Linear symbols start with a space, so read them as rows of modules,
  // leaving out the blank modules raw() adds after DataBar Limited
  const rows = expected.sbs
    ? [
        expected.sbs
          .map((w, i) => (i % 2 ? "0" : "1").repeat(w))
          .join("")
          .replace(/0+$/, ""),
      ]
    : distinctRows(expected.pixs!, expected.pixx!).filter((row) =>
        row.includes("1")
      );
  const { modules, columns } = encodeMatrix(bcid, text, options);
  expect(
    distinctRows(modules, columns)
      .filter((row) => row.includes("1"))
      .map((row) => (expected.sbs ? row.replace(/0+$/, "") : row))
  ).toStrictEqual(rows);
  // As tall as the symbol, in modules
  const drawn = distinctRows(modules, columns).length;
  expect(Math.floor(modules.length / columns)).toBeGreaterThanOrEqual(height);
  expect(drawn).toBeGreaterThan(0);
});

test.each([
  ["postnet", "12345", "includecheck"],
  ["planet", "12345678901", "includecheck"],
  ["onecode", "00123123456123456789", ""],
])("%s %j %s bars", (bcid, text, options) => {
  const expected = raw(bcid, text, options) as {
    sbs: number[];
    bhs: number[];
    bbs: number[];
  };
  const bars = encodeBars(bcid, text, options);
  expect(bars.length).toBe(expected.bhs.length);
  // Tops and bottoms as fractions of the tallest bar, from the bottom
  const tallest = Math.max(...expected.bhs.map((h, i) => h + expected.bbs[i]));
  bars.forEach((bar, i) => {
    expect(bar.bottom).toBeCloseTo(expected.bbs[i] / tallest, 5);
    expect(bar.top).toBeCloseTo(
      (expected.bbs[i] + expected.bhs[i]) / tallest,
      5
    );
  });
});
