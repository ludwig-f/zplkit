import { parse } from "./parse.js";

/** Commands that start a field, which runs until ^FS */
const FIELD_STARTS = new Set(["FO", "FT"]);

/** Commands whose spaces at the end are part of their text */
const TEXT_ENDS = new Set(["FD", "FV", "FX"]);

/**
 * Lay out ZPL to read: one field or setting per line, and a blank line
 * between labels. Printers ignore line breaks, so it prints the same labels.
 *
 * @example
 * format("^XA^PW406^FO20,20^A0N,40^FDHi^FS^XZ");
 * // ^XA
 * // ^PW406
 * // ^FO20,20^A0N,40^FDHi^FS
 * // ^XZ
 */
const format = (zpl: string): string => {
  const starts = parse(zpl).commands.flatMap((command) =>
    command.span ? [command.span.start] : []
  );
  if (!starts.length) return zpl;

  // Each command's text runs until the next one, with prefix changes like
  // ^CC kept in the command before them
  const pieces = starts.map((start, index) =>
    zpl.slice(start, starts[index + 1] ?? zpl.length).replace(/[\r\n]/g, "")
  );

  const lines: string[] = [];
  let line = "";
  let key = "";
  let inField = false;

  const endLine = () => {
    if (line) lines.push(TEXT_ENDS.has(key) ? line : line.trimEnd());
    line = "";
  };

  for (const piece of pieces) {
    const next = piece.slice(1, 3).toUpperCase();
    if (inField && (FIELD_STARTS.has(next) || next === "XZ")) {
      endLine();
      inField = false;
    }
    if (next === "XA" && lines.at(-1)?.trimEnd().toUpperCase().endsWith("XZ")) {
      lines.push("");
    }

    line += piece;
    key = next;
    if (FIELD_STARTS.has(next)) inField = true;
    if (next === "FS") inField = false;
    if (!inField) endLine();
  }
  endLine();

  const before = zpl.slice(0, starts[0]).trim();
  return `${before ? `${before}\n` : ""}${lines.join("\n")}\n`;
};

export { format };
