import ZplError from "./ZplError.js";
import type { Command } from "./ast.js";

type Param = string | number | boolean | undefined;

const yn = (value: boolean | undefined): string | undefined =>
  value === undefined ? undefined : value ? "Y" : "N";

/**
 * Join parameters with commas. Trailing undefined parameters are dropped and
 * inner ones are left empty, so the printer falls back to their defaults.
 */
const params = (...values: Param[]): string => {
  const strings = values.map((value) =>
    value === undefined ? "" : String(value)
  );

  while (strings.length > 0 && strings[strings.length - 1] === "") {
    strings.pop();
  }

  return strings.join(",");
};

const assertNoPrefix = (text: string, what: string): string => {
  if (/[\^~]/.test(text)) {
    throw new ZplError(
      `${what} cannot contain ^ or ~, escape them with ^FH: ${text}`
    );
  }

  return text;
};

/**
 * Serialize a single command node to ZPL
 */
const serializeCommand = (command: Command): string => {
  switch (command.type) {
    case "StartFormat":
      return "^XA";
    case "EndFormat":
      return "^XZ";
    case "PrintWidth":
      return `^PW${command.width}`;
    case "LabelLength":
      return `^LL${command.length}`;
    case "LabelHome":
      return `^LH${params(command.x, command.y)}`;
    case "LabelReverse":
      return `^LR${yn(command.reverse)}`;
    case "ChangeEncoding":
      return `^CI${command.charset}`;
    case "DefaultFont":
      return `^CF${params(command.font, command.height, command.width)}`;
    case "FieldOrientation":
      return `^FW${params(command.orientation, command.justification)}`;
    case "FieldOrigin":
      return `^FO${params(command.x, command.y, command.justification)}`;
    case "FieldTypeset":
      return `^FT${params(command.x, command.y, command.justification)}`;
    case "Font":
      // Font name and orientation are not separated by a comma
      return `^A${params(
        `${command.font}${command.orientation ?? ""}`,
        command.height,
        command.width
      )}`;
    case "FontByName":
      return `^A@${params(
        command.orientation,
        command.height,
        command.width,
        `${command.device ? `${command.device}:` : ""}${command.name}.${
          command.extension
        }`
      )}`;
    case "FontIdentifier":
      return `^CW${params(
        command.font,
        `${command.device}:${command.name}.${command.extension}`
      )}`;
    case "FieldBlock":
      return `^FB${params(
        command.width,
        command.maxLines,
        command.lineSpacing,
        command.justification,
        command.hangingIndent
      )}`;
    case "FieldReverse":
      return "^FR";
    case "FieldHexIndicator":
      return `^FH${command.indicator ?? ""}`;
    case "FieldData":
      return `${command.variable ? "^FV" : "^FD"}${assertNoPrefix(
        command.data,
        "Field data"
      )}`;
    case "FieldSeparator":
      return "^FS";
    case "Comment":
      return `^FX${assertNoPrefix(command.text, "Comment")}`;
    case "GraphicBox":
      return `^GB${params(
        command.width,
        command.height,
        command.thickness,
        command.color,
        command.rounding
      )}`;
    case "GraphicCircle":
      return `^GC${params(command.diameter, command.thickness, command.color)}`;
    case "GraphicEllipse":
      return `^GE${params(
        command.width,
        command.height,
        command.thickness,
        command.color
      )}`;
    case "GraphicDiagonal":
      return `^GD${params(
        command.width,
        command.height,
        command.thickness,
        command.color,
        command.direction
      )}`;
    case "GraphicField":
      return `^GFA,${params(
        command.byteCount,
        command.fieldCount,
        command.bytesPerRow,
        command.data
      )}`;
    case "RecallGraphic":
      return `^XG${params(
        `${command.device}:${command.name}.GRF`,
        command.magnificationX,
        command.magnificationY
      )}`;
    case "BarcodeDefaults":
      return `^BY${params(command.moduleWidth, command.ratio, command.height)}`;
    case "Code11":
      return `^B1${params(
        command.orientation,
        command.checkDigits === undefined
          ? undefined
          : yn(command.checkDigits === 1),
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Code128":
      return `^BC${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.uccCheckDigit),
        command.mode
      )}`;
    case "Code39":
      return `^B3${params(
        command.orientation,
        yn(command.checkDigit),
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Interleaved2of5":
      return `^B2${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.checkDigit)
      )}`;
    case "Pdf417":
      return `^B7${params(
        command.orientation,
        command.rowHeight,
        command.securityLevel,
        command.columns,
        command.rows,
        yn(command.truncate)
      )}`;
    case "Ean13":
      return `^BE${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Ean8":
      return `^B8${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "UpcA":
      return `^BU${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.printCheckDigit)
      )}`;
    case "UpcE":
      return `^B9${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.printCheckDigit)
      )}`;
    case "UpcEanExtension":
      return `^BS${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Code93":
      return `^BA${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.printCheckDigit)
      )}`;
    case "Codabar":
      return `^BK${params(
        command.orientation,
        undefined,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        command.start,
        command.stop
      )}`;
    case "PostalCode":
      return `^BZ${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        command.postalType
      )}`;
    case "Planet":
      return `^B5${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Gs1DataBar":
      return `^BR${params(
        command.orientation,
        command.symbology,
        command.magnification,
        command.separatorHeight,
        command.height,
        command.segments
      )}`;
    case "MicroPdf417":
      return `^BF${params(
        command.orientation,
        command.rowHeight,
        command.mode
      )}`;
    case "Industrial2of5":
      return `^BI${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Standard2of5":
      return `^BJ${params(
        command.orientation,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "Logmars":
      return `^BL${params(
        command.orientation,
        command.height,
        yn(command.interpretationLineAbove)
      )}`;
    case "Msi":
      return `^BM${params(
        command.orientation,
        command.checkDigits,
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove),
        yn(command.printCheckDigit)
      )}`;
    case "Plessey":
      return `^BP${params(
        command.orientation,
        yn(command.printCheckDigit),
        command.height,
        yn(command.interpretationLine),
        yn(command.interpretationLineAbove)
      )}`;
    case "PrintQuantity":
      return `^PQ${params(
        command.quantity,
        command.pauseEvery,
        command.replicates,
        yn(command.overridePause),
        yn(command.cutOnError)
      )}`;
    case "PrintRate":
      return `^PR${params(command.speed, command.slew, command.backfeed)}`;
    case "MediaDarkness":
      return `^MD${params(command.darkness)}`;
    case "DataMatrix":
      return `^BX${params(
        command.orientation,
        command.height,
        command.quality,
        command.columns,
        command.rows,
        command.formatId,
        command.escapeCharacter
      )}`;
    case "QrCode":
      return `^BQ${params(
        command.orientation,
        command.model,
        command.magnification,
        command.errorCorrection,
        command.mask
      )}`;
    case "SetDarkness":
      return `~SD${String(command.darkness).padStart(2, "0")}`;
    case "DownloadGraphic":
      return `~DG${params(
        `${command.device}:${command.name}.GRF`,
        command.totalBytes,
        command.bytesPerRow,
        command.data
      )}`;
    case "DownloadFont":
      return `${command.bounded ? "~DT" : "~DU"}${params(
        `${command.device}:${command.name}.${command.extension}`,
        command.size,
        command.data
      )}`;
    case "DownloadObject":
      return `~DY${params(
        `${command.device}:${command.name}`,
        command.format,
        command.extension,
        command.totalBytes,
        command.bytesPerRow,
        command.data
      )}`;
    case "PrintOrientation":
      return `^PO${command.orientation}`;
    case "GraphicSymbol":
      return `^GS${params(command.orientation, command.height, command.width)}`;
    case "DownloadFormat":
      return `^DF${command.device}:${command.name}.${command.extension}`;
    case "RecallFormat":
      return `^XF${command.device}:${command.name}.${command.extension}`;
    case "FieldNumber":
      return `^FN${command.number}${
        command.prompt === undefined ? "" : `"${command.prompt}"`
      }`;
    case "ImageLoad":
      return `^IL${command.device}:${command.name}.${command.extension}`;
    case "Aztec":
      return `^BO${params(
        command.orientation,
        command.magnification,
        yn(command.extendedChannel),
        command.errorControl,
        yn(command.menu),
        command.symbolCount,
        command.structuredAppendId
      )}`;
    case "MaxiCode":
      return `^BD${params(
        command.mode,
        command.symbolNumber,
        command.symbolCount
      )}`;
    case "DeleteObject":
      return `^ID${command.device}:${command.name}.${command.extension}`;
    case "Raw":
      return command.zpl;
  }
};

/**
 * Serialize a list of command nodes to ZPL
 * @param commands Commands to serialize
 * @param options.minify Leave out the line breaks between commands, true by default
 */
const serialize = (
  commands: Command[],
  options?: { minify?: boolean }
): string => {
  const minify = options?.minify ?? true;

  return commands
    .map((command) => serializeCommand(command) + (minify ? "" : "\n"))
    .join("");
};

const hex = (char: string): string =>
  `_${char.charCodeAt(0).toString(16).toUpperCase()}`;

/**
 * Escape field data so it can be written in a ^FD command. Characters that
 * would otherwise be read as commands (^ and ~) are hex-encoded, which
 * requires a ^FH command before the ^FD. Once ^FH is used, the indicator (_)
 * has to be encoded as well.
 */
const escapeFieldData = (
  data: string
): { data: string; needsHexIndicator: boolean } => {
  if (!/[\^~]/.test(data)) {
    return { data, needsHexIndicator: false };
  }

  return { data: data.replace(/[\^~_]/g, hex), needsHexIndicator: true };
};

export { serialize, serializeCommand, escapeFieldData };
