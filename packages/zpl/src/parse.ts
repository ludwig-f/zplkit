import { compact } from "./compact.js";
import type { Command, Span } from "./ast.js";

/** A problem parse() found while reading the ZPL */
type Diagnostic = {
  /** Parse problems are always warnings: the printer still prints */
  severity: "warning";
  /** A parameter that couldn't be read, or text the printer skips */
  rule: "invalid-parameter" | "ignored-text";
  /** What's wrong, in a sentence */
  message: string;
  /** Where in the text, as character offsets */
  span: Span;
};

/** What parse() returns */
type ParseResult = {
  /** Typed nodes for supported commands, Raw nodes for everything else */
  commands: Command[];
  /** Parameters that couldn't be read, and text the printer skips */
  diagnostics: Diagnostic[];
};

/** Thrown by parameter readers, turned into a diagnostic and a Raw node */
class ParamError extends Error {}

/**
 * Reads the parameters of one command
 */
class Params {
  constructor(
    private readonly code: string,
    private readonly values: string[]
  ) {}

  get length(): number {
    return this.values.filter((value) => value.trim() !== "").length;
  }

  /** A parameter, without the spaces printers ignore around it */
  string(index: number): string | undefined {
    const value = this.values[index]?.trim();
    return value === undefined || value === "" ? undefined : value;
  }

  requiredString(index: number, name: string): string {
    const value = this.string(index);

    if (value === undefined) {
      throw new ParamError(`${this.code}: ${name} is required`);
    }

    return value;
  }

  /**
   * A number, which can have decimals: printers round positions and sizes
   * to the nearest dot, and ^MU makes them millimeters or inches
   */
  number(index: number, name: string): number | undefined {
    const value = this.string(index);

    if (value === undefined) {
      return undefined;
    }

    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      throw new ParamError(
        `${this.code}: ${name} must be a number, got '${value}'`
      );
    }

    return Number(value);
  }

  requiredNumber(index: number, name: string, fallback?: number): number {
    const value = this.number(index, name) ?? fallback;

    if (value === undefined) {
      throw new ParamError(`${this.code}: ${name} is required`);
    }

    return value;
  }

  oneOf<T extends string | number>(
    index: number,
    name: string,
    options: readonly T[]
  ): T | undefined {
    const value = this.string(index);

    if (value === undefined) {
      return undefined;
    }

    const option = options.find((option) => String(option) === value);

    if (option === undefined) {
      throw new ParamError(
        `${this.code}: ${name} must be one of ${options.join(
          ", "
        )}, got '${value}'`
      );
    }

    return option;
  }

  /** A print speed: inches per second, or A to E */
  speed(
    index: number,
    name: string
  ): number | "A" | "B" | "C" | "D" | "E" | undefined {
    const value = this.string(index);
    if (value === undefined) return undefined;
    if (/^[A-E]$/.test(value)) return value as "A" | "B" | "C" | "D" | "E";
    return this.number(index, name);
  }

  yesNo(index: number, name: string): boolean | undefined {
    const value = this.oneOf(index, name, ["Y", "N"] as const);
    return value === undefined ? undefined : value === "Y";
  }
}

const orientations = ["N", "R", "I", "B"] as const;
const colors = ["B", "W"] as const;
const devices = ["R", "E", "B", "A"] as const;

const storedObject = (code: string, value: string) => {
  const object = objectPath(code, value);

  if (!object.device) {
    throw new ParamError(
      `${code}: expected an object like R:NAME.GRF, got '${value}'`
    );
  }

  return { ...object, device: object.device };
};

/** An object like R:NAME.TTF, where the device may be left out */
const objectPath = (code: string, value: string) => {
  const match = /^(?:([REBA]):)?([^.:]+)\.(\w+)$/.exec(value);

  if (!match) {
    throw new ParamError(
      `${code}: expected an object like R:NAME.GRF, got '${value}'`
    );
  }

  return {
    device: match[1] as (typeof devices)[number] | undefined,
    name: match[2],
    extension: match[3],
  };
};

/**
 * Split on the delimiter, keeping everything after the first `count - 1`
 * delimiters in the last part. Used for commands that end in free-form data.
 */
const splitN = (body: string, delimiter: string, count: number): string[] => {
  const parts = body.split(delimiter);
  return [
    ...parts.slice(0, count - 1),
    ...(parts.length >= count ? [parts.slice(count - 1).join(delimiter)] : []),
  ];
};

const downloadFont = (
  code: "~DU" | "~DT",
  body: string,
  delimiter: string
): Command => {
  const p = new Params(code, splitN(body, delimiter, 3));

  return {
    type: "DownloadFont",
    bounded: code === "~DT",
    ...storedObject(code, p.requiredString(0, "object")),
    size: p.requiredNumber(1, "size"),
    data: p.string(2) ?? "",
  };
};

type CommandParser = (body: string, delimiter: string) => Command | null;

/** Commands without parameters, where any text after them is ignored */
const withoutParams = new Set(["^XA", "^XZ", "^FR", "^FS"]);

/** Builds a parser for a command whose body is a plain parameter list */
const withParams =
  (code: string, build: (params: Params) => Command | null) =>
  (body: string, delimiter: string) =>
    build(new Params(code, body.split(delimiter)));

/**
 * Parsers keyed by prefix kind and command code. Returning null means the
 * command is valid but uses a feature without a typed node, so it is kept as
 * Raw without a diagnostic.
 */
const parsers: Record<string, CommandParser> = {
  "^XA": () => ({ type: "StartFormat" }),
  "^XZ": () => ({ type: "EndFormat" }),
  "^PW": withParams("^PW", (p) => ({
    type: "PrintWidth",
    width: p.requiredNumber(0, "width"),
  })),
  "^LL": withParams("^LL", (p) => ({
    type: "LabelLength",
    length: p.requiredNumber(0, "length"),
  })),
  "^LH": withParams("^LH", (p) => ({
    type: "LabelHome",
    x: p.requiredNumber(0, "x", 0),
    y: p.requiredNumber(1, "y", 0),
  })),
  "^LS": withParams("^LS", (p) => ({
    type: "LabelShift",
    shift: p.number(0, "shift"),
  })),
  "^LT": withParams("^LT", (p) => ({
    type: "LabelTop",
    offset: p.number(0, "offset"),
  })),
  "^MU": withParams("^MU", (p) => ({
    type: "MeasurementUnits",
    unit: p.oneOf(0, "unit", ["D", "I", "M"] as const),
    baseDpi: p.number(1, "base resolution"),
    targetDpi: p.number(2, "desired resolution"),
  })),
  "^LR": withParams("^LR", (p) => {
    const reverse = p.yesNo(0, "reverse");
    return reverse === undefined ? null : { type: "LabelReverse", reverse };
  }),
  "^PM": withParams("^PM", (p) => {
    const mirror = p.yesNo(0, "mirror");
    return mirror === undefined ? null : { type: "PrintMirror", mirror };
  }),
  "^CI": withParams("^CI", (p) =>
    // Character remapping (^CIa,s1,d1,...) has no typed node
    p.length > 1
      ? null
      : { type: "ChangeEncoding", charset: p.requiredNumber(0, "charset") }
  ),
  "^CF": withParams("^CF", (p) => ({
    type: "DefaultFont",
    font: p.requiredString(0, "font"),
    height: p.number(1, "height"),
    width: p.number(2, "width"),
  })),
  "^FW": withParams("^FW", (p) => {
    const orientation = p.oneOf(0, "orientation", orientations);

    if (!orientation) {
      throw new ParamError("^FW: orientation is required");
    }

    return {
      type: "FieldOrientation",
      orientation,
      justification: p.oneOf(1, "justification", [0, 1, 2] as const),
    };
  }),
  "^FO": withParams("^FO", (p) => ({
    type: "FieldOrigin",
    x: p.requiredNumber(0, "x", 0),
    y: p.requiredNumber(1, "y", 0),
    justification: p.oneOf(2, "justification", [0, 1, 2] as const),
  })),
  "^FT": withParams("^FT", (p) => ({
    type: "FieldTypeset",
    x: p.number(0, "x"),
    y: p.number(1, "y"),
    justification: p.oneOf(2, "justification", [0, 1, 2] as const),
  })),
  // The font name is a single character directly after ^A, followed by the
  // orientation without a delimiter: ^A0N,30,30
  "^A": (body, delimiter) => {
    const p = new Params("^A", body.slice(1).split(delimiter));
    const font = body.charAt(0);

    if (!font) {
      throw new ParamError("^A: font is required");
    }

    return {
      type: "Font",
      font,
      orientation: p.oneOf(0, "orientation", orientations),
      height: p.number(1, "height"),
      width: p.number(2, "width"),
    };
  },
  "^FB": withParams("^FB", (p) => ({
    type: "FieldBlock",
    width: p.requiredNumber(0, "width", 0),
    maxLines: p.number(1, "maxLines"),
    lineSpacing: p.number(2, "lineSpacing"),
    justification: p.oneOf(3, "justification", ["L", "C", "R", "J"] as const),
    hangingIndent: p.number(4, "hangingIndent"),
  })),
  "^FR": () => ({ type: "FieldReverse" }),
  "^FH": (body) => ({
    type: "FieldHexIndicator",
    indicator: body || undefined,
  }),
  "^FD": (body) => ({ type: "FieldData", data: body }),
  "^FV": (body) => ({ type: "FieldData", data: body, variable: true }),
  "^FN": (body) => {
    const match = /^(\d+)(?:"([^"]*)"?)?$/.exec(body);
    if (!match) {
      throw new ParamError(`^FN: expected a field number, got '${body}'`);
    }
    return {
      type: "FieldNumber",
      number: Number(match[1]),
      prompt: match[2],
    };
  },
  "^FS": () => ({ type: "FieldSeparator" }),
  "^FX": (body) => ({ type: "Comment", text: body }),
  "^GB": withParams("^GB", (p) => ({
    type: "GraphicBox",
    width: p.number(0, "width"),
    height: p.number(1, "height"),
    thickness: p.number(2, "thickness"),
    color: p.oneOf(3, "color", colors),
    rounding: p.oneOf(4, "rounding", [0, 1, 2, 3, 4, 5, 6, 7, 8] as const),
  })),
  "^GC": withParams("^GC", (p) => ({
    type: "GraphicCircle",
    diameter: p.number(0, "diameter"),
    thickness: p.number(1, "thickness"),
    color: p.oneOf(2, "color", colors),
  })),
  "^GE": withParams("^GE", (p) => ({
    type: "GraphicEllipse",
    width: p.number(0, "width"),
    height: p.number(1, "height"),
    thickness: p.number(2, "thickness"),
    color: p.oneOf(3, "color", colors),
  })),
  "^GD": withParams("^GD", (p) => ({
    type: "GraphicDiagonal",
    width: p.number(0, "width"),
    height: p.number(1, "height"),
    thickness: p.number(2, "thickness"),
    color: p.oneOf(3, "color", colors),
    direction: p.oneOf(4, "direction", ["R", "L"] as const),
  })),
  "^GF": (body, delimiter) => {
    const p = new Params("^GF", splitN(body, delimiter, 5));

    // Binary and compressed binary graphics have no typed node
    if (p.string(0) !== "A") {
      return null;
    }

    return {
      type: "GraphicField",
      byteCount: p.requiredNumber(1, "byteCount"),
      fieldCount: p.requiredNumber(2, "fieldCount"),
      bytesPerRow: p.requiredNumber(3, "bytesPerRow"),
      data: p.string(4) ?? "",
    };
  },
  "^XG": withParams("^XG", (p) => {
    const object = storedObject("^XG", p.requiredString(0, "object"));

    if (object.extension !== "GRF") {
      return null;
    }

    return {
      type: "RecallGraphic",
      device: object.device,
      name: object.name,
      magnificationX: p.number(1, "magnificationX"),
      magnificationY: p.number(2, "magnificationY"),
    };
  }),
  "^BY": withParams("^BY", (p) => ({
    type: "BarcodeDefaults",
    moduleWidth: p.number(0, "moduleWidth"),
    ratio: p.number(1, "ratio"),
    height: p.number(2, "height"),
  })),
  "^B1": withParams("^B1", (p) => {
    const checkDigit = p.yesNo(1, "checkDigit");

    return {
      type: "Code11",
      orientation: p.oneOf(0, "orientation", orientations),
      checkDigits:
        checkDigit === undefined ? undefined : checkDigit ? 1 : (2 as const),
      height: p.number(2, "height"),
      interpretationLine: p.yesNo(3, "interpretationLine"),
      interpretationLineAbove: p.yesNo(4, "interpretationLineAbove"),
    };
  }),
  "^BC": withParams("^BC", (p) => ({
    type: "Code128",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    uccCheckDigit: p.yesNo(4, "uccCheckDigit"),
    mode: p.oneOf(5, "mode", ["N", "U", "A", "D"] as const),
  })),
  "^B3": withParams("^B3", (p) => ({
    type: "Code39",
    orientation: p.oneOf(0, "orientation", orientations),
    checkDigit: p.yesNo(1, "checkDigit"),
    height: p.number(2, "height"),
    interpretationLine: p.yesNo(3, "interpretationLine"),
    interpretationLineAbove: p.yesNo(4, "interpretationLineAbove"),
  })),
  "^B2": withParams("^B2", (p) => ({
    type: "Interleaved2of5",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    checkDigit: p.yesNo(4, "checkDigit"),
  })),
  "^B7": withParams("^B7", (p) => ({
    type: "Pdf417",
    orientation: p.oneOf(0, "orientation", orientations),
    rowHeight: p.number(1, "rowHeight"),
    securityLevel: p.oneOf(2, "securityLevel", [
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ] as const),
    columns: p.number(3, "columns"),
    rows: p.number(4, "rows"),
    truncate: p.yesNo(5, "truncate"),
  })),
  "^BE": withParams("^BE", (p) => ({
    type: "Ean13",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^B8": withParams("^B8", (p) => ({
    type: "Ean8",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^BU": withParams("^BU", (p) => ({
    type: "UpcA",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    printCheckDigit: p.yesNo(4, "printCheckDigit"),
  })),
  "^B9": withParams("^B9", (p) => ({
    type: "UpcE",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    printCheckDigit: p.yesNo(4, "printCheckDigit"),
  })),
  "^BS": withParams("^BS", (p) => ({
    type: "UpcEanExtension",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^BA": withParams("^BA", (p) => ({
    type: "Code93",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    printCheckDigit: p.yesNo(4, "printCheckDigit"),
  })),
  "^BK": withParams("^BK", (p) => {
    // The check digit parameter is fixed at N
    p.oneOf(1, "checkDigit", ["N"] as const);
    return {
      type: "Codabar",
      orientation: p.oneOf(0, "orientation", orientations),
      height: p.number(2, "height"),
      interpretationLine: p.yesNo(3, "interpretationLine"),
      interpretationLineAbove: p.yesNo(4, "interpretationLineAbove"),
      start: p.oneOf(5, "start", ["A", "B", "C", "D"] as const),
      stop: p.oneOf(6, "stop", ["A", "B", "C", "D"] as const),
    };
  }),
  "^BZ": withParams("^BZ", (p) => ({
    type: "PostalCode",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
    postalType: p.oneOf(4, "postalType", [0, 1, 3] as const),
  })),
  "^B5": withParams("^B5", (p) => ({
    type: "Planet",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^BR": withParams("^BR", (p) => ({
    type: "Gs1DataBar",
    orientation: p.oneOf(0, "orientation", orientations),
    symbology: p.oneOf(1, "symbology", [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ] as const),
    magnification: p.number(2, "magnification"),
    separatorHeight: p.oneOf(3, "separatorHeight", [1, 2] as const),
    height: p.number(4, "height"),
    segments: p.number(5, "segments"),
  })),
  "^BF": withParams("^BF", (p) => ({
    type: "MicroPdf417",
    orientation: p.oneOf(0, "orientation", orientations),
    rowHeight: p.number(1, "rowHeight"),
    mode: p.number(2, "mode"),
  })),
  "^BI": withParams("^BI", (p) => ({
    type: "Industrial2of5",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^BJ": withParams("^BJ", (p) => ({
    type: "Standard2of5",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLine: p.yesNo(2, "interpretationLine"),
    interpretationLineAbove: p.yesNo(3, "interpretationLineAbove"),
  })),
  "^BL": withParams("^BL", (p) => ({
    type: "Logmars",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    interpretationLineAbove: p.yesNo(2, "interpretationLineAbove"),
  })),
  "^BM": withParams("^BM", (p) => ({
    type: "Msi",
    orientation: p.oneOf(0, "orientation", orientations),
    checkDigits: p.oneOf(1, "checkDigits", ["A", "B", "C", "D"] as const),
    height: p.number(2, "height"),
    interpretationLine: p.yesNo(3, "interpretationLine"),
    interpretationLineAbove: p.yesNo(4, "interpretationLineAbove"),
    printCheckDigit: p.yesNo(5, "printCheckDigit"),
  })),
  "^BP": withParams("^BP", (p) => ({
    type: "Plessey",
    orientation: p.oneOf(0, "orientation", orientations),
    printCheckDigit: p.yesNo(1, "printCheckDigit"),
    height: p.number(2, "height"),
    interpretationLine: p.yesNo(3, "interpretationLine"),
    interpretationLineAbove: p.yesNo(4, "interpretationLineAbove"),
  })),
  "^PQ": withParams("^PQ", (p) => ({
    type: "PrintQuantity",
    quantity: p.number(0, "quantity"),
    pauseEvery: p.number(1, "pauseEvery"),
    replicates: p.number(2, "replicates"),
    overridePause: p.yesNo(3, "overridePause"),
    cutOnError: p.yesNo(4, "cutOnError"),
  })),
  "^PR": withParams("^PR", (p) => ({
    type: "PrintRate",
    speed: p.speed(0, "speed"),
    slew: p.speed(1, "slew"),
    backfeed: p.speed(2, "backfeed"),
  })),
  "^MD": withParams("^MD", (p) => ({
    type: "MediaDarkness",
    darkness: p.number(0, "darkness"),
  })),
  "^BX": withParams("^BX", (p) =>
    // The aspect ratio parameter has no typed node
    p.string(7) !== undefined
      ? null
      : {
          type: "DataMatrix",
          orientation: p.oneOf(0, "orientation", orientations),
          height: p.number(1, "height"),
          quality: p.oneOf(2, "quality", [0, 50, 80, 100, 140, 200] as const),
          columns: p.number(3, "columns"),
          rows: p.number(4, "rows"),
          formatId: p.oneOf(5, "formatId", [1, 2, 3, 4, 5, 6] as const),
          escapeCharacter: p.string(6),
        }
  ),
  "^BQ": withParams("^BQ", (p) => ({
    type: "QrCode",
    orientation: p.oneOf(0, "orientation", ["N"] as const),
    model: p.oneOf(1, "model", [1, 2] as const),
    magnification: p.number(2, "magnification"),
    errorCorrection: p.oneOf(3, "errorCorrection", [
      "H",
      "Q",
      "M",
      "L",
    ] as const),
    mask: p.oneOf(4, "mask", [0, 1, 2, 3, 4, 5, 6, 7] as const),
  })),
  "~SD": withParams("~SD", (p) => ({
    type: "SetDarkness",
    darkness: p.requiredNumber(0, "darkness"),
  })),
  "~DG": (body, delimiter) => {
    const p = new Params("~DG", splitN(body, delimiter, 4));
    const object = storedObject("~DG", p.requiredString(0, "object"));

    return {
      type: "DownloadGraphic",
      device: object.device,
      name: object.name,
      totalBytes: p.requiredNumber(1, "totalBytes"),
      bytesPerRow: p.requiredNumber(2, "bytesPerRow"),
      data: p.string(3) ?? "",
    };
  },
  "^A@": withParams("^A@", (p) => ({
    type: "FontByName",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    width: p.number(2, "width"),
    ...objectPath("^A@", p.requiredString(3, "font")),
  })),
  "^CW": withParams("^CW", (p) => ({
    type: "FontIdentifier",
    font: p.requiredString(0, "font"),
    ...storedObject("^CW", p.requiredString(1, "object")),
  })),
  "~DU": (body, delimiter) => downloadFont("~DU", body, delimiter),
  "~DT": (body, delimiter) => downloadFont("~DT", body, delimiter),
  "~DY": (body, delimiter) => {
    const p = new Params("~DY", splitN(body, delimiter, 6));
    const target = p.requiredString(0, "object");
    const match = /^([REBA]):([^.:]+)$/.exec(target);
    if (!match) {
      throw new ParamError(
        `~DY: expected an object like R:NAME, got '${target}'`
      );
    }

    return {
      type: "DownloadObject",
      device: match[1] as (typeof devices)[number],
      name: match[2],
      format: p.oneOf(1, "format", ["A", "B", "C", "P"] as const) ?? "A",
      extension: p.requiredString(2, "extension"),
      totalBytes: p.requiredNumber(3, "totalBytes"),
      bytesPerRow: p.number(4, "bytesPerRow"),
      data: p.string(5) ?? "",
    };
  },
  "^PO": withParams("^PO", (p) => ({
    type: "PrintOrientation",
    orientation: p.oneOf(0, "orientation", ["N", "I"] as const) ?? "N",
  })),
  "^GS": withParams("^GS", (p) => ({
    type: "GraphicSymbol",
    orientation: p.oneOf(0, "orientation", orientations),
    height: p.number(1, "height"),
    width: p.number(2, "width"),
  })),
  "^DF": withParams("^DF", (p) => ({
    type: "DownloadFormat",
    ...storedObject("^DF", p.requiredString(0, "object")),
  })),
  "^XF": withParams("^XF", (p) => ({
    type: "RecallFormat",
    ...storedObject("^XF", p.requiredString(0, "object")),
  })),
  "^IL": withParams("^IL", (p) => ({
    type: "ImageLoad",
    ...storedObject("^IL", p.requiredString(0, "object")),
  })),
  "^BO": withParams("^BO", (p) => ({
    type: "Aztec",
    orientation: p.oneOf(0, "orientation", orientations),
    magnification: p.number(1, "magnification"),
    extendedChannel: p.yesNo(2, "extendedChannel"),
    errorControl: p.number(3, "errorControl"),
    menu: p.yesNo(4, "menu"),
    symbolCount: p.number(5, "symbolCount"),
    structuredAppendId: p.string(6),
  })),
  // ^B0 is the same as ^BO, and is written back as ^BO
  "^B0": withParams("^B0", (p) => ({
    type: "Aztec",
    orientation: p.oneOf(0, "orientation", orientations),
    magnification: p.number(1, "magnification"),
    extendedChannel: p.yesNo(2, "extendedChannel"),
    errorControl: p.number(3, "errorControl"),
    menu: p.yesNo(4, "menu"),
    symbolCount: p.number(5, "symbolCount"),
    structuredAppendId: p.string(6),
  })),
  "^BD": withParams("^BD", (p) => ({
    type: "MaxiCode",
    mode: p.oneOf(0, "mode", [2, 3, 4, 5, 6] as const),
    symbolNumber: p.number(1, "symbolNumber"),
    symbolCount: p.number(2, "symbolCount"),
  })),
  "^ID": withParams("^ID", (p) => ({
    type: "DeleteObject",
    ...storedObject("^ID", p.requiredString(0, "object")),
  })),
};

const isLineBreak = (char: string): boolean => char === "\r" || char === "\n";

/**
 * Parse ZPL into command nodes.
 *
 * Supported commands become typed nodes; everything else, including commands
 * with invalid parameters, is kept as a Raw node so no input is lost. Invalid
 * parameters are also reported as diagnostics. Prefix and delimiter changes
 * (^CC, ^CT, ^CD) are applied while parsing and left out of the result, so
 * the commands always serialize with the default ^, ~ and ,.
 */
const parse = (zpl: string): ParseResult => {
  const commands: Command[] = [];
  const diagnostics: Diagnostic[] = [];
  let caret = "^";
  let tilde = "~";
  let delimiter = ",";

  const isPrefix = (char: string) => char === caret || char === tilde;

  // Skip line breaks, which ZPL ignores
  const next = (index: number): number => {
    while (index < zpl.length && isLineBreak(zpl.charAt(index))) index++;
    return index;
  };

  let i = 0;
  while (i < zpl.length && !isPrefix(zpl.charAt(i))) i++;

  while (i < zpl.length) {
    const start = i;
    const kind = zpl.charAt(i) === caret ? "^" : "~";

    // Read the two-character command code
    let cursor = next(i + 1);
    let code = zpl.charAt(cursor);
    cursor = next(cursor + 1);

    // ^A takes a single-character font name as its first parameter, except
    // for ^A@ which takes a font file name
    if (!(kind === "^" && code === "A" && zpl.charAt(cursor) !== "@")) {
      code += zpl.charAt(cursor);
      cursor = next(cursor + 1);
    }

    const key = kind + code;

    if (["CC", "CT", "CD"].includes(code)) {
      const char = zpl.charAt(cursor);
      if (code === "CC") caret = char;
      if (code === "CT") tilde = char;
      if (code === "CD") delimiter = char;

      i = cursor + 1;
      while (i < zpl.length && !isPrefix(zpl.charAt(i))) i++;
      continue;
    }

    // The body runs until the next command, minus line breaks
    let end = cursor;
    let body = "";
    while (end < zpl.length && !isPrefix(zpl.charAt(end))) {
      if (!isLineBreak(zpl.charAt(end))) body += zpl.charAt(end);
      end++;
    }

    const span = { start, end };
    while (span.end > start && isLineBreak(zpl.charAt(span.end - 1))) {
      span.end--;
    }

    const raw: Command = { type: "Raw", zpl: key + body, span };
    const parser = parsers[key];

    if (!parser) {
      commands.push(raw);
    } else {
      try {
        const command = parser(body, delimiter);
        commands.push(command ? { ...compact(command), span } : raw);
      } catch (error) {
        if (!(error instanceof ParamError)) throw error;
        diagnostics.push({
          severity: "warning",
          rule: "invalid-parameter",
          message: error.message,
          span,
        });
        commands.push(raw);
      }
    }

    // Spaces and line breaks between commands are fine, anything else isn't
    const text = body.trim();
    if (withoutParams.has(key) && text) {
      let from = cursor;
      while (/\s/.test(zpl.charAt(from))) from++;
      let to = end;
      while (/\s/.test(zpl.charAt(to - 1))) to--;
      diagnostics.push({
        severity: "warning",
        rule: "ignored-text",
        message: `${key} takes no parameters, so the printer ignores '${text}'`,
        span: { start: from, end: to },
      });
    }

    i = end;
  }

  return { commands, diagnostics };
};

/**
 * Commands parse() reads into typed nodes, and the prefix and delimiter
 * changes it applies while parsing. Used to generate the docs' command
 * table; not part of the public API.
 */
const parsedCommands: readonly string[] = [
  ...Object.keys(parsers),
  "^CC",
  "~CC",
  "^CD",
  "~CD",
  "^CT",
  "~CT",
];

export type { Diagnostic, ParseResult };
export { parse, parsedCommands };
