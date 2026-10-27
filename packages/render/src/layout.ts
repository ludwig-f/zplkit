/**
 * Turns parsed ZPL commands into elements to draw, by replaying them the way
 * a printer does: label home, field positions, reverse printing and stored
 * graphics carry over between commands. Each element records the commands
 * that produced it, so a drawn element can be traced back to its source.
 */
import { decodeObjectData } from "./data.js";
import { FontFiles, parseFontFile } from "./font-files.js";
import { expandFormats } from "./formats.js";
import { decodeGraphicData } from "./graphics.js";
import type { Command } from "@zplkit/core";
import type { Font } from "./font.js";
import type { FontPath } from "./font-files.js";
import type { Orientation, TextBlockOptions } from "./text.js";

type Common = {
  x: number;
  y: number;
  /** Inverts what's underneath instead of drawing over it */
  reverse: boolean;
  /** Indices of the commands that produced the element */
  commands: number[];
};

type Element = Common &
  (
    | {
        kind: "box";
        width: number;
        height: number;
        thickness: number;
        color: "B" | "W";
        rounding: number;
      }
    | { kind: "circle"; diameter: number; thickness: number; color: "B" | "W" }
    | {
        kind: "ellipse";
        width: number;
        height: number;
        thickness: number;
        color: "B" | "W";
      }
    | {
        kind: "diagonal";
        width: number;
        height: number;
        thickness: number;
        color: "B" | "W";
        direction: "R" | "L";
      }
    | {
        kind: "text";
        text: string;
        /** Font name: 0, A to Z or 1 to 9 */
        font: string;
        /** Character height and width in dots, as given (see FontSetting) */
        height?: number;
        width?: number;
        /** A font file, from ^A@ or a font letter named with ^CW */
        typeface?: Font;
        /** The font file passed in to draw font 0 with, if any */
        font0?: Font;
        orientation: Orientation;
        /** ^FT positions the baseline instead of the top */
        fromBottom: boolean;
        /** ^FB wraps the text in a block */
        block?: TextBlockOptions;
      }
    | {
        kind: "barcode";
        /** The barcode command, with its own parameters */
        symbology: BarcodeCommand;
        data: string;
        /** From ^BY: narrowest bar in dots, wide to narrow ratio, height */
        moduleWidth: number;
        ratio: number;
        height: number;
        orientation: Orientation;
        fromBottom: boolean;
        /** Set when ^A came before the barcode: the interpretation line's font */
        font?: FontSetting;
      }
    | {
        /** Stands in for a barcode we can't draw yet */
        kind: "placeholder";
        /** The barcode command, like ^B7 */
        code: string;
        /**
         * Not drawn yet, a drawn barcode whose parameters didn't parse, or
         * data the barcode can't encode
         */
        reason: "unsupported" | "invalid" | "data";
        /** ^BY's height; it's drawn taller if its text needs room */
        height: number;
        orientation: Orientation;
        fromBottom: boolean;
      }
    | {
        /** ^GS: A ® B © C ™ D UL E CSA */
        kind: "symbol";
        symbol: string;
        /** Whole-step magnification of the 24-dot symbol font */
        magX: number;
        magY: number;
        orientation: Orientation;
        fromBottom: boolean;
      }
    | {
        kind: "bitmap";
        /** Packed rows of bits, most significant bit first */
        bytes: Uint8Array;
        bytesPerRow: number;
        rows: number;
        magnificationX: number;
        magnificationY: number;
      }
  );

type LabelLayout = {
  printWidth?: number;
  /** ^POI: the label prints upside down */
  inverted?: boolean;
  /** ^PMY: the label prints as its mirror image */
  mirrored?: boolean;
  elements: Element[];
  /** Commands that were understood but aren't drawn yet */
  unsupported: number[];
};

type BarcodeCommand = Extract<
  Command,
  {
    type:
      | "Code11"
      | "Code128"
      | "Code39"
      | "Interleaved2of5"
      | "Pdf417"
      | "Ean13"
      | "Ean8"
      | "UpcA"
      | "UpcE"
      | "UpcEanExtension"
      | "Code93"
      | "Codabar"
      | "PostalCode"
      | "Planet"
      | "Gs1DataBar"
      | "MicroPdf417"
      | "Industrial2of5"
      | "Standard2of5"
      | "Logmars"
      | "Msi"
      | "Plessey"
      | "DataMatrix"
      | "QrCode"
      | "Aztec"
      | "MaxiCode";
  }
>;

type StoredGraphic = { bytes: Uint8Array; bytesPerRow: number; rows: number };

type FontSetting = {
  font: string;
  /**
   * Height and width as given, in dots. Either may be missing: how a missing
   * one is filled in depends on the font, so it's resolved when drawing.
   */
  height?: number;
  width?: number;
  /** A font file to use instead of the font letter */
  typeface?: Font;
  /** Missing when ^A doesn't give one: the field then uses ^FW's */
  orientation?: Orientation;
};

type Field = {
  x: number;
  y: number;
  /** ^FT positions the bottom-left corner instead of the top-left */
  fromBottom: boolean;
  reverse: boolean;
  /** Font set with ^A for this field only */
  font?: FontSetting;
  /** ^FH: the character that starts a hex escape in the field data */
  hexIndicator?: string;
  block?: TextBlockOptions;
  /** ^GS: the field data picks a graphic symbol */
  symbol?: { height?: number; width?: number; orientation?: Orientation };
  /** The barcode the field data goes into, or the code of one we can't draw */
  barcode?: BarcodeCommand | NonNullable<ReturnType<typeof rawBarcode>>;
  /** Where the barcode command is in the list */
  barcodeIndex?: number;
  commands: number[];
};

const newField = (): Field => ({
  x: 0,
  y: 0,
  fromBottom: false,
  reverse: false,
  commands: [],
});

/** Font settings at power-up: font A, 9 dots high, 5 wide */
const initialFont: FontSetting = { font: "A", height: 9, width: 5 };

/**
 * Field data as text: hex escapes become bytes, and with ^CI28 to 30 the
 * bytes are UTF-8. Other character sets are read as Latin-1.
 */
const decodeFieldData = (
  data: string,
  hexIndicator: string | undefined,
  utf8: boolean
): string => {
  if (hexIndicator === undefined) return data;

  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let i = 0; i < data.length; i++) {
    const hex = data.slice(i + 1, i + 3);
    if (data[i] === hexIndicator && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else if (utf8) {
      bytes.push(...encoder.encode(data[i]));
    } else {
      bytes.push(data.charCodeAt(i) & 0xff);
    }
  }
  return utf8
    ? new TextDecoder().decode(new Uint8Array(bytes))
    : String.fromCharCode(...bytes);
};

/** Barcode commands with a typed node, all of which we draw */
const drawnCodes = new Set([
  "^BO",
  "^BD",
  "^B1",
  "^B2",
  "^B3",
  "^B7",
  "^BC",
  "^BE",
  "^B8",
  "^BU",
  "^B9",
  "^BS",
  "^BA",
  "^BK",
  "^B0",
  "^BZ",
  "^B5",
  "^BR",
  "^BF",
  "^BI",
  "^BJ",
  "^BL",
  "^BM",
  "^BP",
  "^BQ",
  "^BX",
]);

/**
 * ^Bx commands left as Raw, apart from ^BY, are barcodes we can't draw:
 * either unsupported, or a supported one whose parameters didn't parse
 */
const rawBarcode = (command: Command) => {
  if (command.type !== "Raw" || !/^\^B[0-9A-XZ]/.test(command.zpl)) {
    return undefined;
  }
  const code = command.zpl.slice(0, 3);
  return {
    type: "Unsupported" as const,
    code,
    reason: drawnCodes.has(code)
      ? ("invalid" as const)
      : ("unsupported" as const),
  };
};

/** ^BY settings at power-up */
const initialBarcodeDefaults = { moduleWidth: 2, ratio: 3, height: 10 };

type LayoutOptions = {
  /**
   * Fonts already on the printer, by path like "E:ARIAL.TTF". Without a
   * device ("ARIAL.TTF"), a font matches references to any device.
   */
  fonts?: Record<string, Uint8Array>;
  /**
   * A TrueType or OpenType font to draw font 0 with, instead of the
   * open-licensed stand-in, like the printer's own if you have a license
   */
  font0?: Uint8Array;
};

const layout = (
  commands: readonly Command[],
  options: LayoutOptions = {}
): LabelLayout[] => {
  const labels: LabelLayout[] = [];
  const stored = new Map<string, StoredGraphic>();
  const fontFiles = new FontFiles(options.fonts);
  const font0 = options.font0 && parseFontFile(options.font0);
  if (font0 === null) {
    throw new TypeError("font0 isn't a TrueType or OpenType font");
  }
  /** ^CW: font letters that call font files, kept between labels */
  const identifiers = new Map<string, FontPath>();
  let label: LabelLayout | undefined;
  let home = { x: 0, y: 0 };
  /** ^LS, ^LT and ^PM, kept between labels like the printer settings they are */
  let shift = 0;
  let top = 0;
  let mirror = false;
  let labelReverse = false;
  let field = newField();

  let defaultFont = initialFont;
  let orientation: Orientation = "N";
  let utf8 = false;
  let barcodeDefaults = initialBarcodeDefaults;

  const add = (element: Element, height: number) => {
    if (field.fromBottom) element.y -= height;
    label?.elements.push(element);
  };

  /**
   * A font setting in a font file, or in font 0 if the file isn't there,
   * which counts the command as unsupported
   */
  const fontFile = (
    path: FontPath,
    setting: FontSetting,
    index: number
  ): FontSetting => {
    const typeface = fontFiles.find(path);
    if (!typeface) label?.unsupported.push(index);
    return typeface ? { ...setting, typeface } : { ...setting, font: "0" };
  };

  for (const { command, index } of expandFormats(commands)) {
    if (command.type === "DownloadFont") {
      // Bounded fonts are converted to Zebra's own format, which we can't read
      if (!command.bounded) fontFiles.download(command, command.data);
      continue;
    }
    if (command.type === "DownloadObject") {
      const { device, name, extension, data } = command;
      if (command.format !== "A") continue;
      if (extension === "T") {
        fontFiles.download({ device, name, extension: "TTF" }, data);
      } else if (extension === "G" && command.bytesPerRow) {
        const bytes = data.startsWith(":")
          ? decodeObjectData(data)
          : decodeGraphicData(data, command.bytesPerRow, command.totalBytes);
        if (bytes) {
          stored.set(`${device}:${name}`, {
            bytes,
            bytesPerRow: command.bytesPerRow,
            rows: Math.ceil(command.totalBytes / command.bytesPerRow),
          });
        }
      }
      continue;
    }
    if (command.type === "FontIdentifier") {
      identifiers.set(command.font, command);
      continue;
    }
    if (command.type === "DownloadGraphic") {
      stored.set(`${command.device}:${command.name}`, {
        bytes: decodeGraphicData(
          command.data,
          command.bytesPerRow,
          command.totalBytes
        ),
        bytesPerRow: command.bytesPerRow,
        rows: Math.ceil(command.totalBytes / command.bytesPerRow),
      });
      continue;
    }

    if (command.type === "StartFormat") {
      label = { elements: [], unsupported: [] };
      labels.push(label);
      home = { x: 0, y: 0 };
      labelReverse = false;
      defaultFont = initialFont;
      orientation = "N";
      utf8 = false;
      field = newField();
      barcodeDefaults = initialBarcodeDefaults;
      continue;
    }
    if (!label) continue;

    field.commands.push(index);
    const common = (): Common => ({
      x: field.x,
      y: field.y,
      reverse: field.reverse || labelReverse,
      commands: field.commands,
    });

    switch (command.type) {
      case "EndFormat":
        // ^LT moves every field down, or up as far as the label's top edge,
        // wherever it is in the format
        if (top) {
          for (const element of label.elements) {
            element.y = Math.max(0, element.y + top);
          }
        }
        if (mirror) label.mirrored = true;
        label = undefined;
        break;
      case "PrintWidth":
        label.printWidth = command.width;
        break;
      case "PrintOrientation":
        label.inverted = command.orientation === "I";
        break;
      case "ImageLoad": {
        const graphic = stored.get(`${command.device}:${command.name}`);
        if (!graphic) break;
        label.elements.push({
          x: home.x,
          y: home.y,
          reverse: labelReverse,
          commands: [index],
          kind: "bitmap",
          ...graphic,
          magnificationX: 1,
          magnificationY: 1,
        });
        break;
      }
      case "LabelHome":
        home = { x: command.x, y: command.y };
        break;
      case "LabelShift":
        if (command.shift !== undefined && Math.abs(command.shift) <= 9999) {
          shift = command.shift;
        }
        break;
      case "LabelTop":
        // Printers ignore offsets beyond their range
        if (command.offset !== undefined && Math.abs(command.offset) <= 120) {
          top = command.offset;
        }
        break;
      case "LabelReverse":
        labelReverse = command.reverse;
        break;
      case "PrintMirror":
        mirror = command.mirror;
        break;
      case "FieldOrigin":
        field = {
          ...newField(),
          // ^LS can't move a field past the label's left edge
          x: Math.max(0, home.x + command.x - shift),
          y: home.y + command.y,
          commands: [index],
        };
        break;
      case "FieldTypeset":
        field = {
          ...newField(),
          x: Math.max(0, home.x + (command.x ?? 0) - shift),
          y: home.y + (command.y ?? 0),
          fromBottom: true,
          commands: [index],
        };
        break;
      case "FieldReverse":
        field.reverse = true;
        break;
      case "FieldSeparator":
        field = newField();
        break;
      case "ChangeEncoding":
        utf8 = command.charset >= 28 && command.charset <= 30;
        break;
      case "DefaultFont": {
        // Sizes that aren't given keep their previous values
        const sized =
          command.height !== undefined || command.width !== undefined;
        defaultFont = {
          font: command.font,
          height: sized ? command.height : defaultFont.height,
          width: sized ? command.width : defaultFont.width,
        };
        const path = identifiers.get(command.font);
        if (path) defaultFont = fontFile(path, defaultFont, index);
        break;
      }
      case "Font": {
        // Without a size, the field uses the default font's size
        const sized =
          command.height !== undefined || command.width !== undefined;
        field.font = {
          font: command.font,
          height: sized ? command.height : defaultFont.height,
          width: sized ? command.width : defaultFont.width,
          orientation: command.orientation,
        };
        const path = identifiers.get(command.font);
        if (path) field.font = fontFile(path, field.font, index);
        break;
      }
      case "FontByName": {
        const sized =
          command.height !== undefined || command.width !== undefined;
        field.font = fontFile(
          command,
          {
            font: "@",
            height: sized ? command.height : defaultFont.height,
            width: sized ? command.width : defaultFont.width,
            orientation: command.orientation,
          },
          index
        );
        break;
      }
      case "FieldOrientation":
        orientation = command.orientation;
        break;
      case "GraphicSymbol":
        field.symbol = {
          height: command.height,
          width: command.width,
          orientation: command.orientation,
        };
        break;
      case "FieldBlock":
        field.block = {
          width: command.width,
          maxLines: Math.max(1, command.maxLines ?? 1),
          lineSpacing: command.lineSpacing ?? 0,
          justification: command.justification ?? "L",
          hangingIndent: command.hangingIndent ?? 0,
        };
        break;
      case "FieldHexIndicator":
        field.hexIndicator = command.indicator ?? "_";
        break;
      case "FieldData": {
        const data = decodeFieldData(command.data, field.hexIndicator, utf8);
        if (field.symbol) {
          // Sizes in 24-dot steps; a missing one takes the other's, and
          // without either, the default font's
          let { height, width } = field.symbol;
          if (height === undefined && width === undefined) {
            ({ height, width } = defaultFont);
          }
          const step = (dots: number | undefined) =>
            dots === undefined
              ? undefined
              : Math.min(10, Math.max(1, Math.round(dots / 24)));
          const magY = step(height) ?? step(width) ?? 1;
          const magX = step(width) ?? magY;
          label.elements.push({
            ...common(),
            kind: "symbol",
            symbol: data.charAt(0),
            magX,
            magY,
            orientation: field.symbol.orientation ?? orientation,
            fromBottom: field.fromBottom,
          });
          break;
        }
        const { barcode } = field;
        if (barcode) {
          // GS1 DataBar's composite symbols aren't drawn yet
          if (
            barcode.type === "Gs1DataBar" &&
            ((barcode.symbology ?? 1) > 6 || data.includes("|"))
          ) {
            label.unsupported.push(field.barcodeIndex ?? index, index);
            label.elements.push({
              ...common(),
              kind: "placeholder",
              code: "^BR",
              reason: "unsupported",
              height: barcodeDefaults.height,
              orientation: barcode.orientation ?? orientation,
              fromBottom: field.fromBottom,
            });
            break;
          }
          if (barcode.type === "Unsupported") {
            label.unsupported.push(index);
            label.elements.push({
              ...common(),
              kind: "placeholder",
              code: barcode.code,
              reason: barcode.reason,
              height: barcodeDefaults.height,
              orientation,
              fromBottom: field.fromBottom,
            });
            break;
          }
          label.elements.push({
            ...common(),
            kind: "barcode",
            symbology: barcode,
            data,
            moduleWidth: barcodeDefaults.moduleWidth,
            ratio: barcodeDefaults.ratio,
            height: barcodeDefaults.height,
            // MaxiCode can't be turned
            orientation:
              barcode.type === "MaxiCode"
                ? "N"
                : barcode.orientation ?? orientation,
            fromBottom: field.fromBottom,
            font: field.font,
          });
          break;
        }
        const font = field.font ?? defaultFont;
        label.elements.push({
          ...common(),
          kind: "text",
          text: data,
          font: font.font,
          height: font.height,
          width: font.width,
          typeface: font.typeface,
          font0,
          orientation: font.orientation ?? orientation,
          fromBottom: field.fromBottom,
          block: field.block,
        });
        break;
      }
      case "GraphicBox": {
        const thickness = command.thickness ?? 1;
        const width = Math.max(command.width ?? thickness, thickness);
        const height = Math.max(command.height ?? thickness, thickness);
        add(
          {
            ...common(),
            kind: "box",
            width,
            height,
            thickness,
            color: command.color ?? "B",
            rounding: command.rounding ?? 0,
          },
          height
        );
        break;
      }
      case "GraphicCircle": {
        const diameter = command.diameter ?? 3;
        add(
          {
            ...common(),
            kind: "circle",
            diameter,
            thickness: command.thickness ?? 1,
            color: command.color ?? "B",
          },
          diameter
        );
        break;
      }
      case "GraphicEllipse": {
        const height = command.height ?? 3;
        add(
          {
            ...common(),
            kind: "ellipse",
            width: command.width ?? 3,
            height,
            thickness: command.thickness ?? 1,
            color: command.color ?? "B",
          },
          height
        );
        break;
      }
      case "GraphicDiagonal": {
        const thickness = command.thickness ?? 1;
        const height = command.height ?? Math.max(thickness, 3);
        add(
          {
            ...common(),
            kind: "diagonal",
            width: command.width ?? Math.max(thickness, 3),
            height,
            thickness,
            color: command.color ?? "B",
            direction: command.direction ?? "R",
          },
          height
        );
        break;
      }
      case "GraphicField": {
        const rows = Math.ceil(command.fieldCount / command.bytesPerRow);
        add(
          {
            ...common(),
            kind: "bitmap",
            bytes: decodeGraphicData(
              command.data,
              command.bytesPerRow,
              command.fieldCount
            ),
            bytesPerRow: command.bytesPerRow,
            rows,
            magnificationX: 1,
            magnificationY: 1,
          },
          rows
        );
        break;
      }
      case "RecallGraphic": {
        const graphic = stored.get(`${command.device}:${command.name}`);
        if (!graphic) break;
        const magnificationY = command.magnificationY ?? 1;
        add(
          {
            ...common(),
            kind: "bitmap",
            ...graphic,
            magnificationX: command.magnificationX ?? 1,
            magnificationY,
          },
          graphic.rows * magnificationY
        );
        break;
      }
      case "BarcodeDefaults":
        // Values that aren't given keep their previous ones
        barcodeDefaults = {
          moduleWidth: command.moduleWidth ?? barcodeDefaults.moduleWidth,
          ratio: command.ratio ?? barcodeDefaults.ratio,
          height: command.height ?? barcodeDefaults.height,
        };
        break;
      case "Code11":
      case "Code128":
      case "Code39":
      case "Interleaved2of5":
      case "Pdf417":
      case "Ean13":
      case "Ean8":
      case "UpcA":
      case "UpcE":
      case "UpcEanExtension":
      case "Code93":
      case "Codabar":
      case "PostalCode":
      case "Planet":
      case "Gs1DataBar":
      case "MicroPdf417":
      case "Industrial2of5":
      case "Standard2of5":
      case "Logmars":
      case "Msi":
      case "Plessey":
      case "DataMatrix":
      case "QrCode":
      case "Aztec":
      case "MaxiCode":
        field.barcode = command;
        field.barcodeIndex = index;
        break;
      case "Raw": {
        const barcode = rawBarcode(command);
        if (barcode) {
          field.barcode = barcode;
          label.unsupported.push(index);
        }
        break;
      }
    }
  }

  return labels;
};

export type {
  BarcodeCommand,
  Element,
  FontSetting,
  LabelLayout,
  LayoutOptions,
};
export { layout };
