/** The anchor for a category: #barcodes for Barcodes */
export const categoryAnchor = (category: string) =>
  category.toLowerCase().replace(/\s+/g, "-");

/** The anchor for a command: #BC for ^BC, #tilde-CC for ~CC */
export const anchorOf = (code: string) =>
  code.startsWith("~") ? `tilde-${code.slice(1)}` : code.slice(1);
