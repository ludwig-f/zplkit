import LabelBuilder from "./Label.js";
import ZplError from "./ZplError.js";
import { Fragment, jsx } from "./jsx-runtime.js";
import type { ZplElement, ZplNode } from "./jsx-runtime.js";
import type { Orientation, ZebraFontFamily } from "./types.js";
import type { Length } from "./units.js";
import type {
  AztecOptions,
  BoxOptions,
  CircleOptions,
  EllipseOptions,
  TextOptions,
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
  FontOptions,
  GraphicOptions,
  Interleaved2of5Options,
  LabelOptions,
  MaxiCodeOptions,
  Pdf417Options,
  QrCodeOptions,
  StoredGraphicOptions,
} from "./options.js";

/** Where an element starts, measured from the label home */
type Position = {
  /** Distance from the left */
  x: Length;
  /** Distance from the top */
  y: Length;
};

/** Text content: strings and numbers are joined, false/null/undefined skipped */
type TextChild = string | number | boolean | null | undefined;
type TextChildren = TextChild | TextChild[];

/** An element's props: a builder method's options, with x and y for position */
type PositionedProps<O extends { position: unknown }> = Position &
  Omit<O, "position">;

/** A barcode's props: its options, with x and y, and the data as children */
type BarcodeProps<O extends { position: unknown; data: string }> = Position &
  Omit<O, "position" | "data"> & {
    /** The data to encode; it's escaped for you */
    children: TextChildren;
  };

type LabelProps = LabelOptions & {
  /** The label's elements */
  children?: ZplNode;
};
type DefaultFontProps = DefaultFontOptions;
type FieldOrientationProps = {
  /** Orientation of the fields that follow */
  orientation: Orientation;
};
type TextProps = Position &
  Omit<FontOptions, "name"> &
  Pick<
    TextOptions,
    "direction" | "letterSpacing" | "clock" | "block" | "serial"
  > & {
    /**
     * One of the printer's fonts, or a font name
     * @defaultValue The label's default font
     */
    font?: ZebraFontFamily | string;
    /** The text; characters ZPL would read as commands are escaped */
    children: TextChildren;
  };
type BoxProps = PositionedProps<BoxOptions>;
type EllipseProps = PositionedProps<EllipseOptions>;
type CircleProps = PositionedProps<CircleOptions>;
type GraphicProps = PositionedProps<GraphicOptions>;
type StoredGraphicProps = PositionedProps<StoredGraphicOptions>;
type Code11Props = BarcodeProps<Code11Options>;
type Code39Props = BarcodeProps<Code39Options>;
type Code128Props = BarcodeProps<Code128Options>;
type Interleaved2of5Props = BarcodeProps<Interleaved2of5Options>;
type EAN13Props = BarcodeProps<Ean13Options>;
type EAN8Props = BarcodeProps<Ean8Options>;
type UpcAProps = BarcodeProps<UpcAOptions>;
type UpcEProps = BarcodeProps<UpcEOptions>;
type UpcEanExtensionProps = BarcodeProps<UpcEanExtensionOptions>;
type Code93Props = BarcodeProps<Code93Options>;
type CodabarProps = BarcodeProps<CodabarOptions>;
type PostnetProps = BarcodeProps<PostnetOptions>;
type PlanetProps = BarcodeProps<PlanetOptions>;
type IntelligentMailProps = BarcodeProps<IntelligentMailOptions>;
type GS1DataBarProps = BarcodeProps<Gs1DataBarOptions>;
type MicroPDF417Props = BarcodeProps<MicroPdf417Options>;
type Industrial2of5Props = BarcodeProps<Industrial2of5Options>;
type Standard2of5Props = BarcodeProps<Standard2of5Options>;
type LOGMARSProps = BarcodeProps<LogmarsOptions>;
type MSIProps = BarcodeProps<MsiOptions>;
type PlesseyProps = BarcodeProps<PlesseyOptions>;
type PDF417Props = BarcodeProps<Pdf417Options>;
type AztecProps = BarcodeProps<AztecOptions>;
type MaxiCodeProps = BarcodeProps<MaxiCodeOptions>;
type DataMatrixProps = BarcodeProps<DataMatrixOptions>;
type QrCodeProps = BarcodeProps<QrCodeOptions>;
type FieldProps = Position &
  Omit<FieldOptions, "position" | "data"> & {
    /** Field data, if the command needs any; it's escaped for you */
    children?: TextChildren;
  };
type RawProps = {
  /** ZPL added as written */
  zpl: string;
};

const REACT_FRAGMENT = Symbol.for("react.fragment");

/** How to draw each built-in element, keyed by its component */
const primitives = new Map<
  unknown,
  (label: LabelBuilder, props: never) => void
>();

/**
 * Define a built-in element. Calling the component only creates an element;
 * build() looks up the draw function when it reaches the element.
 */
const primitive = <P>(
  draw: (label: LabelBuilder, props: P) => void
): ((props: P) => ZplElement) => {
  const component = (props: P): ZplElement => jsx(component, props);
  primitives.set(component, draw);
  return component;
};

const text = (children: TextChildren): string =>
  (Array.isArray(children) ? children : [children])
    .filter(
      (child) =>
        child !== null &&
        child !== undefined &&
        child !== false &&
        child !== true
    )
    .join("");

const position = ({ x, y }: Position) => ({ x, y });

/**
 * The root of every label. Turn it into a Label builder with build().
 * Takes the same options as the Label constructor.
 */
const Label = (props: LabelProps): ZplElement => jsx(Label, props);

/**
 * Draw a node on the label: built-in elements are drawn, components are
 * called and their result drawn, and false, null and undefined are skipped
 * so that `{condition && <Text>…</Text>}` works. Works on elements created
 * by zplkit's JSX runtime as well as React's.
 */
const draw = (label: LabelBuilder, node: unknown): void => {
  if (Array.isArray(node)) {
    for (const child of node) draw(label, child);
    return;
  }

  if (node === null || node === undefined || typeof node === "boolean") {
    return;
  }

  if (typeof node !== "object" || !("type" in node) || !("props" in node)) {
    throw new ZplError(
      `Unexpected child ${JSON.stringify(
        node
      )}: text has to be wrapped in <Text>`
    );
  }

  const { type, props } = node as {
    type: unknown;
    props: { children?: unknown };
  };
  const drawPrimitive = primitives.get(type);

  if (type === Label) {
    throw new ZplError("A <Label> cannot be placed inside another <Label>");
  } else if (drawPrimitive) {
    drawPrimitive(label, props as never);
  } else if (type === Fragment || type === REACT_FRAGMENT) {
    draw(label, props.children);
  } else if (typeof type === "function") {
    draw(label, type(props));
  } else if (typeof type === "string") {
    throw new ZplError(`<${type}> can't be used in a label`);
  } else {
    throw new ZplError(`Unsupported element type: ${String(type)}`);
  }
};

/**
 * Turn a <Label> element, or a component that returns one, into a Label
 * builder, which has toZPL(), validate() and the label's commands
 */
const build = (root: ZplElement): LabelBuilder => {
  // Unwrap components like <ShippingLabel /> until the <Label> appears
  while (
    typeof root?.type === "function" &&
    root.type !== Label &&
    !primitives.has(root.type) &&
    root.type !== Fragment
  ) {
    root = root.type(root.props);
  }

  if (root?.type !== Label) {
    throw new ZplError("build() expects a <Label> element");
  }

  const { children, ...options } = root.props as LabelProps;
  const label = new LabelBuilder(options);
  draw(label, children);

  return label;
};

/** Set the default font (^CF) for the text that follows */
const DefaultFont = primitive((label, props: DefaultFontProps) =>
  label.setDefaultFont(props)
);

/** Set the orientation (^FW) of the fields that follow and don't give one */
const FieldOrientation = primitive((label, props: FieldOrientationProps) =>
  label.setFieldOrientation(props.orientation)
);

/** Text. Without font props it uses the label's default font. */
const Text = primitive((label, props: TextProps) => {
  const { font, file, height, width, orientation } = props;
  const hasFont =
    font !== undefined ||
    file !== undefined ||
    height !== undefined ||
    width !== undefined ||
    orientation !== undefined;

  label.text({
    position: position(props),
    text: text(props.children),
    font: hasFont
      ? { name: font, file, height, width, orientation }
      : undefined,
    direction: props.direction,
    letterSpacing: props.letterSpacing,
    clock: props.clock,
    block: props.block,
    serial: props.serial,
  });
});

/** A box or line */
const Box = primitive((label, props: BoxProps) =>
  label.box({ ...props, position: position(props) })
);

/** An ellipse */
const Ellipse = primitive((label, props: EllipseProps) =>
  label.ellipse({ ...props, position: position(props) })
);

/** A circle */
const Circle = primitive((label, props: CircleProps) =>
  label.circle({ ...props, position: position(props) })
);

/** The builder's options for a barcode element's props */
const barcode = <P extends Position & { children: TextChildren }>({
  children,
  ...props
}: P) => ({ ...props, position: position(props), data: text(children) });

/** Code 11 barcode, with the data as children */
const Code11 = primitive((label, props: Code11Props) =>
  label.code11(barcode(props))
);

/** Code 128 barcode, with the data as children */
const Code128 = primitive((label, props: Code128Props) =>
  label.code128(barcode(props))
);

/** Code 39 barcode, with the data as children */
const Code39 = primitive((label, props: Code39Props) =>
  label.code39(barcode(props))
);

/** Interleaved 2 of 5 barcode, with the digits as children */
const Interleaved2of5 = primitive((label, props: Interleaved2of5Props) =>
  label.interleaved2of5(barcode(props))
);

/** PDF417 barcode, with the data as children */
const PDF417 = primitive((label, props: PDF417Props) =>
  label.pdf417(barcode(props))
);

/** Aztec code, with the data as children */
const Aztec = primitive((label, props: AztecProps) =>
  label.aztec(barcode(props))
);

/** MaxiCode, with the data as children */
const MaxiCode = primitive((label, props: MaxiCodeProps) =>
  label.maxiCode(barcode(props))
);

/** EAN-13 barcode, with the 12 data digits as children */
const EAN13 = primitive((label, props: EAN13Props) =>
  label.ean13(barcode(props))
);

/** EAN-8 barcode, with the 7 data digits as children */
const EAN8 = primitive((label, props: EAN8Props) => label.ean8(barcode(props)));

/** UPC-A barcode, with the 11 data digits as children */
const UpcA = primitive((label, props: UpcAProps) => label.upcA(barcode(props)));

/** UPC-E barcode, with the UPC-A number as children */
const UpcE = primitive((label, props: UpcEProps) => label.upcE(barcode(props)));

/** UPC/EAN add-on, with the 2 or 5 digits as children */
const UpcEanExtension = primitive((label, props: UpcEanExtensionProps) =>
  label.upcEanExtension(barcode(props))
);

/** Code 93 barcode, with the data as children */
const Code93 = primitive((label, props: Code93Props) =>
  label.code93(barcode(props))
);

/** ANSI Codabar barcode, with the data as children */
const Codabar = primitive((label, props: CodabarProps) =>
  label.codabar(barcode(props))
);

/** USPS POSTNET barcode, with the ZIP code as children */
const Postnet = primitive((label, props: PostnetProps) =>
  label.postnet(barcode(props))
);

/** USPS PLANET barcode, with the digits as children */
const Planet = primitive((label, props: PlanetProps) =>
  label.planet(barcode(props))
);

/** USPS Intelligent Mail barcode, with the tracking and routing codes as children */
const IntelligentMail = primitive((label, props: IntelligentMailProps) =>
  label.intelligentMail(barcode(props))
);

/** GS1 DataBar, with the GTIN or GS1 element strings as children */
const GS1DataBar = primitive((label, props: GS1DataBarProps) =>
  label.gs1DataBar(barcode(props))
);

/** MicroPDF417 code, with the data as children */
const MicroPDF417 = primitive((label, props: MicroPDF417Props) =>
  label.microPdf417(barcode(props))
);

/** Industrial 2 of 5 barcode, with the digits as children */
const Industrial2of5 = primitive((label, props: Industrial2of5Props) =>
  label.industrial2of5(barcode(props))
);

/** Standard 2 of 5 barcode, with the digits as children */
const Standard2of5 = primitive((label, props: Standard2of5Props) =>
  label.standard2of5(barcode(props))
);

/** LOGMARS barcode, with the data as children */
const LOGMARS = primitive((label, props: LOGMARSProps) =>
  label.logmars(barcode(props))
);

/** MSI barcode, with the digits as children */
const MSI = primitive((label, props: MSIProps) => label.msi(barcode(props)));

/** Plessey barcode, with the data as children */
const Plessey = primitive((label, props: PlesseyProps) =>
  label.plessey(barcode(props))
);

/** Data Matrix code, with the data as children */
const DataMatrix = primitive((label, props: DataMatrixProps) =>
  label.dataMatrix(barcode(props))
);

/** QR code, with the data as children */
const QrCode = primitive((label, props: QrCodeProps) =>
  label.qrCode(barcode(props))
);

/**
 * A field with any command, for elements without their own component. The
 * command is added as written; children are the escaped field data.
 */
const Field = primitive((label, { children, ...props }: FieldProps) =>
  label.field({
    command: props.command,
    position: position(props),
    data: children === undefined ? undefined : text(children),
  })
);

/** An image, e.g. from ImageConverter */
const Graphic = primitive((label, props: GraphicProps) =>
  label.graphic({ position: position(props), graphic: props.graphic })
);

/** A graphic stored on the printer with PrinterSetup.storeGraphic() */
const StoredGraphic = primitive((label, props: StoredGraphicProps) =>
  label.storedGraphic({ ...props, position: position(props) })
);

/** ZPL for commands without an element, added verbatim */
const Raw = primitive((label, props: RawProps) => label.raw(props.zpl));

export {
  Label,
  build,
  DefaultFont,
  FieldOrientation,
  Text,
  Box,
  Ellipse,
  Circle,
  Code11,
  Code128,
  Code39,
  Interleaved2of5,
  PDF417,
  Aztec,
  MaxiCode,
  EAN13,
  EAN8,
  UpcA,
  UpcE,
  UpcEanExtension,
  Code93,
  Codabar,
  Postnet,
  Planet,
  IntelligentMail,
  GS1DataBar,
  MicroPDF417,
  Industrial2of5,
  Standard2of5,
  LOGMARS,
  MSI,
  Plessey,
  DataMatrix,
  QrCode,
  Field,
  Graphic,
  StoredGraphic,
  Raw,
};
export { Fragment } from "./jsx-runtime.js";
export { mm, inches, dots } from "./units.js";
export { Orientation, ZebraFontFamily } from "./types.js";
export type { ZplElement, ZplNode } from "./jsx-runtime.js";
export type {
  LabelProps,
  DefaultFontProps,
  FieldOrientationProps,
  TextProps,
  BoxProps,
  EllipseProps,
  CircleProps,
  GraphicProps,
  StoredGraphicProps,
  Code11Props,
  Code39Props,
  Code128Props,
  Interleaved2of5Props,
  EAN13Props,
  EAN8Props,
  UpcAProps,
  UpcEProps,
  UpcEanExtensionProps,
  Code93Props,
  CodabarProps,
  PostnetProps,
  PlanetProps,
  IntelligentMailProps,
  GS1DataBarProps,
  MicroPDF417Props,
  Industrial2of5Props,
  Standard2of5Props,
  LOGMARSProps,
  MSIProps,
  PlesseyProps,
  PDF417Props,
  AztecProps,
  MaxiCodeProps,
  DataMatrixProps,
  QrCodeProps,
  FieldProps,
  RawProps,
};
