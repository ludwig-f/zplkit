/**
 * Options for the Label builder's methods. The JSX elements take the same
 * options as props, with `x` and `y` instead of `position` and the data as
 * children.
 */
import type { Color, StorageDevice } from "./ast.js";
import type {
  Graphic,
  Orientation,
  Position,
  ZebraFontFamily,
} from "./types.js";
import type { Length } from "./units.js";

/** Options for `new Label()` and `<Label>` */
type LabelOptions = {
  /** Label width (^PW) */
  width: Length;
  /** Label height (^LL) */
  height: Length;
  /** Dots per millimeter of the printer: 6, 8, 12 or 24 for 152, 203, 300 or 600 dpi */
  dpmm: 6 | 8 | 12 | 24;
  /**
   * Print the label white on black (^LR)
   * @defaultValue false
   */
  reverse?: boolean;
  /**
   * Character set (^CI)
   * @defaultValue 28 (UTF-8)
   */
  characterSet?: number;
  /**
   * Where positions are measured from (^LH)
   * @defaultValue The top left corner
   */
  home?: Position;
  /**
   * Leave out line breaks between commands in the output
   * @defaultValue true
   */
  minify?: boolean;
  /**
   * How many copies to print (^PQ)
   * @defaultValue 1
   */
  copies?: number;
  /**
   * Print speed in inches per second, 1 to 14 depending on the printer (^PR)
   * @defaultValue The printer's setting
   */
  speed?: number;
  /**
   * Darkness relative to the printer's setting, -30 to 30 (^MD)
   * @defaultValue 0
   */
  darkness?: number;
};

/** A field's data that counts up on each copy (^SN) */
type SerialOptions = {
  /**
   * How much the last run of digits counts up by; negative counts down
   * @defaultValue 1
   */
  increment?: number;
  /**
   * Keep leading zeros, like 001; without, they print as spaces
   * @defaultValue true
   */
  leadingZeros?: boolean;
};

/** Text wrapped in a block (^FB) */
type TextBlockOptions = {
  /** Width of the block; lines wrap at spaces to fit it */
  width: Length;
  /**
   * Most lines; more print over the last one
   * @defaultValue 1
   */
  lines?: number;
  /**
   * Extra space between lines
   * @defaultValue None
   */
  lineSpacing?: Length;
  /**
   * How lines line up in the block
   * @defaultValue "left"
   */
  align?: "left" | "center" | "right" | "justify";
  /**
   * How far lines after the first are indented
   * @defaultValue None
   */
  indent?: Length;
};

/** Options for `setDefaultFont()` and `<DefaultFont>` (^CF) */
type DefaultFontOptions = {
  /** One of the printer's fonts, like ZebraFontFamily.ZERO, or a font name */
  font: ZebraFontFamily | string;
  /** Character height */
  height?: Length;
  /** Character width */
  width?: Length;
};

/** The font of a text field */
type FontOptions = {
  /**
   * One of the printer's fonts, or a font name
   * @defaultValue Font 0
   */
  name?: ZebraFontFamily | string;
  /** A font file on the printer instead, like "E:ARIAL.TTF" */
  file?: string;
  /** Character height */
  height?: Length;
  /** Character width */
  width?: Length;
  /** Which way the text runs */
  orientation?: Orientation;
};

/** Options for `text()` */
type TextOptions = {
  /** Where the field starts */
  position: Position;
  /** The text; characters ZPL would read as commands are escaped */
  text: string;
  /**
   * The font to use
   * @defaultValue The label's default font
   */
  font?: FontOptions;
  /**
   * Which way the characters run: across, down (one under the other) or
   * right to left (^FP)
   * @defaultValue "horizontal"
   */
  direction?: "horizontal" | "vertical" | "reverse";
  /**
   * Extra space between characters (^FP)
   * @defaultValue None
   */
  letterSpacing?: Length;
  /**
   * Fill in date and time codes like %Y-%m-%d %H:%M from the printer's
   * clock (^FC)
   * @defaultValue false
   */
  clock?: boolean;
  /**
   * Wrap the text in a block (^FB)
   * @defaultValue One line
   */
  block?: TextBlockOptions;
  /**
   * Count the text up on each copy, from the number at its end (^SN)
   * @defaultValue The same text on every copy
   */
  serial?: SerialOptions;
};

/** Options for `box()` and `<Box>` (^GB) */
type BoxOptions = {
  /** Where the box starts */
  position: Position;
  /** Box width */
  width: Length;
  /** Box height */
  height: Length;
  /** Line thickness; the smaller of width and height draws a solid box */
  thickness: Length;
  /**
   * B for black, W for white
   * @defaultValue "B"
   */
  color?: Color;
  /**
   * How round the corners are, from 0 (square) to 8
   * @defaultValue 0
   */
  rounding?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

/** Options for `graphic()` and `<Graphic>` (^GF) */
type GraphicOptions = {
  /** Where the graphic starts */
  position: Position;
  /** The image, for example from ImageConverter */
  graphic: Graphic;
};

/** Options for `storedGraphic()` and `<StoredGraphic>` (^XG) */
type StoredGraphicOptions = {
  /** Where the graphic starts */
  position: Position;
  /** Name of the graphic on the printer */
  name: string;
  /**
   * Where the graphic is stored: R (DRAM), E (flash), B or A
   * @defaultValue "R"
   */
  device?: StorageDevice;
  /**
   * How many times larger to print it, across and down
   * @defaultValue \{ x: 1, y: 1 \}
   */
  magnification?: { x: number; y: number };
};

/** What every barcode takes */
type BarcodeOptions = {
  /** Where the barcode starts */
  position: Position;
  /** The data to encode; it's escaped for you */
  data: string;
  /** Which way the barcode runs */
  orientation?: Orientation;
  /**
   * Count the data up on each copy, from the number at its end (^SN)
   * @defaultValue The same data on every copy
   */
  serial?: SerialOptions;
};

/** What the linear barcodes take: height and the human readable line */
type LinearBarcodeOptions = BarcodeOptions & {
  /**
   * Bar height
   * @defaultValue The height set with ^BY
   */
  height?: Length;
  /**
   * Print the data as text with the bars
   * @defaultValue true
   */
  printHri?: boolean;
  /**
   * Print that text above the bars instead of below
   * @defaultValue false
   */
  printHriAbove?: boolean;
};

/** Options for `code11()` (^B1) */
type Code11Options = LinearBarcodeOptions & {
  /**
   * Number of check digits
   * @defaultValue 2
   */
  checkDigits?: 1 | 2;
};

/** Options for `code39()` (^B3) */
type Code39Options = LinearBarcodeOptions & {
  /**
   * Add a Mod-43 check digit
   * @defaultValue false
   */
  checkDigit?: boolean;
};

/** Options for `code128()` (^BC) */
type Code128Options = LinearBarcodeOptions & {
  /**
   * Add a UCC check digit
   * @defaultValue false
   */
  useUcc?: boolean;
  /**
   * N (none), U (UCC case), A (automatic) or D (UCC/EAN)
   * @defaultValue "N"
   */
  mode?: "N" | "U" | "A" | "D";
};

/** Options for `interleaved2of5()` (^B2) */
type Interleaved2of5Options = LinearBarcodeOptions & {
  /**
   * Add a Mod-10 check digit
   * @defaultValue false
   */
  checkDigit?: boolean;
};

/** Options for `ean13()` (^BE); the data is 12 digits and the printer adds the check digit */
type Ean13Options = LinearBarcodeOptions;

/** Options for `ean8()` (^B8); the data is 7 digits and the printer adds the check digit */
type Ean8Options = LinearBarcodeOptions;

/** Options for `upcA()` (^BU); the data is 11 digits and the printer adds the check digit */
type UpcAOptions = LinearBarcodeOptions & {
  /**
   * Print the check digit in the interpretation line
   * @defaultValue true
   */
  printCheckDigit?: boolean;
};

/**
 * Options for `upcE()` (^B9). The data is a UPC-A number without its check
 * digit: 10 digits (the manufacturer and product number) with number system
 * 0, or 11 starting with the number system, 0 or 1. The printer compresses it
 * to 6 digits.
 */
type UpcEOptions = LinearBarcodeOptions & {
  /**
   * Print the check digit in the interpretation line
   * @defaultValue true
   */
  printCheckDigit?: boolean;
};

/**
 * Options for `upcEanExtension()` (^BS), the 2 or 5 digit add-on printed
 * next to a UPC or EAN code. Its interpretation line is above the bars by
 * default.
 */
type UpcEanExtensionOptions = LinearBarcodeOptions;

/** Options for `code93()` (^BA) */
type Code93Options = LinearBarcodeOptions & {
  /**
   * Print the two check characters in the interpretation line
   * @defaultValue false
   */
  printCheckDigit?: boolean;
};

/**
 * Options for `codabar()` (^BK). The data is digits and - $ : / . +, between
 * a start and a stop character.
 */
type CodabarOptions = LinearBarcodeOptions & {
  /**
   * The start character
   * @defaultValue "A"
   */
  start?: "A" | "B" | "C" | "D";
  /**
   * The stop character
   * @defaultValue "A"
   */
  stop?: "A" | "B" | "C" | "D";
};

/** What the USPS postal codes take: no width, the printer sizes the bars */
type PostalOptions = Omit<LinearBarcodeOptions, "printHri"> & {
  /**
   * Print the data as text with the bars
   * @defaultValue false
   */
  printHri?: boolean;
};

/** Options for `postnet()` (^BZ): a ZIP code of 5, 9 or 11 digits */
type PostnetOptions = PostalOptions;

/** Options for `planet()` (^B5): 11 or 13 digits */
type PlanetOptions = PostalOptions;

/**
 * Options for `intelligentMail()` (^BZ type 3): a 20 digit tracking code and
 * a routing code of 0, 5, 9 or 11 digits
 */
type IntelligentMailOptions = BarcodeOptions & {
  /**
   * Height of the tallest bars
   * @defaultValue The height set with ^BY
   */
  height?: Length;
};

/**
 * Options for `gs1DataBar()` (^BR). For the first five types the data is a
 * GTIN of up to 13 digits, and the printer adds the check digit. Expanded
 * takes GS1 element strings without parentheses, like
 * "010001234567890517251231" for AIs 01 and 17; printers would encode
 * parentheses as data.
 */
type Gs1DataBarOptions = BarcodeOptions & {
  /**
   * Which GS1 DataBar
   * @defaultValue "omnidirectional"
   */
  type?:
    | "omnidirectional"
    | "truncated"
    | "stacked"
    | "stackedOmnidirectional"
    | "limited"
    | "expanded";
  /**
   * Size of a module, 1 to 10 dots
   * @defaultValue 2 dots, 3 at 300 dpi and 6 at 600 dpi
   */
  moduleSize?: Length;
  /**
   * Height of the separator rows in stacked symbols, in modules
   * @defaultValue 1
   */
  separatorHeight?: 1 | 2;
  /**
   * Segments per row for Expanded, an even number from 2 to 22
   * @defaultValue 22
   */
  segments?: number;
};

/** Options for `microPdf417()` (^BF) */
type MicroPdf417Options = BarcodeOptions & {
  /**
   * Height of each row
   * @defaultValue The height set with ^BY
   */
  rowHeight?: Length;
  /**
   * 0 to 33, which sets the columns, rows and error correction; the
   * reference lists them
   * @defaultValue 0
   */
  mode?: number;
};

/** Options for `industrial2of5()` (^BI): digits */
type Industrial2of5Options = LinearBarcodeOptions;

/** Options for `standard2of5()` (^BJ): digits */
type Standard2of5Options = LinearBarcodeOptions;

/**
 * Options for `logmars()` (^BL): Code 39 with a Mod-43 check digit, used by
 * the U.S. Department of Defense. It always prints its text.
 */
type LogmarsOptions = Omit<LinearBarcodeOptions, "printHri">;

/** Options for `msi()` (^BM): digits */
type MsiOptions = LinearBarcodeOptions & {
  /**
   * A for none, B for one Mod 10, C for two Mod 10, D for Mod 11 then Mod 10
   * @defaultValue "B"
   */
  checkDigits?: "A" | "B" | "C" | "D";
  /**
   * Print the check digits in the interpretation line
   * @defaultValue false
   */
  printCheckDigit?: boolean;
};

/** Options for `plessey()` (^BP): digits and A to F */
type PlesseyOptions = LinearBarcodeOptions & {
  /**
   * Print the two check characters in the interpretation line
   * @defaultValue false
   */
  printCheckDigit?: boolean;
};

/** Options for `pdf417()` (^B7) */
type Pdf417Options = BarcodeOptions & {
  /**
   * Height of each row
   * @defaultValue The height set with ^BY
   */
  rowHeight?: Length;
  /**
   * Error correction level, from 0 (detection only) to 8
   * @defaultValue 0
   */
  securityLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Number of data columns, 1 to 30 */
  columns?: number;
  /** Number of rows, 3 to 90 */
  rows?: number;
  /**
   * Leave out the right row indicators and stop pattern
   * @defaultValue false
   */
  truncate?: boolean;
};

/** Options for `aztec()` (^BO) */
type AztecOptions = BarcodeOptions & {
  /**
   * Size of each square module, 1 to 10 dots
   * @defaultValue The printer's default for its resolution
   */
  moduleSize?: Length;
  /**
   * Error correction percentage (1 to 99), or 101 to 104 for a compact
   * symbol and 201 to 232 for a full-range one with that many layers
   */
  errorControl?: number;
};

/** Options for `maxiCode()` (^BD) */
type MaxiCodeOptions = Omit<BarcodeOptions, "orientation"> & {
  /**
   * 2 or 3 for carrier messages with a numeric or alphanumeric postal code,
   * 4 to 6 for other data. In modes 2 and 3 the data starts with the class
   * of service, country code and postal code.
   * @defaultValue 2
   */
  mode?: 2 | 3 | 4 | 5 | 6;
};

/** Options for `dataMatrix()` (^BX) */
type DataMatrixOptions = BarcodeOptions & {
  /** Size of each square module */
  moduleSize: Length;
  /**
   * Error correction level
   * @defaultValue 200 (ECC 200)
   */
  quality?: 0 | 50 | 80 | 100 | 140 | 200;
  /** Number of columns */
  columns?: number;
  /** Number of rows */
  rows?: number;
  /** Format ID, not used with quality 200 */
  formatId?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Escape sequence control character */
  escapeCharacter?: string;
};

/** Options for `qrCode()` (^BQ) */
type QrCodeOptions = Omit<BarcodeOptions, "orientation" | "serial"> & {
  /**
   * Size of each square module
   * @defaultValue The printer's default for its resolution
   */
  moduleSize?: Length;
  /**
   * H (highest), Q, M (standard) or L (densest)
   * @defaultValue "M"
   */
  errorCorrection?: "H" | "Q" | "M" | "L";
};

/** Options for `ellipse()` and `<Ellipse>` (^GE) */
type EllipseOptions = {
  /** Where the ellipse's box starts */
  position: Position;
  /** Ellipse width */
  width: Length;
  /** Ellipse height */
  height: Length;
  /** Line thickness; half the width or height draws a solid ellipse */
  thickness: Length;
  /**
   * B for black, W for white
   * @defaultValue "B"
   */
  color?: Color;
};

/** Options for `circle()` and `<Circle>` (^GC) */
type CircleOptions = {
  /** Where the circle's box starts */
  position: Position;
  /** Circle diameter */
  diameter: Length;
  /** Line thickness; half the diameter draws a solid circle */
  thickness: Length;
  /**
   * B for black, W for white
   * @defaultValue "B"
   */
  color?: Color;
};

/** Options for `field()` and `<Field>` */
type FieldOptions = {
  /** Where the field starts */
  position: Position;
  /** The command(s) for the field, added as written, like "^B3N,N,100,Y,N" */
  command: `${"^" | "~"}${string}`;
  /** Field data, if the command needs any; it's escaped for you */
  data?: string;
};

/** Options for `PrinterSetup.storeGraphic()` (~DG) */
type StoreGraphicOptions = {
  /** Name of the graphic, 1 to 8 characters */
  name: string;
  /** The image, for example from ImageConverter */
  graphic: Graphic;
  /**
   * Where to store it: R (DRAM), E (flash), B or A
   * @defaultValue "R"
   */
  device?: StorageDevice;
};

/** Options for `PrinterSetup.storeFont()` (~DU) */
type StoreFontOptions = {
  /** Name of the font, 1 to 8 characters; it's stored as NAME.TTF */
  name: string;
  /** The .ttf file */
  data: Uint8Array;
  /**
   * Where to store it: R (DRAM), E (flash), B or A
   * @defaultValue "R"
   */
  device?: StorageDevice;
};

export type {
  StoreGraphicOptions,
  StoreFontOptions,
  LabelOptions,
  DefaultFontOptions,
  FontOptions,
  TextOptions,
  BoxOptions,
  EllipseOptions,
  CircleOptions,
  SerialOptions,
  TextBlockOptions,
  GraphicOptions,
  StoredGraphicOptions,
  BarcodeOptions,
  LinearBarcodeOptions,
  Code11Options,
  Code39Options,
  Code128Options,
  Interleaved2of5Options,
  Ean13Options,
  Ean8Options,
  UpcAOptions,
  UpcEOptions,
  UpcEanExtensionOptions,
  Code93Options,
  CodabarOptions,
  PostnetOptions,
  PlanetOptions,
  IntelligentMailOptions,
  Gs1DataBarOptions,
  MicroPdf417Options,
  Industrial2of5Options,
  Standard2of5Options,
  LogmarsOptions,
  MsiOptions,
  PlesseyOptions,
  Pdf417Options,
  AztecOptions,
  MaxiCodeOptions,
  DataMatrixOptions,
  QrCodeOptions,
  FieldOptions,
};
