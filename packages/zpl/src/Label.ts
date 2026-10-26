import ZplContent from "./ZplContent.js";
import ZplError from "./ZplError.js";
import { escapeFieldData, serialize } from "./serialize.js";
import { toDots } from "./units.js";
import { lint } from "./lint.js";
import type { LintDiagnostic } from "./lint.js";
import { ZebraFontFamily, Orientation } from "./types.js";
import type { Command, StorageDevice } from "./ast.js";
import type { Position } from "./types.js";
import type { Length } from "./units.js";
import type {
  AztecOptions,
  BoxOptions,
  Code11Options,
  Code128Options,
  Code39Options,
  DataMatrixOptions,
  DefaultFontOptions,
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
  FieldOptions,
  GraphicOptions,
  Interleaved2of5Options,
  LabelOptions,
  MaxiCodeOptions,
  Pdf417Options,
  QrCodeOptions,
  StoredGraphicOptions,
  TextOptions,
} from "./options.js";

class Label extends ZplContent {
  /** Dots per millimeter of the printer the label is for */
  readonly dpmm: number;

  /**
   * Construct a new label
   */
  constructor(options: LabelOptions) {
    super({ minify: options.minify });
    // Types only allow these, but JavaScript and unchecked code can pass more
    if (![6, 8, 12, 24].includes(options.dpmm)) {
      throw new ZplError(
        `dpmm must be 6, 8, 12 or 24, for 152, 203, 300 or 600 dpi printers, got ${options.dpmm}`
      );
    }
    this.dpmm = options.dpmm;

    const width = this.dots(options.width);
    const height = this.dots(options.height);
    const reverse = options.reverse ?? false;

    this.add(
      { type: "StartFormat" },
      { type: "PrintWidth", width },
      { type: "LabelLength", length: height },
      { type: "LabelReverse", reverse },
      { type: "ChangeEncoding", charset: options.characterSet ?? 28 },
      {
        type: "LabelHome",
        x: this.dots(options.home?.x ?? { dots: 0 }),
        y: this.dots(options.home?.y ?? { dots: 0 }),
      }
    );

    // How this label prints, kept with it since ZPL scopes them to the format
    if (options.speed !== undefined) {
      this.add({ type: "PrintRate", speed: options.speed });
    }
    if (options.darkness !== undefined) {
      this.add({ type: "MediaDarkness", darkness: options.darkness });
    }
    if (options.copies !== undefined) {
      this.add({ type: "PrintQuantity", quantity: options.copies });
    }

    if (reverse) {
      // With ^LR every field is XORed with what is below it, so a solid black
      // background makes everything drawn on top of it come out white.
      this.addField({ x: { dots: 0 }, y: { dots: 0 } }, [
        {
          type: "GraphicBox",
          width,
          height,
          thickness: Math.min(width, height),
          color: "B",
          rounding: 0,
        },
      ]);
    }
  }

  private dots(length: Length): number {
    return toDots(length, this.dpmm);
  }

  /**
   * Add a complete field: origin, the given commands and a field separator
   */
  private addField(position: Position, commands: Command[]): this {
    return this.add(
      {
        type: "FieldOrigin",
        x: this.dots(position.x),
        y: this.dots(position.y),
      },
      ...commands,
      { type: "FieldSeparator" }
    );
  }

  /**
   * Field data commands, preceded by ^FH if the data needs escaping
   */
  private fieldData(data: string): Command[] {
    const escaped = escapeFieldData(data);

    return escaped.needsHexIndicator
      ? [
          { type: "FieldHexIndicator" },
          { type: "FieldData", data: escaped.data },
        ]
      : [{ type: "FieldData", data }];
  }

  private optionalDots(length: Length | undefined): number | undefined {
    return length === undefined ? undefined : this.dots(length);
  }

  /**
   * Manually open label
   */
  public open(): this {
    return this.add({ type: "StartFormat" });
  }

  /**
   * Close the label
   */
  public close(): this {
    return this.add({ type: "EndFormat" });
  }

  /**
   * Set the default font of the label
   */
  public setDefaultFont(options: DefaultFontOptions): this {
    return this.add({
      type: "DefaultFont",
      font: options.font,
      height: this.optionalDots(options.height),
      width: this.optionalDots(options.width),
    });
  }

  /**
   * Set the orientation (^FW) of the fields that follow and don't give one
   * @param orientation Orientation of text and barcodes
   */
  public setFieldOrientation(orientation: Orientation): this {
    return this.add({ type: "FieldOrientation", orientation });
  }

  /**
   * Draw a box or line on the label
   */
  public box(options: BoxOptions): this {
    const { position, color = "B", rounding = 0 } = options;

    return this.addField(position, [
      {
        type: "GraphicBox",
        width: this.dots(options.width),
        height: this.dots(options.height),
        thickness: this.dots(options.thickness),
        color,
        rounding,
      },
    ]);
  }

  /**
   * Recall stored graphic and draw it on the label
   */
  public storedGraphic(options: StoredGraphicOptions): this {
    const {
      position,
      name,
      device = "R",
      magnification = { x: 1, y: 1 },
    } = options;

    return this.addField(position, [
      {
        type: "RecallGraphic",
        device,
        name,
        magnificationX: magnification.x,
        magnificationY: magnification.y,
      },
    ]);
  }

  /**
   * Draw a graphic on the label
   */
  public graphic(options: GraphicOptions): this {
    const { position, graphic } = options;

    return this.addField(position, [
      {
        type: "GraphicField",
        byteCount: graphic.totalBytes,
        fieldCount: graphic.totalBytes,
        bytesPerRow: graphic.bytesPerRow,
        data: graphic.data,
      },
    ]);
  }

  /**
   * Draw text on the label. Characters that ZPL would read as commands are escaped.
   */
  public text(options: TextOptions): this {
    const { text, position, font } = options;
    const commands: Command[] = [];

    if (font?.file !== undefined) {
      const match = /^(?:([REBA]):)?([^.:]+)\.(\w+)$/.exec(font.file);
      if (!match) {
        throw new ZplError(
          `Font file must be a name with an extension, like E:ARIAL.TTF, got '${font.file}'`
        );
      }
      commands.push({
        type: "FontByName",
        orientation: font.orientation,
        height: this.optionalDots(font.height),
        width: this.optionalDots(font.width),
        device: match[1] as StorageDevice | undefined,
        name: match[2],
        extension: match[3],
      });
    } else if (font) {
      commands.push({
        type: "Font",
        font: font.name ?? ZebraFontFamily.ZERO,
        orientation: font.orientation,
        height: this.optionalDots(font.height),
        width: this.optionalDots(font.width),
      });
    }

    return this.addField(position, [...commands, ...this.fieldData(text)]);
  }

  /**
   * Draw a Code 11 barcode on the label
   */
  public code11(options: Code11Options): this {
    return this.addField(options.position, [
      {
        type: "Code11",
        orientation: options.orientation,
        checkDigits: options.checkDigits,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Code 128 barcode on the label
   */
  public code128(options: Code128Options): this {
    return this.addField(options.position, [
      {
        type: "Code128",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        uccCheckDigit: options.useUcc,
        mode: options.mode,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Code 39 barcode on the label
   */
  public code39(options: Code39Options): this {
    return this.addField(options.position, [
      {
        type: "Code39",
        orientation: options.orientation,
        checkDigit: options.checkDigit,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an Interleaved 2 of 5 barcode on the label
   */
  public interleaved2of5(options: Interleaved2of5Options): this {
    return this.addField(options.position, [
      {
        type: "Interleaved2of5",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        checkDigit: options.checkDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a PDF417 barcode on the label
   */
  public pdf417(options: Pdf417Options): this {
    return this.addField(options.position, [
      {
        type: "Pdf417",
        orientation: options.orientation,
        rowHeight: this.optionalDots(options.rowHeight),
        securityLevel: options.securityLevel,
        columns: options.columns,
        rows: options.rows,
        truncate: options.truncate,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an Aztec code on the label
   */
  public aztec(options: AztecOptions): this {
    return this.addField(options.position, [
      {
        type: "Aztec",
        orientation: options.orientation,
        magnification: this.optionalDots(options.moduleSize),
        errorControl: options.errorControl,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a MaxiCode on the label, a fixed-size code used on parcels
   */
  public maxiCode(options: MaxiCodeOptions): this {
    return this.addField(options.position, [
      { type: "MaxiCode", mode: options.mode },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an EAN-13 barcode on the label
   */
  public ean13(options: Ean13Options): this {
    return this.addField(options.position, [
      {
        type: "Ean13",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an EAN-8 barcode on the label
   */
  public ean8(options: Ean8Options): this {
    return this.addField(options.position, [
      {
        type: "Ean8",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a UPC-A barcode on the label
   */
  public upcA(options: UpcAOptions): this {
    return this.addField(options.position, [
      {
        type: "UpcA",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        printCheckDigit: options.printCheckDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a UPC-E barcode on the label
   */
  public upcE(options: UpcEOptions): this {
    return this.addField(options.position, [
      {
        type: "UpcE",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        printCheckDigit: options.printCheckDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a 2 or 5 digit UPC/EAN add-on on the label, next to a UPC or EAN code
   */
  public upcEanExtension(options: UpcEanExtensionOptions): this {
    return this.addField(options.position, [
      {
        type: "UpcEanExtension",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Code 93 barcode on the label
   */
  public code93(options: Code93Options): this {
    return this.addField(options.position, [
      {
        type: "Code93",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        printCheckDigit: options.printCheckDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an ANSI Codabar barcode on the label
   */
  public codabar(options: CodabarOptions): this {
    return this.addField(options.position, [
      {
        type: "Codabar",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        start: options.start,
        stop: options.stop,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a USPS POSTNET barcode on the label
   */
  public postnet(options: PostnetOptions): this {
    return this.addField(options.position, [
      {
        type: "PostalCode",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a USPS PLANET barcode on the label
   */
  public planet(options: PlanetOptions): this {
    return this.addField(options.position, [
      {
        type: "Planet",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a USPS Intelligent Mail barcode on the label
   */
  public intelligentMail(options: IntelligentMailOptions): this {
    return this.addField(options.position, [
      {
        type: "PostalCode",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        postalType: 3,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a GS1 DataBar on the label
   */
  public gs1DataBar(options: Gs1DataBarOptions): this {
    const types = [
      "omnidirectional",
      "truncated",
      "stacked",
      "stackedOmnidirectional",
      "limited",
      "expanded",
    ] as const;
    const symbology = options.type
      ? ((types.indexOf(options.type) + 1) as 1 | 2 | 3 | 4 | 5 | 6)
      : undefined;
    return this.addField(options.position, [
      {
        type: "Gs1DataBar",
        orientation: options.orientation,
        symbology,
        magnification: this.optionalDots(options.moduleSize),
        separatorHeight: options.separatorHeight,
        segments: options.segments,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a MicroPDF417 code on the label
   */
  public microPdf417(options: MicroPdf417Options): this {
    return this.addField(options.position, [
      {
        type: "MicroPdf417",
        orientation: options.orientation,
        rowHeight: this.optionalDots(options.rowHeight),
        mode: options.mode,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an Industrial 2 of 5 barcode on the label
   */
  public industrial2of5(options: Industrial2of5Options): this {
    return this.addField(options.position, [
      {
        type: "Industrial2of5",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Standard 2 of 5 barcode on the label
   */
  public standard2of5(options: Standard2of5Options): this {
    return this.addField(options.position, [
      {
        type: "Standard2of5",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a LOGMARS barcode on the label
   */
  public logmars(options: LogmarsOptions): this {
    return this.addField(options.position, [
      {
        type: "Logmars",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLineAbove: options.printHriAbove,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw an MSI barcode on the label
   */
  public msi(options: MsiOptions): this {
    return this.addField(options.position, [
      {
        type: "Msi",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        checkDigits: options.checkDigits,
        printCheckDigit: options.printCheckDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Plessey barcode on the label
   */
  public plessey(options: PlesseyOptions): this {
    return this.addField(options.position, [
      {
        type: "Plessey",
        orientation: options.orientation,
        height: this.optionalDots(options.height),
        interpretationLine: options.printHri,
        interpretationLineAbove: options.printHriAbove,
        printCheckDigit: options.printCheckDigit,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a Data Matrix code on the label
   */
  public dataMatrix(options: DataMatrixOptions): this {
    return this.addField(options.position, [
      {
        type: "DataMatrix",
        orientation: options.orientation ?? Orientation.Normal,
        height: this.dots(options.moduleSize),
        quality: options.quality ?? 200,
        columns: options.columns,
        rows: options.rows,
        formatId: options.formatId,
        escapeCharacter: options.escapeCharacter,
      },
      ...this.fieldData(options.data),
    ]);
  }

  /**
   * Draw a QR code on the label. The data is escaped, and the error
   * correction level is added to it as ZPL requires.
   */
  public qrCode(options: QrCodeOptions): this {
    const { errorCorrection = "M" } = options;

    return this.addField(options.position, [
      {
        type: "QrCode",
        orientation: "N",
        model: 2,
        magnification: this.optionalDots(options.moduleSize),
      },
      // A for automatic input: the printer picks the encoding
      ...this.fieldData(`${errorCorrection}A,${options.data}`),
    ]);
  }

  /**
   * Draw a field with any command, for elements without their own method.
   * The command is added as written; the data is escaped.
   */
  public field(options: FieldOptions): this {
    const { position, command, data } = options;

    if (!/^[\^~]/.test(command)) {
      throw new ZplError(`Commands start with ^ or ~, got: ${command}`);
    }

    return this.addField(position, [
      { type: "Raw", zpl: command },
      ...(data === undefined ? [] : this.fieldData(data)),
    ]);
  }

  /**
   * @returns The generated ZPL, closed with ^XZ if it is not already
   */
  public toZPL(): string {
    return serialize(this.closedCommands(), { minify: this.minify });
  }

  /**
   * Find problems the printer would not report, such as values it silently
   * changes. Checks the label as toZPL() outputs it.
   */
  public lint(): LintDiagnostic[] {
    return lint(this.closedCommands());
  }

  /** The commands, ending with ^XZ */
  private closedCommands(): Command[] {
    const last = this.nodes[this.nodes.length - 1];

    return last?.type === "EndFormat"
      ? this.nodes
      : [...this.nodes, { type: "EndFormat" }];
  }

  /**
   * Validate the generated ZPL
   * @param strict Whether to throw an error if using an unknown ZPL command. Set to `false` if you want to use commands that are not yet supported in this library.
   */
  public validate(strict = true): void {
    super.validate(strict);

    const count = (type: Command["type"], pattern: RegExp): number =>
      this.nodes.reduce(
        (total, node) =>
          total +
          (node.type === type
            ? 1
            : node.type === "Raw"
            ? (node.zpl.match(pattern) ?? []).length
            : 0),
        0
      );
    const opened =
      count("FieldOrigin", /\^FO/g) + count("FieldTypeset", /\^FT/g);
    const closed = count("FieldSeparator", /\^FS/g);

    if (opened !== closed) {
      throw new ZplError(
        `Label opens ${opened} fields (^FO/^FT) but closes ${closed} (^FS).`
      );
    }
  }
}

export default Label;
