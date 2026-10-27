/** A one-dimensional barcode before sizing */
type LinearSymbol = {
  /** Widths of alternating bars and spaces in modules, starting with a bar */
  widths: number[];
  /** What the interpretation line prints */
  text: string;
};

export type { LinearSymbol };
