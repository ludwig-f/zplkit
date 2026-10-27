import { measuredFields } from "./measured.js";
import { unknownCommands } from "./commands.js";
import type { Command, Span } from "./ast.js";

type LintRule =
  | "missing-start-format"
  | "missing-end-format"
  | "command-outside-format"
  | "unclosed-field"
  | "separator-without-field"
  | "field-outside-label"
  | "box-smaller-than-line"
  | "value-out-of-range"
  | "ean13-data"
  | "databar-parentheses"
  | "barcode-without-data"
  | "unknown-command"
  | "printer-command-in-label";

/** A problem lint() found */
type LintDiagnostic = {
  /** Which check found it; the linting docs explain each one */
  rule: LintRule;
  /** Errors stop the label from printing as intended, warnings change how it prints */
  severity: "error" | "warning";
  /** What's wrong, in a sentence */
  message: string;
  /** Position of the command in the list */
  index: number;
  /** Position in the source text, for parsed ZPL */
  span?: Span;
};

/** The printer's media size, for labels that don't set ^PW or ^LL */
type LintMedia = {
  /** Media width in dots */
  width?: number;
  /** Media length in dots */
  length?: number;
};

/**
 * Ranges the printer accepts, from the ZPL II Programming Guide. Values
 * outside them are silently clamped or replaced.
 */
const ranges: {
  [T in Command["type"]]?: [
    keyof Extract<Command, { type: T }>,
    string,
    number,
    number
  ][];
} = {
  FieldOrigin: [
    ["x", "x", 0, 32000],
    ["y", "y", 0, 32000],
  ],
  LabelLength: [["length", "length", 1, 32000]],
  LabelShift: [["shift", "shift", -9999, 9999]],
  LabelTop: [["offset", "offset", -120, 120]],
  GraphicBox: [
    ["width", "width", 1, 32000],
    ["height", "height", 1, 32000],
    ["thickness", "thickness", 1, 32000],
  ],
  GraphicCircle: [
    ["diameter", "diameter", 3, 4095],
    ["thickness", "thickness", 2, 4095],
  ],
  GraphicEllipse: [
    ["width", "width", 3, 4095],
    ["height", "height", 3, 4095],
    ["thickness", "thickness", 2, 4095],
  ],
  GraphicDiagonal: [
    ["width", "width", 3, 32000],
    ["height", "height", 3, 32000],
    ["thickness", "thickness", 1, 32000],
  ],
  BarcodeDefaults: [
    ["moduleWidth", "module width", 1, 10],
    ["ratio", "ratio", 2, 3],
  ],
  SetDarkness: [["darkness", "darkness", 0, 30]],
  MediaDarkness: [["darkness", "darkness", -30, 30]],
  PrintRate: [
    ["speed", "speed", 1, 14],
    ["slew", "slew speed", 1, 14],
    ["backfeed", "backfeed speed", 1, 14],
  ],
  PrintQuantity: [["quantity", "quantity", 1, 99999999]],
  QrCode: [["magnification", "magnification", 1, 100]],
};

const codes: { [T in Command["type"]]?: string } = {
  FieldOrigin: "^FO",
  LabelLength: "^LL",
  LabelShift: "^LS",
  LabelTop: "^LT",
  GraphicBox: "^GB",
  GraphicCircle: "^GC",
  GraphicEllipse: "^GE",
  GraphicDiagonal: "^GD",
  BarcodeDefaults: "^BY",
  SetDarkness: "~SD",
  MediaDarkness: "^MD",
  PrintRate: "^PR",
  PrintQuantity: "^PQ",
  QrCode: "^BQ",
};

const barcodes = new Set<Command["type"]>([
  "Code11",
  "Code128",
  "Code39",
  "Interleaved2of5",
  "Pdf417",
  "Ean13",
  "Ean8",
  "UpcA",
  "UpcE",
  "UpcEanExtension",
  "Code93",
  "Codabar",
  "PostalCode",
  "Planet",
  "Gs1DataBar",
  "MicroPdf417",
  "Industrial2of5",
  "Standard2of5",
  "Logmars",
  "Msi",
  "Plessey",
  "DataMatrix",
  "QrCode",
  "Aztec",
  "MaxiCode",
]);

/** Commands that act immediately, outside of ^XA … ^XZ */
const isControlCommand = (command: Command): boolean =>
  command.type === "SetDarkness" ||
  command.type === "DownloadGraphic" ||
  command.type === "DownloadFont" ||
  command.type === "DownloadObject" ||
  (command.type === "Raw" && command.zpl.startsWith("~"));

/** Commands that store graphics, fonts and objects on the printer */
const isDownload = (command: Command): boolean =>
  command.type === "DownloadGraphic" ||
  command.type === "DownloadFont" ||
  command.type === "DownloadObject" ||
  (command.type === "Raw" && /^~D/.test(command.zpl));

const dots = (count: number): string => `${count} dot${count === 1 ? "" : "s"}`;

/**
 * Find problems a printer would not report: commands it ignores, values it
 * silently changes and labels that never print.
 *
 * @param commands Commands of one or more labels, e.g. from parse() or Label.commands
 * @param media Size of the printer's media in dots, used for labels without ^PW or ^LL
 */
const lint = (
  commands: readonly Command[],
  media: LintMedia = {}
): LintDiagnostic[] => {
  const diagnostics: LintDiagnostic[] = [];

  let formatStart: number | undefined;
  let hasStarted = false;
  let reportedOutside = false;
  let size = { ...media };
  let home = { x: 0, y: 0 };
  // ^MU: ranges are in dots, so they don't apply to millimeters or inches
  let unit: "D" | "I" | "M" = "D";
  let field: { index: number; barcode?: number; hasData: boolean } | undefined;

  const report = (
    index: number,
    rule: LintRule,
    severity: LintDiagnostic["severity"],
    message: string
  ) => {
    const span = commands[index]?.span;
    diagnostics.push({
      rule,
      severity,
      message,
      index,
      ...(span ? { span } : {}),
    });
  };

  const closeField = () => {
    if (field?.barcode !== undefined && !field.hasData) {
      report(
        field.barcode,
        "barcode-without-data",
        "warning",
        "This barcode has no ^FD data, so nothing prints."
      );
    }
    field = undefined;
  };

  commands.forEach((command, index) => {
    // Label structure
    if (command.type === "StartFormat") {
      formatStart = index;
      hasStarted = true;
      reportedOutside = false;
      size = { ...media };
      home = { x: 0, y: 0 };
      return;
    }

    if (formatStart === undefined && !isControlCommand(command)) {
      if (!hasStarted) {
        report(
          index,
          "missing-start-format",
          "error",
          "The label doesn't start with ^XA, so the printer ignores these commands."
        );
        // Treat the rest as a label to avoid repeating the same problem
        formatStart = index;
        hasStarted = true;
      } else if (!reportedOutside) {
        report(
          index,
          "command-outside-format",
          "warning",
          "This command comes after ^XZ and before the next ^XA, so the printer ignores it."
        );
        reportedOutside = true;
        return;
      } else {
        return;
      }
    }

    // Tilde commands act as soon as they're read, so in a label they don't
    // do what they seem to. Downloads are fine wherever they are.
    if (
      formatStart !== undefined &&
      isControlCommand(command) &&
      !isDownload(command)
    ) {
      const code =
        command.type === "Raw" ? command.zpl.slice(0, 3) : codes[command.type];
      report(
        index,
        "printer-command-in-label",
        "warning",
        `${code} acts on the printer as soon as it's read, not when this label prints. Send it before ^XA, for example with PrinterSetup.`
      );
    }

    if (command.type === "EndFormat") {
      if (field) {
        report(
          field.index,
          "unclosed-field",
          "error",
          "This field is never closed with ^FS, so it doesn't print."
        );
        field = undefined;
      }
      formatStart = undefined;
      return;
    }

    // Value ranges
    const range = ranges[command.type] as
      | [string, string, number, number][]
      | undefined;

    for (const [key, name, min, max] of range ?? []) {
      const value = (command as Record<string, unknown>)[key];
      if (unit !== "D" && measuredFields[command.type]?.includes(key)) {
        continue;
      }

      if (typeof value === "number" && (value < min || value > max)) {
        report(
          index,
          "value-out-of-range",
          "warning",
          `${
            codes[command.type]
          } ${name} is ${value}, but the printer only accepts ${min} to ${max}.`
        );
      }
    }

    switch (command.type) {
      case "PrintWidth":
        size.width = command.width;
        break;
      case "LabelLength":
        size.length = command.length;
        break;
      case "LabelHome":
        home = { x: command.x, y: command.y };
        break;
      case "MeasurementUnits":
        unit = command.unit ?? unit;
        break;
      case "FieldOrigin":
      case "FieldTypeset": {
        if (field) {
          report(
            field.index,
            "unclosed-field",
            "error",
            "This field is never closed with ^FS, so it merges with the next field."
          );
        }
        field = { index, hasData: false };

        const x = home.x + (command.x ?? 0);
        const y = home.y + (command.y ?? 0);
        const { width, length } = size;

        if (
          (width !== undefined && x >= width) ||
          (length !== undefined && y >= length)
        ) {
          report(
            index,
            "field-outside-label",
            "warning",
            `This field starts at (${x}, ${y}), outside the ${width ?? "?"} × ${
              length ?? "?"
            } dot label, so it may not print.`
          );
        }
        break;
      }
      case "SerialNumber":
        // ^SN is the field's data
        if (field) field.hasData = true;
        break;
      case "FieldSeparator":
        if (!field) {
          report(
            index,
            "separator-without-field",
            "warning",
            "This ^FS has no ^FO or ^FT before it."
          );
        }
        closeField();
        break;
      case "FieldData": {
        if (field) field.hasData = true;

        const barcode =
          field?.barcode !== undefined ? commands[field.barcode] : undefined;

        if (barcode?.type === "Ean13" && !/^\d{12}$/.test(command.data)) {
          report(
            index,
            "ean13-data",
            "warning",
            `EAN-13 data must be exactly 12 digits (the printer adds the check digit), got '${command.data}'. The printer pads or cuts it to 12.`
          );
        }

        if (
          barcode?.type === "Gs1DataBar" &&
          barcode.symbology === 6 &&
          command.data.includes("(")
        ) {
          report(
            index,
            "databar-parentheses",
            "warning",
            `The printer encodes these parentheses as data, so scanners can't read the AIs. Leave them out: ${command.data.replace(
              /[()]/g,
              ""
            )}.`
          );
        }
        break;
      }
      case "GraphicBox": {
        const thickness = command.thickness ?? 1;
        const sides: [number | undefined, string, string][] = [
          [command.width, "wide", "widens it"],
          [command.height, "high", "raises it"],
        ];

        for (const [side, word, fix] of sides) {
          if (side !== undefined && side < thickness) {
            report(
              index,
              "box-smaller-than-line",
              "warning",
              `The box is ${dots(side)} ${word} but its line is ${dots(
                thickness
              )} thick, so the printer ${fix} to ${dots(thickness)}.`
            );
          }
        }
        break;
      }
      case "Raw":
        for (const code of unknownCommands(command.zpl)) {
          report(
            index,
            "unknown-command",
            "warning",
            `${code} is not a ZPL command.`
          );
        }
        break;
      default:
        if (barcodes.has(command.type) && field) {
          field.barcode = index;
        }
    }
  });

  if (formatStart !== undefined) {
    report(
      formatStart,
      "missing-end-format",
      "error",
      "The label is never ended with ^XZ, so the printer keeps waiting and nothing prints."
    );
  }

  return diagnostics;
};

export type { LintDiagnostic, LintMedia, LintRule };
export { lint };
