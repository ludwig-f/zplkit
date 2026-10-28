/**
 * Drawing barcodes. Each symbology is encoded into bar widths or a module
 * grid, then filled as rectangles in dots, so they land on whole dots and
 * turn with the field like text does: the bottom of the symbol acts as the
 * baseline.
 */
import { encodeBars, encodeMatrix, encodeMaxiCode } from "./barcodes/bwip.js";
import { encodeCode11 } from "./barcodes/code11.js";
import { encodeCode128 } from "./barcodes/code128.js";
import { encodeCode39 } from "./barcodes/code39.js";
import { encodeEan13 } from "./barcodes/ean13.js";
import { encodeCodabar } from "./barcodes/codabar.js";
import { encodeMsi } from "./barcodes/msi.js";
import { encodePlessey } from "./barcodes/plessey.js";
import { encodeTwoOf5 } from "./barcodes/two-of-five.js";
import { encodeCode93 } from "./barcodes/code93.js";
import {
  encodeEan8,
  encodeUpcA,
  encodeUpcE,
  encodeUpcEanExtension,
} from "./barcodes/upc-ean.js";
import { encodeInterleaved2of5 } from "./barcodes/interleaved2of5.js";
import { fillPath } from "./raster.js";
import {
  drawGlyphs,
  faceFor,
  placeLine,
  placement,
  scaledFace,
} from "./text.js";
import type { Element } from "./layout.js";
import type { Color, Raster } from "./raster.js";
import type { Face, Place } from "./text.js";

type Barcode = Extract<Element, { kind: "barcode" }>;

/** Each barcode's command, for placeholders */
const codes: Record<Barcode["symbology"]["type"], string> = {
  Code11: "^B1",
  Code128: "^BC",
  Code39: "^B3",
  Interleaved2of5: "^B2",
  Pdf417: "^B7",
  Ean13: "^BE",
  Ean8: "^B8",
  UpcA: "^BU",
  UpcE: "^B9",
  UpcEanExtension: "^BS",
  Code93: "^BA",
  Codabar: "^BK",
  PostalCode: "^BZ",
  Planet: "^B5",
  Gs1DataBar: "^BR",
  MicroPdf417: "^BF",
  Industrial2of5: "^BI",
  Standard2of5: "^BJ",
  Logmars: "^BL",
  Msi: "^BM",
  Plessey: "^BP",
  DataMatrix: "^BX",
  QrCode: "^BQ",
  Aztec: "^BO",
  MaxiCode: "^BD",
};
type Placeholder = Extract<Element, { kind: "placeholder" }>;

/** Gaps between the bars and the interpretation line's character cells */
const GAP_BELOW = 6;
const GAP_ABOVE = 8;

/** How far EAN-13 guard bars reach below the others */
const GUARD_EXTENSION = 13;

/**
 * Text under part of the bars, centered on the span from `from` to `to`,
 * or starting at `from` when they're equal
 */
type TextPart = { text: string; from: number; to: number };

type Linear = {
  kind: "linear";
  /** Widths of alternating bars and spaces in dots, starting with a bar */
  widths: number[];
  /** Bars (by index into widths) that reach below the others */
  guards?: number[];
  height: number;
  line?: "below" | "above";
  text: string;
  /** How the text sits below the bars, if not centered as one line */
  below?: TextPart[];
  /** Boxes in place of the first and last characters (start and stop) */
  boxes?: boolean;
  /** Gap between the bars and text above them, if not GAP_ABOVE */
  gapAbove?: number;
};

type Matrix = {
  kind: "matrix";
  /** Dark modules, row by row */
  modules: number[];
  columns: number;
  moduleSize: number;
  /** Height of each row of modules, if not moduleSize */
  rowHeight?: number;
  /** Moves the symbol down from ^FO, or up from ^FT */
  shift?: { origin: number; typeset: number };
};

/** A postal bar: full height, or one of the shorter kinds */
type PostalBar = "full" | "short" | "ascender" | "descender" | "tracker";

type Postal = {
  kind: "postal";
  bars: PostalBar[];
  /** Bar width and left edges in dots */
  barWidth: number;
  starts: number[];
  height: number;
  line?: "below" | "above";
  text: string;
};

/**
 * Left edges of postal bars: two and a half module widths apart, rounded
 * down, except that at a module width of 3 the first gap is a dot narrower
 */
const postalStarts = (count: number, moduleWidth: number) => {
  const pitch = Math.floor(2.5 * moduleWidth);
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? 0 : i * pitch - (moduleWidth === 3 ? 1 : 0)
  );
};

/** POSTNET and PLANET bars from bwip-js, tall or short */
const twoState = (bcid: string, digits: string): PostalBar[] =>
  encodeBars(bcid, digits, "includecheck").map((bar) =>
    bar.top > 0.7 ? "full" : "short"
  );

/** Intelligent Mail's four kinds of bars from bwip-js */
const fourState = (data: string): PostalBar[] =>
  encodeBars("onecode", data).map(({ bottom, top }) =>
    bottom < 0.1
      ? top > 0.9
        ? "full"
        : "descender"
      : top > 0.9
      ? "ascender"
      : "tracker"
  );

/** Columns and rows of each MicroPDF417 mode, 0 to 33 */
const microPdf417Modes: [columns: number, rows: number][] = [
  [1, 11],
  [1, 14],
  [1, 17],
  [1, 20],
  [1, 24],
  [1, 28],
  [2, 8],
  [2, 11],
  [2, 14],
  [2, 17],
  [2, 20],
  [2, 23],
  [2, 26],
  [3, 6],
  [3, 8],
  [3, 10],
  [3, 12],
  [3, 15],
  [3, 20],
  [3, 26],
  [3, 32],
  [3, 38],
  [3, 44],
  [4, 6],
  [4, 8],
  [4, 10],
  [4, 12],
  [4, 15],
  [4, 20],
  [4, 26],
  [4, 32],
  [4, 38],
  [4, 44],
  [4, 4],
];

/** bwip-js encoders for GS1 DataBar types 1 to 6 */
const dataBarTypes = [
  "databaromni",
  "databartruncated",
  "databarstacked",
  "databarstackedomni",
  "databarlimited",
  "databarexpanded",
];

/** Mod-10 check digit, with digits weighted 3 and 1 from the right */
const gtinCheckDigit = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * ((digits.length - i) % 2 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

/** Lengths of GS1 AIs with predefined lengths, AI included, by first two digits */
const fixedLengths: Record<string, number> = {
  "00": 20,
  "01": 16,
  "02": 16,
  "03": 16,
  "04": 18,
  "11": 8,
  "12": 8,
  "13": 8,
  "14": 8,
  "15": 8,
  "16": 8,
  "17": 8,
  "18": 8,
  "19": 8,
  "20": 4,
  "31": 10,
  "32": 10,
  "33": 10,
  "34": 10,
  "35": 10,
  "36": 10,
  "41": 16,
};

/** How many digits an AI starting with these two digits has */
const aiLength = (prefix: string) =>
  /^(23|24|25|40|41|42)$/.test(prefix)
    ? 3
    : /^(31|32|33|34|35|36|39|7\d|8\d)$/.test(prefix)
    ? 4
    : 2;

/**
 * GS1 element strings without parentheses, like "010001234567890521ABC",
 * with them added. Variable-length values run to a GS character or the end.
 */
const withParentheses = (data: string) => {
  let rest = data;
  let out = "";
  while (rest) {
    const prefix = rest.slice(0, 2);
    const ai = rest.slice(0, aiLength(prefix));
    const fixed = fixedLengths[prefix];
    const end =
      fixed ?? (rest.includes("\x1d") ? rest.indexOf("\x1d") : rest.length);
    out += `(${ai})${rest.slice(ai.length, end)}`;
    rest = rest.slice(end);
    if (rest.startsWith("\x1d")) rest = rest.slice(1);
  }
  return out;
};

/**
 * GS1 DataBar's data for bwip-js. Types 1 to 5 take a GTIN of up to 13
 * digits and add the check digit; Expanded takes GS1 element strings
 * without parentheses around the AIs.
 */
const dataBarText = (data: string, symbology: number) => {
  if (symbology === 6) {
    // Printers encode parentheses as data characters, which bwip-js can't
    if (data.includes("(")) {
      throw new Error("Parentheses in GS1 DataBar Expanded data");
    }
    return withParentheses(data);
  }
  const digits = data.replace(/\D/g, "").slice(0, 13).padStart(13, "0");
  return `(01)${digits}${gtinCheckDigit(digits)}`;
};

/** Default GS1 DataBar module size for each printhead resolution */
const dataBarMagnification = (dpmm: number) =>
  dpmm >= 24 ? 6 : dpmm >= 12 ? 3 : 2;

/** Pixels from bwip-js for 2D symbols, with options like "eclevel=Q" */
const matrix = (bcid: string, text: string, options: string[] = []) =>
  encodeMatrix(bcid, text, options.join(" "));

/** Default QR magnification for each printhead resolution */
const qrMagnification = (dpmm: number) =>
  dpmm <= 6 ? 1 : dpmm <= 8 ? 2 : dpmm <= 12 ? 3 : 6;

/**
 * QR field data starts with the error correction level and input mode,
 * like "QA,": in manual mode a character type (and for bytes, a length)
 * comes before the data
 */
const qrData = (data: string, level: string) => {
  const match = /^([HQML])([AM]),/.exec(data);
  if (!match) return { eclevel: level, text: data };
  let text = data.slice(match[0].length);
  if (match[2] === "M") {
    text = text[0] === "B" ? text.slice(5) : text.slice(1);
  }
  return { eclevel: match[1], text };
};

/**
 * PDF417 columns for a symbol of `count` codewords: the one closest to twice
 * as wide as it's tall, counting each row as 3 modules high, which is how
 * reference renders read Zebra's default of a 1:2 aspect ratio
 */
const pdf417Columns = (count: number) => {
  let best = 1;
  let bestError = Infinity;
  for (let columns = 1; columns <= 30; columns++) {
    const rows = Math.max(3, Math.ceil(count / columns));
    if (rows > 90) continue;
    const error = Math.abs((3 * rows) / (17 * columns + 69) - 0.5);
    if (error < bestError) {
      best = columns;
      bestError = error;
    }
  }
  return best;
};

/** Wide bars and spaces: the module width times ^BY's ratio, rounded down */
const wideOf = (barcode: Barcode) =>
  Math.floor(barcode.moduleWidth * barcode.ratio + 1e-9);

const interpretation = (
  shown: boolean | undefined,
  above: boolean | undefined
): Linear["line"] => (shown === false ? undefined : above ? "above" : "below");

const encode = (barcode: Barcode, dpmm: number): Linear | Matrix | Postal => {
  const { symbology, data, moduleWidth } = barcode;
  switch (symbology.type) {
    case "Code128": {
      const { widths, text } = encodeCode128(data, symbology.mode);
      return {
        kind: "linear",
        widths: widths.map((w) => w * moduleWidth),
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "Code11": {
      const wide = wideOf(barcode);
      const { widths, text } = encodeCode11(
        data,
        symbology.checkDigits ?? 2,
        moduleWidth,
        wide
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        // Reference renders mark the start and stop characters with
        // triangles; we leave their places blank
        text: ` ${text} `,
      };
    }
    case "Code39":
    case "Interleaved2of5": {
      const encoder =
        symbology.type === "Code39" ? encodeCode39 : encodeInterleaved2of5;
      const { widths, text } = encoder(
        data,
        symbology.checkDigit ?? false,
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "Ean13": {
      const { widths, guards, text } = encodeEan13(data);
      const m = moduleWidth;
      return {
        kind: "linear",
        widths: widths.map((w) => w * m),
        guards,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
        // The first digit sits left of the bars, the others under each half
        below: [
          { text: text[0], from: -11 * m, to: -11 * m },
          { text: text.slice(1, 7), from: 3 * m, to: 45 * m },
          { text: text.slice(7), from: 50 * m, to: 92 * m },
        ],
      };
    }
    case "Ean8": {
      const { widths, guards, text } = encodeEan8(data);
      const m = moduleWidth;
      return {
        kind: "linear",
        widths: widths.map((w) => w * m),
        guards,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
        // Four digits under each half, between the guards
        below: [
          { text: text.slice(0, 4), from: 3 * m, to: 31 * m },
          { text: text.slice(4), from: 36 * m, to: 64 * m },
        ],
      };
    }
    case "UpcA": {
      const { widths, guards, text } = encodeUpcA(data);
      const m = moduleWidth;
      const check = symbology.printCheckDigit === false ? "" : text[11];
      return {
        kind: "linear",
        widths: widths.map((w) => w * m),
        guards,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text: text.slice(0, 11) + check,
        // The first digit starts 11 modules left of the bars, like EAN-13's,
        // the last 2 modules right of them, and five are under each half
        below: [
          { text: text[0], from: -11 * m, to: -11 * m },
          { text: text.slice(1, 6), from: 10 * m, to: 45 * m },
          { text: text.slice(6, 11), from: 50 * m, to: 85 * m },
          { text: check, from: 97 * m, to: 97 * m },
        ],
      };
    }
    case "UpcE": {
      const { widths, guards, text } = encodeUpcE(data);
      const m = moduleWidth;
      const check = symbology.printCheckDigit === false ? "" : text[7];
      return {
        kind: "linear",
        widths: widths.map((w) => w * m),
        guards,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text: text.slice(0, 7) + check,
        // The number system and check digit sit outside the bars, as on
        // UPC-A
        below: [
          { text: text[0], from: -11 * m, to: -11 * m },
          { text: text.slice(1, 7), from: 3 * m, to: 45 * m },
          { text: check, from: 53 * m, to: 53 * m },
        ],
      };
    }
    case "UpcEanExtension": {
      const { widths, text } = encodeUpcEanExtension(data);
      return {
        kind: "linear",
        widths: widths.map((w) => w * moduleWidth),
        height: symbology.height ?? barcode.height,
        // Unlike other barcodes, the digits print above the bars by default
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove ?? true
        ),
        text,
        // Right on top of the bars
        gapAbove: 0,
      };
    }
    case "Code93": {
      const { widths, text } = encodeCode93(
        data,
        symbology.printCheckDigit ?? false
      );
      return {
        kind: "linear",
        widths: widths.map((w) => w * moduleWidth),
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        // The start and stop characters print as boxes
        text: ` ${text} `,
        boxes: true,
      };
    }
    case "Codabar": {
      const { widths, text } = encodeCodabar(
        data,
        symbology.start ?? "A",
        symbology.stop ?? "A",
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "Industrial2of5":
    case "Standard2of5": {
      const { widths, text } = encodeTwoOf5(
        symbology.type === "Industrial2of5" ? "industrial" : "standard",
        data,
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "Logmars": {
      // Code 39 with its check digit, always with the interpretation line
      const { widths, text } = encodeCode39(
        data,
        true,
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: symbology.interpretationLineAbove ? "above" : "below",
        // Without the asterisks Code 39 prints around its text
        text: text.replace(/\*/g, ""),
      };
    }
    case "Msi": {
      const { widths, text } = encodeMsi(
        data,
        symbology.checkDigits ?? "B",
        symbology.printCheckDigit ?? false,
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "Plessey": {
      const { widths, text } = encodePlessey(
        data,
        symbology.printCheckDigit ?? false,
        moduleWidth,
        wideOf(barcode)
      );
      return {
        kind: "linear",
        widths,
        height: symbology.height ?? barcode.height,
        line: interpretation(
          symbology.interpretationLine,
          symbology.interpretationLineAbove
        ),
        text,
      };
    }
    case "PostalCode":
    case "Planet": {
      const postalType =
        symbology.type === "Planet" ? 1 : symbology.postalType ?? 0;
      const digits = data.replace(/\D/g, "");
      const bars =
        postalType === 3
          ? fourState(digits)
          : twoState(postalType === 1 ? "planet" : "postnet", digits);
      return {
        kind: "postal",
        bars,
        barWidth: moduleWidth,
        starts: postalStarts(bars.length, moduleWidth),
        height: symbology.height ?? barcode.height,
        // Postal codes print their digits only when asked
        line:
          postalType !== 3 && symbology.interpretationLine
            ? symbology.interpretationLineAbove
              ? "above"
              : "below"
            : undefined,
        text: digits,
      };
    }
    case "Gs1DataBar": {
      const type = symbology.symbology ?? 1;
      const text = dataBarText(data, type);
      let symbol = matrix(dataBarTypes[type - 1], text);
      if (type === 6 && symbology.segments) {
        // Stacked rows start a module further in than a single row, so
        // segments that fit one row keep the single row's spacing
        const stacked = matrix("databarexpandedstacked", text, [
          `segments=${symbology.segments}`,
        ]);
        const rows = (m: typeof symbol) => m.modules.length / m.columns;
        if (rows(stacked) > rows(symbol)) symbol = stacked;
      }
      return {
        kind: "matrix",
        ...symbol,
        moduleSize: symbology.magnification ?? dataBarMagnification(dpmm),
      };
    }
    case "MicroPdf417": {
      const [columns, rows] =
        microPdf417Modes[symbology.mode ?? 0] ?? microPdf417Modes[0];
      return {
        kind: "matrix",
        ...matrix("micropdf417", data, [
          `columns=${columns}`,
          `rows=${rows}`,
          "rowmult=1",
        ]),
        moduleSize: moduleWidth,
        rowHeight: symbology.rowHeight ?? barcode.height,
      };
    }
    case "Pdf417": {
      const options = [`eclevel=${symbology.securityLevel ?? 0}`, "rowmult=1"];
      if (symbology.truncate) options.push("compact");
      if (symbology.rows) options.push(`rows=${symbology.rows}`);
      let columns = symbology.columns;
      if (!columns && !symbology.rows) {
        // In one column, there's a row for each codeword
        const single = matrix("pdf417", data, [...options, "columns=1"]);
        columns = pdf417Columns(single.modules.length / single.columns);
      }
      if (columns) options.push(`columns=${columns}`);
      const symbol = matrix("pdf417", data, options);
      const rows = symbol.modules.length / symbol.columns;
      return {
        kind: "matrix",
        ...symbol,
        moduleSize: moduleWidth,
        rowHeight:
          symbology.rowHeight ?? Math.max(1, Math.floor(barcode.height / rows)),
      };
    }
    case "QrCode": {
      const size = symbology.magnification ?? qrMagnification(dpmm);
      const { eclevel, text } = qrData(data, symbology.errorCorrection ?? "Q");
      return {
        kind: "matrix",
        ...matrix("qrcode", text, [`eclevel=${eclevel}`]),
        moduleSize: size,
        shift: { origin: 10, typeset: 3 * size },
      };
    }
    case "Aztec": {
      const control = symbology.errorControl ?? 0;
      const size = symbology.magnification ?? qrMagnification(dpmm);
      let options: string[];
      if (control >= 101 && control <= 104) {
        options = ["format=compact", `layers=${control - 100}`];
      } else if (control >= 201 && control <= 232) {
        options = ["format=full", `layers=${control - 200}`];
      } else if (control === 300) {
        options = ["format=rune"];
      } else {
        options = control >= 1 && control <= 99 ? [`eclevel=${control}`] : [];
      }
      let symbol;
      if (options.length <= 1) {
        // Printers use the smallest symbol that fits, compact ones first,
        // where bwip-js would sometimes pick a full one of the same size
        for (let layers = 1; layers <= 4 && !symbol; layers++) {
          try {
            symbol = matrix("azteccode", data, [
              ...options,
              "format=compact",
              `layers=${layers}`,
            ]);
          } catch {
            // Too much data for this many layers
          }
        }
      }
      return {
        kind: "matrix",
        ...(symbol ?? matrix("azteccode", data, options)),
        moduleSize: size,
      };
    }
    case "MaxiCode":
      throw new Error("MaxiCode isn't drawn as a matrix");
    case "DataMatrix": {
      const options = [];
      if (symbology.columns) options.push(`columns=${symbology.columns}`);
      if (symbology.rows) options.push(`rows=${symbology.rows}`);
      return {
        kind: "matrix",
        ...matrix("datamatrix", data, options),
        moduleSize: symbology.height ?? 1,
      };
    }
  }
};

/** Fill the rectangle from (u0, v0) to (u1, v1) in barcode coordinates */
const fillRect = (
  raster: Raster,
  place: Place,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  color: Color
) =>
  fillPath(
    raster,
    [[place(u0, v0), place(u1, v0), place(u1, v1), place(u0, v1)]],
    color
  );

/**
 * The interpretation line's font: the field's ^A font if it had one,
 * otherwise font D at half the module width
 */
const interpretationFace = (barcode: Barcode, dpmm: number): Face =>
  barcode.font
    ? faceFor({ ...barcode.font, dpmm })
    : scaledFace("D", barcode.moduleWidth / 2, dpmm);

const advanceOf = (face: Face, text: string) => {
  let advance = 0;
  for (const char of text) advance += face.advance(char);
  return advance;
};

const drawLinear = (
  raster: Raster,
  barcode: Barcode,
  symbol: Linear,
  dpmm: number,
  color: Color
) => {
  const { widths, height, line } = symbol;
  const width = widths.reduce((sum, w) => sum + w, 0);
  const place = placement(
    { width, height, ascent: height, lastBaseline: 0 },
    barcode
  );

  const guards = new Set(symbol.guards);
  const extension = symbol.guards ? GUARD_EXTENSION : 0;
  let u = 0;
  widths.forEach((w, i) => {
    if (i % 2 === 0) {
      const bottom = guards.has(i) ? extension : 0;
      fillRect(raster, place, u, -height, u + w, bottom, color);
    }
    u += w;
  });

  if (!line || !symbol.text) return;
  const face = interpretationFace(barcode, dpmm);
  if (line === "below" && symbol.below) {
    // Laid out under the bars, between the guards
    const top = barcode.moduleWidth > 2 ? 2 * barcode.moduleWidth : 4;
    for (const { text, from, to } of symbol.below) {
      const advance = advanceOf(face, text);
      const start = from === to ? from : (from + to - advance) / 2;
      const glyphs = placeLine(face, text, start, top + face.ascent);
      drawGlyphs(raster, glyphs, place, color);
    }
    return;
  }

  const top =
    line === "below"
      ? GAP_BELOW + extension
      : -height - (symbol.gapAbove ?? GAP_ABOVE) - face.height;
  const advance = advanceOf(face, symbol.text);
  const glyphs = placeLine(
    face,
    symbol.text,
    (width - advance) / 2,
    top + face.ascent
  );
  drawGlyphs(raster, glyphs, place, color);

  if (symbol.boxes) {
    // Outlines a third of the font's height wide and two thirds tall,
    // standing on the baseline in the middle of the first and last cells
    const cell = face.advance(" ");
    const boxWidth = Math.max(3, Math.round(face.height / 3));
    const boxHeight = Math.max(3, Math.round((2 * face.height) / 3));
    const lineWidth = Math.max(1, Math.round(face.height / 18));
    const baseline = top + face.ascent;
    const start = (width - advance) / 2;
    for (const left of [start, start + advance - cell]) {
      const x0 = Math.round(left + (cell - boxWidth) / 2);
      const x1 = x0 + boxWidth;
      const y0 = baseline - boxHeight;
      fillRect(raster, place, x0, y0, x1, y0 + lineWidth, color);
      fillRect(raster, place, x0, baseline - lineWidth, x1, baseline, color);
      fillRect(raster, place, x0, y0, x0 + lineWidth, baseline, color);
      fillRect(raster, place, x1 - lineWidth, y0, x1, baseline, color);
    }
  }
};

/** Rows each kind of postal bar covers, from the top of the tallest */
const postalRows = (bar: PostalBar, height: number): [number, number] => {
  // Intelligent Mail: ascenders and descenders two thirds of the height,
  // the tracker a third, starting where the descenders do
  const long = Math.floor((2 * height) / 3);
  const tracker = Math.floor(height / 3);
  switch (bar) {
    case "full":
      return [0, height];
    case "short":
      return [height - Math.floor(0.4 * height), height];
    case "ascender":
      return [0, long];
    case "descender":
      return [height - long, height];
    case "tracker":
      return [height - long, height - long + tracker];
  }
};

const drawPostal = (
  raster: Raster,
  barcode: Barcode,
  symbol: Postal,
  dpmm: number,
  color: Color
) => {
  const { bars, starts, barWidth, height, line } = symbol;
  const width = starts[starts.length - 1] + barWidth;
  const place = placement(
    { width, height, ascent: height, lastBaseline: 0 },
    barcode
  );
  bars.forEach((bar, i) => {
    const [top, bottom] = postalRows(bar, height);
    fillRect(
      raster,
      place,
      starts[i],
      top - height,
      starts[i] + barWidth,
      bottom - height,
      color
    );
  });

  if (!line) return;
  const face = interpretationFace(barcode, dpmm);
  const top = line === "below" ? GAP_BELOW : -height - GAP_ABOVE - face.height;
  const advance = advanceOf(face, symbol.text);
  const glyphs = placeLine(
    face,
    symbol.text,
    (width - advance) / 2,
    top + face.ascent
  );
  drawGlyphs(raster, glyphs, place, color);
};

const drawMatrix = (
  raster: Raster,
  barcode: Barcode,
  symbol: Matrix,
  color: Color
) => {
  const { modules, columns, moduleSize } = symbol;
  const rowHeight = symbol.rowHeight ?? moduleSize;
  const rows = modules.length / columns;
  const size = columns * moduleSize;
  const height = rows * rowHeight;
  const shift = symbol.shift;
  const y = barcode.fromBottom
    ? barcode.y - (shift?.typeset ?? 0)
    : barcode.y + (shift?.origin ?? 0);
  const place = placement(
    { width: size, height, ascent: height, lastBaseline: 0 },
    { ...barcode, y }
  );

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (!modules[row * columns + column]) continue;
      const u = column * moduleSize;
      const v = row * rowHeight - height;
      fillRect(raster, place, u, v, u + moduleSize, v + rowHeight, color);
    }
  }
};

/**
 * Zebra's MaxiCode data for modes 2 and 3 starts with the class of service,
 * country code and postal code (9 digits in mode 2, 6 characters in mode 3);
 * bwip-js wants them in the carrier message, after its [)> header if any
 */
const maxiCodeData = (data: string, mode: number) => {
  if (mode !== 2 && mode !== 3) return data;
  const end = 6 + (mode === 2 ? 9 : 6);
  const service = data.slice(0, 3);
  const country = data.slice(3, 6);
  const postal = data.slice(6, end);
  const rest = data.slice(end);
  const carrier = `${postal}\x1d${country}\x1d${service}\x1d`;
  // The header is [)> RS 01 GS and a two-digit year
  const header = "[)>\x1e01\x1d";
  const length = /^\d\d/.test(rest.slice(header.length))
    ? header.length + 2
    : 0;
  const hasHeader = rest.startsWith(header) && length > 0;
  return hasHeader
    ? rest.slice(0, length) + carrier + rest.slice(length)
    : carrier + rest;
};

/** MaxiCode is always about 25 by 24 mm, and can't be turned */
const drawMaxiCode = (
  raster: Raster,
  barcode: Barcode,
  mode: number,
  dpmm: number,
  color: Color
) => {
  const width = 25 * dpmm;
  const height = 24.125 * dpmm;
  // ^FT puts its bottom a little above y
  const y = barcode.fromBottom ? barcode.y - (3 * dpmm) / 8 : barcode.y;
  const place = placement(
    { width, height, ascent: height, lastBaseline: 0 },
    { ...barcode, y }
  );
  const paths = encodeMaxiCode(maxiCodeData(barcode.data, mode), mode);
  fillPath(
    raster,
    paths.map((path) =>
      path.map(([u, v]) => place(u * width, v * height - height))
    ),
    color
  );
};

const drawBarcode = (
  raster: Raster,
  barcode: Barcode,
  dpmm: number,
  color: Color
): void => {
  if (barcode.symbology.type === "MaxiCode") {
    drawMaxiCode(raster, barcode, barcode.symbology.mode ?? 2, dpmm, color);
    return;
  }
  let symbol: ReturnType<typeof encode>;
  try {
    symbol = encode(barcode, dpmm);
  } catch {
    // Data the symbology can't encode, like a postal code of the wrong length
    drawPlaceholder(
      raster,
      {
        ...barcode,
        kind: "placeholder",
        code: codes[barcode.symbology.type],
        reason: "data",
      },
      dpmm,
      color
    );
    return;
  }
  if (symbol.kind === "linear") {
    drawLinear(raster, barcode, symbol, dpmm, color);
  } else if (symbol.kind === "postal") {
    drawPostal(raster, barcode, symbol, dpmm, color);
  } else {
    drawMatrix(raster, barcode, symbol, color);
  }
};

/**
 * A crossed-out box in place of a barcode we can't draw yet, naming the
 * command, so a preview doesn't silently leave it out
 */
const drawPlaceholder = (
  raster: Raster,
  placeholder: Placeholder,
  dpmm: number,
  color: Color
): void => {
  const text =
    placeholder.reason === "invalid"
      ? `${placeholder.code} has invalid parameters`
      : placeholder.reason === "data"
      ? `${placeholder.code} can't encode this data`
      : `${placeholder.code} not supported`;
  // Font D, magnified so it stays legible at higher resolutions
  const face = faceFor({
    font: "D",
    height: 18 * Math.max(1, Math.round(dpmm / 8)),
    dpmm,
  });
  const advance = advanceOf(face, text);
  const padding = face.height;
  const width = Math.ceil(advance + 2 * padding);
  const line = Math.max(1, Math.round(dpmm / 4));
  // Room for the text and the diagonals around it, whatever ^BY's height
  const height = Math.max(placeholder.height, 2 * face.height + 2 * line);
  const place = placement(
    { width, height, ascent: height, lastBaseline: 0 },
    placeholder
  );
  // Outline and diagonals, with the bottom edge at v = 0
  fillRect(raster, place, 0, -height, width, -height + line, color);
  fillRect(raster, place, 0, -line, width, 0, color);
  fillRect(raster, place, 0, -height, line, 0, color);
  fillRect(raster, place, width - line, -height, width, 0, color);
  fillPath(
    raster,
    [
      [
        place(0, -height),
        place(0, -height + line),
        place(width, 0),
        place(width, -line),
      ],
      [
        place(0, 0),
        place(0, -line),
        place(width, -height + line),
        place(width, -height),
      ],
    ],
    color
  );

  // The name on a clear band across the middle
  const top = (-height - face.height) / 2;
  const clear = color === "B" ? "W" : "B";
  fillRect(
    raster,
    place,
    padding / 2,
    top - 2,
    width - padding / 2,
    top + face.height + 2,
    clear
  );
  const glyphs = placeLine(face, text, padding, top + face.ascent);
  drawGlyphs(raster, glyphs, place, color);
};

export { drawBarcode, drawPlaceholder };
