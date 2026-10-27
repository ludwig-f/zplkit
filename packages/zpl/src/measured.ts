import type { Command } from "./ast.js";

/**
 * The parameters ^MU converts from millimeters or inches to dots, for each
 * command. Others, like ^BX's module size and ^FB's width and line spacing,
 * stay in dots. Measured from reference renders.
 */
const measuredFields: { readonly [T in Command["type"]]?: readonly string[] } =
  {
    PrintWidth: ["width"],
    LabelHome: ["x", "y"],
    LabelShift: ["shift"],
    LabelTop: ["offset"],
    FieldOrigin: ["x", "y"],
    FieldTypeset: ["x", "y"],
    DefaultFont: ["height", "width"],
    Font: ["height", "width"],
    FontByName: ["height", "width"],
    GraphicBox: ["width", "height", "thickness"],
    GraphicCircle: ["diameter", "thickness"],
    GraphicEllipse: ["width", "height", "thickness"],
    GraphicDiagonal: ["width", "height", "thickness"],
    GraphicSymbol: ["height", "width"],
    BarcodeDefaults: ["moduleWidth", "height"],
    Code11: ["height"],
    Code128: ["height"],
    Code39: ["height"],
    Code93: ["height"],
    Codabar: ["height"],
    Interleaved2of5: ["height"],
    Industrial2of5: ["height"],
    Standard2of5: ["height"],
    Logmars: ["height"],
    Msi: ["height"],
    Plessey: ["height"],
    Ean13: ["height"],
    Ean8: ["height"],
    UpcA: ["height"],
    UpcE: ["height"],
    UpcEanExtension: ["height"],
    PostalCode: ["height"],
    Planet: ["height"],
  };

export { measuredFields };
