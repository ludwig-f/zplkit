/**
 * Abstract syntax tree for ZPL.
 *
 * ZPL is a stream of commands interpreted by a state machine (fonts, ^BY
 * defaults and field origins carry over between commands), so a label is a
 * flat list of command nodes rather than a nested tree. Each node maps 1:1 to
 * a single ZPL command, which keeps the AST lossless: parse -> serialize
 * yields the same commands.
 *
 * All lengths are in dots, ZPL's native unit. Optional parameters that are
 * left undefined are omitted from the output so the printer default applies.
 *
 * Parameter names and defaults follow the Zebra ZPL II Programming Guide.
 */

/** Character offsets of a node in its source text, set by the parser */
type Span = { start: number; end: number };

type Orientation = "N" | "R" | "I" | "B";
type Color = "B" | "W";
type Justification = 0 | 1 | 2;

type Node<T extends string, P = object> = { type: T; span?: Span } & P;

/** `^XA` */
type StartFormat = Node<"StartFormat">;
/** `^XZ` */
type EndFormat = Node<"EndFormat">;
/** `^PWa` */
type PrintWidth = Node<"PrintWidth", { width: number }>;
/** `^LLy` */
type LabelLength = Node<"LabelLength", { length: number }>;
/** `^LHx,y` */
type LabelHome = Node<"LabelHome", { x: number; y: number }>;
/** `^LRa` */
type LabelReverse = Node<"LabelReverse", { reverse: boolean }>;
/** `^CIa` */
type ChangeEncoding = Node<"ChangeEncoding", { charset: number }>;
/** `^CFf,h,w` */
type DefaultFont = Node<
  "DefaultFont",
  { font: string; height?: number; width?: number }
>;

/** `^FWr,z` - default orientation and justification for the following fields */
type FieldOrientation = Node<
  "FieldOrientation",
  { orientation: Orientation; justification?: Justification }
>;
/** `^FOx,y,z` */
type FieldOrigin = Node<
  "FieldOrigin",
  { x: number; y: number; justification?: Justification }
>;
/** `^FTx,y,z` */
type FieldTypeset = Node<
  "FieldTypeset",
  { x?: number; y?: number; justification?: Justification }
>;
/** `^Afo,h,w` */
type Font = Node<
  "Font",
  {
    font: string;
    orientation?: Orientation;
    height?: number;
    width?: number;
  }
>;
/** `^A@o,h,w,d:o.x` */
type FontByName = Node<
  "FontByName",
  {
    orientation?: Orientation;
    height?: number;
    width?: number;
    /** Without a device, the printer looks on each */
    device?: StorageDevice;
    name: string;
    extension: string;
  }
>;
/** `^CWa,d:o.x`: lets ^A and ^CF call a font file by a letter */
type FontIdentifier = Node<
  "FontIdentifier",
  { font: string; device: StorageDevice; name: string; extension: string }
>;
/** `^FBa,b,c,d,e` */
type FieldBlock = Node<
  "FieldBlock",
  {
    width: number;
    maxLines?: number;
    lineSpacing?: number;
    justification?: "L" | "C" | "R" | "J";
    hangingIndent?: number;
  }
>;
/** `^FR` */
type FieldReverse = Node<"FieldReverse">;
/** `^FHa` */
type FieldHexIndicator = Node<"FieldHexIndicator", { indicator?: string }>;
/** `^FD` - data is stored exactly as written, including any ^FH escapes */
type FieldData = Node<
  "FieldData",
  {
    data: string;
    /** Written as ^FV, which prints the same as ^FD */
    variable?: boolean;
  }
>;
/** `^FS` */
type FieldSeparator = Node<"FieldSeparator">;
/** `^FX` */
type Comment = Node<"Comment", { text: string }>;

/** `^GBw,h,t,c,r` */
type GraphicBox = Node<
  "GraphicBox",
  {
    width?: number;
    height?: number;
    thickness?: number;
    color?: Color;
    rounding?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  }
>;
/** `^GCd,t,c` */
type GraphicCircle = Node<
  "GraphicCircle",
  { diameter?: number; thickness?: number; color?: Color }
>;
/** `^GEw,h,t,c` */
type GraphicEllipse = Node<
  "GraphicEllipse",
  { width?: number; height?: number; thickness?: number; color?: Color }
>;
/** `^GDw,h,t,c,o` */
type GraphicDiagonal = Node<
  "GraphicDiagonal",
  {
    width?: number;
    height?: number;
    thickness?: number;
    color?: Color;
    direction?: "R" | "L";
  }
>;
/** `^GFA,b,c,d,data` (ASCII hex only) */
type GraphicField = Node<
  "GraphicField",
  { byteCount: number; fieldCount: number; bytesPerRow: number; data: string }
>;
/** `^XGd:o.x,mx,my` */
type RecallGraphic = Node<
  "RecallGraphic",
  {
    device: StorageDevice;
    name: string;
    magnificationX?: number;
    magnificationY?: number;
  }
>;

/** `^BYw,r,h` */
type BarcodeDefaults = Node<
  "BarcodeDefaults",
  { moduleWidth?: number; ratio?: number; height?: number }
>;
/** `^B1o,e,h,f,g` */
type Code11 = Node<
  "Code11",
  {
    orientation?: Orientation;
    /** `Y` = 1 check digit, `N` = 2 check digits */
    checkDigits?: 1 | 2;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BCo,h,f,g,e,m` */
type Code128 = Node<
  "Code128",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    uccCheckDigit?: boolean;
    mode?: "N" | "U" | "A" | "D";
  }
>;
/** `^B3o,e,h,f,g` */
type Code39 = Node<
  "Code39",
  {
    orientation?: Orientation;
    /** Adds a Mod-43 check digit */
    checkDigit?: boolean;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^B2o,h,f,g,e` */
type Interleaved2of5 = Node<
  "Interleaved2of5",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Adds a Mod-10 check digit */
    checkDigit?: boolean;
  }
>;
/** `^B7o,h,s,c,r,t` */
type Pdf417 = Node<
  "Pdf417",
  {
    orientation?: Orientation;
    /** Height of each row in dots */
    rowHeight?: number;
    /** Error correction, 0 (detection only) to 8 */
    securityLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    /** Data columns, 1 to 30 */
    columns?: number;
    /** Rows, 3 to 90 */
    rows?: number;
    /** Leaves out the right row indicators and stop pattern */
    truncate?: boolean;
  }
>;
/** `^BEo,h,f,g` */
type Ean13 = Node<
  "Ean13",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^B8o,h,f,g`: 7 digits, and the printer adds the check digit */
type Ean8 = Node<
  "Ean8",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BUo,h,f,g,e`: 11 digits, and the printer adds the check digit */
type UpcA = Node<
  "UpcA",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Prints the check digit in the interpretation line */
    printCheckDigit?: boolean;
  }
>;
/** `^B9o,h,f,g,e`: a UPC-A number, compressed to 6 digits */
type UpcE = Node<
  "UpcE",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Prints the check digit in the interpretation line */
    printCheckDigit?: boolean;
  }
>;
/** `^BSo,h,f,g`: a 2 or 5 digit add-on for UPC and EAN codes */
type UpcEanExtension = Node<
  "UpcEanExtension",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BAo,h,f,g,e` */
type Code93 = Node<
  "Code93",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Prints the check characters in the interpretation line */
    printCheckDigit?: boolean;
  }
>;
/** `^BKo,e,h,f,g,k,l`: ANSI Codabar */
type Codabar = Node<
  "Codabar",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Start character, A by default */
    start?: "A" | "B" | "C" | "D";
    /** Stop character, A by default */
    stop?: "A" | "B" | "C" | "D";
  }
>;
/** `^BZo,h,f,g,t`: USPS POSTNET, PLANET or Intelligent Mail */
type PostalCode = Node<
  "PostalCode",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** 0 for POSTNET (the default), 1 for PLANET, 3 for Intelligent Mail */
    postalType?: 0 | 1 | 3;
  }
>;
/** `^B5o,h,f,g`: USPS PLANET */
type Planet = Node<
  "Planet",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BRa,b,c,d,e,f`: GS1 DataBar, alone or in a composite symbol */
type Gs1DataBar = Node<
  "Gs1DataBar",
  {
    orientation?: Orientation;
    /**
     * 1 Omnidirectional, 2 Truncated, 3 Stacked, 4 Stacked Omnidirectional,
     * 5 Limited, 6 Expanded, 7 UPC-A, 8 UPC-E, 9 EAN-13, 10 EAN-8, 11 and 12
     * GS1-128 with a CC-A/B or CC-C composite component
     */
    symbology?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    /** Module width in dots, 1 to 10 */
    magnification?: number;
    /** Height of separator rows in modules, 1 or 2 */
    separatorHeight?: 1 | 2;
    /** Height of the linear part of UPC, EAN and GS1-128 composites, in dots */
    height?: number;
    /** Segments per row of DataBar Expanded, 2 to 22 and even */
    segments?: number;
  }
>;
/** `^BFo,h,m`: MicroPDF417 */
type MicroPdf417 = Node<
  "MicroPdf417",
  {
    orientation?: Orientation;
    /** Height of each row in dots */
    rowHeight?: number;
    /** 0 to 33, which sets the columns, rows and error correction */
    mode?: number;
  }
>;
/** `^BIo,h,f,g`: Industrial 2 of 5 */
type Industrial2of5 = Node<
  "Industrial2of5",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BJo,h,f,g`: Standard 2 of 5 */
type Standard2of5 = Node<
  "Standard2of5",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BLo,h,g`: LOGMARS, Code 39 with a check digit, always with its text */
type Logmars = Node<
  "Logmars",
  {
    orientation?: Orientation;
    height?: number;
    interpretationLineAbove?: boolean;
  }
>;
/** `^BMo,e,h,f,g,e2`: MSI */
type Msi = Node<
  "Msi",
  {
    orientation?: Orientation;
    /** A none, B one Mod 10 (the default), C two Mod 10, D Mod 11 and Mod 10 */
    checkDigits?: "A" | "B" | "C" | "D";
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
    /** Prints the check digits in the interpretation line */
    printCheckDigit?: boolean;
  }
>;
/** `^BPo,e,h,f,g`: Plessey */
type Plessey = Node<
  "Plessey",
  {
    orientation?: Orientation;
    /** Prints the check characters in the interpretation line */
    printCheckDigit?: boolean;
    height?: number;
    interpretationLine?: boolean;
    interpretationLineAbove?: boolean;
  }
>;
/** `^PQq,p,r,o,e`: how many copies print, and pauses between them */
type PrintQuantity = Node<
  "PrintQuantity",
  {
    /** Copies to print */
    quantity?: number;
    /** Pause, and cut on cutters, after this many labels */
    pauseEvery?: number;
    /** Copies of each serialized label (^SN) before it counts up */
    replicates?: number;
    /** Print without the pauses */
    overridePause?: boolean;
    /** Cut after a label that errored */
    cutOnError?: boolean;
  }
>;
/** A print speed: inches per second, or A to E for 1, 2, 3, 4 and 6 */
type PrintSpeed = number | "A" | "B" | "C" | "D" | "E";
/** `^PRa,s,b`: print, slew and backfeed speeds */
type PrintRate = Node<
  "PrintRate",
  {
    /** Print speed */
    speed?: PrintSpeed;
    /** Speed while feeding blank media */
    slew?: PrintSpeed;
    /** Speed while backfeeding */
    backfeed?: PrintSpeed;
  }
>;
/** `^MDa`: darkness relative to the printer's setting, for this label */
type MediaDarkness = Node<
  "MediaDarkness",
  {
    /** -30 to 30 */
    darkness?: number;
  }
>;
/** `^BXo,h,s,c,r,f,g,a` */
type DataMatrix = Node<
  "DataMatrix",
  {
    orientation?: Orientation;
    /** Size of each square module in dots */
    height?: number;
    quality?: 0 | 50 | 80 | 100 | 140 | 200;
    columns?: number;
    rows?: number;
    formatId?: 1 | 2 | 3 | 4 | 5 | 6;
    escapeCharacter?: string;
  }
>;

/** `^BOa,b,c,d,e,f,g` */
type Aztec = Node<
  "Aztec",
  {
    orientation?: Orientation;
    /** Size of each square module in dots, 1 to 10 */
    magnification?: number;
    extendedChannel?: boolean;
    /**
     * 0 for the default, 1 to 99 for an error correction percentage, 101 to
     * 104 for compact symbols with that many layers less 100, 201 to 232 for
     * full-range ones less 200, and 300 for a rune
     */
    errorControl?: number;
    menu?: boolean;
    /** Symbols in a structured append, 1 to 26 */
    symbolCount?: number;
    structuredAppendId?: string;
  }
>;
/** `^BDm,n,t` */
type MaxiCode = Node<
  "MaxiCode",
  {
    /** 2 and 3 for carrier messages, 4 to 6 for other data */
    mode?: 2 | 3 | 4 | 5 | 6;
    /** Position in a structured append, and the number of symbols in it */
    symbolNumber?: number;
    symbolCount?: number;
  }
>;

/** `^BQa,b,c,d,e` */
type QrCode = Node<
  "QrCode",
  {
    /** QR codes can't be rotated, so this is always N */
    orientation?: "N";
    model?: 1 | 2;
    /** Size of each square module in dots, 1 to 100 */
    magnification?: number;
    errorCorrection?: "H" | "Q" | "M" | "L";
    mask?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }
>;

/** `~SDa` */
type SetDarkness = Node<"SetDarkness", { darkness: number }>;
/** `~DGd:o.x,t,w,data` */
type DownloadGraphic = Node<
  "DownloadGraphic",
  {
    device: StorageDevice;
    name: string;
    totalBytes: number;
    bytesPerRow: number;
    data: string;
  }
>;
/** `~DUd:o.x,s,data` (unbounded) and `~DTd:o.x,s,data` (bounded) */
type DownloadFont = Node<
  "DownloadFont",
  {
    /** ~DT: a font converted to Zebra's bounded format; ~DU: a TrueType file */
    bounded: boolean;
    device: StorageDevice;
    name: string;
    extension: string;
    /** Size of the font in bytes */
    size: number;
    /** The font as hex */
    data: string;
  }
>;
/** `~DYd:f,b,x,t,w,data` */
type DownloadObject = Node<
  "DownloadObject",
  {
    device: StorageDevice;
    /** Name without extension: `extension` sets the file type */
    name: string;
    /** A: hex (or :B64: / :Z64:), B: binary, C: AR-compressed, P: PNG */
    format: "A" | "B" | "C" | "P";
    /** File type, like T for TrueType (.TTF) or G for a graphic (.GRF) */
    extension: string;
    totalBytes: number;
    /** Bytes per row, for graphics */
    bytesPerRow?: number;
    data: string;
  }
>;
/** `^POa`: I prints the whole label upside down */
type PrintOrientation = Node<"PrintOrientation", { orientation: "N" | "I" }>;
/** `^GSo,h,w`: the field data picks a symbol, A ® B © C ™ D UL E CSA */
type GraphicSymbol = Node<
  "GraphicSymbol",
  { orientation?: Orientation; height?: number; width?: number }
>;
/** `^DFd:o.x`: stores the rest of the format instead of printing it */
type DownloadFormat = Node<
  "DownloadFormat",
  { device: StorageDevice; name: string; extension: string }
>;
/** `^XFd:o.x`: prints a stored format, with data for its numbered fields */
type RecallFormat = Node<
  "RecallFormat",
  { device: StorageDevice; name: string; extension: string }
>;
/** `^FNn"prompt"` */
type FieldNumber = Node<"FieldNumber", { number: number; prompt?: string }>;
/** `^ILd:o.x`: draws a stored image at the label home */
type ImageLoad = Node<
  "ImageLoad",
  { device: StorageDevice; name: string; extension: string }
>;
/** `^IDd:o.x` */
type DeleteObject = Node<
  "DeleteObject",
  { device: StorageDevice; name: string; extension: string }
>;

/** Any command without a typed node; kept verbatim, prefix included */
type Raw = Node<"Raw", { zpl: string }>;

type StorageDevice = "R" | "E" | "B" | "A";

type Command =
  | StartFormat
  | EndFormat
  | PrintWidth
  | LabelLength
  | LabelHome
  | LabelReverse
  | ChangeEncoding
  | DefaultFont
  | FieldOrientation
  | FieldOrigin
  | FieldTypeset
  | Font
  | FontByName
  | FontIdentifier
  | FieldBlock
  | FieldReverse
  | FieldHexIndicator
  | FieldData
  | FieldSeparator
  | Comment
  | GraphicBox
  | GraphicCircle
  | GraphicEllipse
  | GraphicDiagonal
  | GraphicField
  | RecallGraphic
  | BarcodeDefaults
  | Code11
  | Code128
  | Code39
  | Interleaved2of5
  | Pdf417
  | Ean13
  | Ean8
  | UpcA
  | UpcE
  | UpcEanExtension
  | Code93
  | Codabar
  | PostalCode
  | Planet
  | Gs1DataBar
  | MicroPdf417
  | Industrial2of5
  | Standard2of5
  | Logmars
  | Msi
  | Plessey
  | PrintQuantity
  | PrintRate
  | MediaDarkness
  | DataMatrix
  | QrCode
  | Aztec
  | MaxiCode
  | PrintOrientation
  | GraphicSymbol
  | DownloadFormat
  | RecallFormat
  | FieldNumber
  | ImageLoad
  | SetDarkness
  | DownloadGraphic
  | DownloadFont
  | DownloadObject
  | DeleteObject
  | Raw;

export type {
  Span,
  Orientation,
  Color,
  Justification,
  StorageDevice,
  Command,
  StartFormat,
  EndFormat,
  PrintWidth,
  LabelLength,
  LabelHome,
  LabelReverse,
  ChangeEncoding,
  DefaultFont,
  FieldOrientation,
  FieldOrigin,
  FieldTypeset,
  Font,
  FontByName,
  FontIdentifier,
  FieldBlock,
  FieldReverse,
  FieldHexIndicator,
  FieldData,
  FieldSeparator,
  Comment,
  GraphicBox,
  GraphicCircle,
  GraphicEllipse,
  GraphicDiagonal,
  GraphicField,
  RecallGraphic,
  BarcodeDefaults,
  Code11,
  Code128,
  Code39,
  Interleaved2of5,
  Pdf417,
  Ean13,
  Ean8,
  UpcA,
  UpcE,
  UpcEanExtension,
  Code93,
  Codabar,
  PostalCode,
  Planet,
  Gs1DataBar,
  MicroPdf417,
  Industrial2of5,
  Standard2of5,
  Logmars,
  Msi,
  Plessey,
  PrintQuantity,
  PrintSpeed,
  PrintRate,
  MediaDarkness,
  DataMatrix,
  QrCode,
  Aztec,
  MaxiCode,
  PrintOrientation,
  GraphicSymbol,
  DownloadFormat,
  RecallFormat,
  FieldNumber,
  ImageLoad,
  SetDarkness,
  DownloadGraphic,
  DownloadFont,
  DownloadObject,
  DeleteObject,
  Raw,
};
