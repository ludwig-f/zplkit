/**
 * The builder method and JSX element that write each command, for links
 * from the command reference to the API reference
 */
const apiFor: Record<string, { method: string; element?: string }> = {
  "^A": { method: "text", element: "Text" },
  "^A@": { method: "text", element: "Text" },
  "^GB": { method: "box", element: "Box" },
  "^GF": { method: "graphic", element: "Graphic" },
  "^XG": { method: "storedGraphic", element: "StoredGraphic" },
  "^CF": { method: "setDefaultFont", element: "DefaultFont" },
  "^FW": { method: "setFieldOrientation", element: "FieldOrientation" },
  "^BC": { method: "code128", element: "Code128" },
  "^B3": { method: "code39", element: "Code39" },
  "^BA": { method: "code93", element: "Code93" },
  "^B1": { method: "code11", element: "Code11" },
  "^BK": { method: "codabar", element: "Codabar" },
  "^BE": { method: "ean13", element: "EAN13" },
  "^B8": { method: "ean8", element: "EAN8" },
  "^BU": { method: "upcA", element: "UpcA" },
  "^B9": { method: "upcE", element: "UpcE" },
  "^BS": { method: "upcEanExtension", element: "UpcEanExtension" },
  "^B2": { method: "interleaved2of5", element: "Interleaved2of5" },
  "^BI": { method: "industrial2of5", element: "Industrial2of5" },
  "^BJ": { method: "standard2of5", element: "Standard2of5" },
  "^BL": { method: "logmars", element: "LOGMARS" },
  "^BM": { method: "msi", element: "MSI" },
  "^BP": { method: "plessey", element: "Plessey" },
  "^BZ": { method: "postnet", element: "Postnet" },
  "^B5": { method: "planet", element: "Planet" },
  "^BR": { method: "gs1DataBar", element: "GS1DataBar" },
  "^B7": { method: "pdf417", element: "PDF417" },
  "^BF": { method: "microPdf417", element: "MicroPDF417" },
  "^BQ": { method: "qrCode", element: "QrCode" },
  "^BX": { method: "dataMatrix", element: "DataMatrix" },
  "^BO": { method: "aztec", element: "Aztec" },
  "^B0": { method: "aztec", element: "Aztec" },
  "^BD": { method: "maxiCode", element: "MaxiCode" },
};

export { apiFor };
