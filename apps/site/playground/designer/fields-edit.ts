import { parse } from "@zplkit/core";
import { changesDelimiter, editParameters } from "@zplkit/core/internal";
import type { Command } from "@zplkit/core";
import type { TextChange } from "@zplkit/core/internal";
import type { DesignField } from "@zplkit/render/internal";
import type { Design } from "./fields";
import { dotsPerUnit, inUnits, moveFields } from "./move";

type NewField = "text" | "code128" | "qr" | "box";

/** How far a duplicate sits from its original, in dots */
const DUPLICATE_OFFSET = 10;

/**
 * The ZPL of each new field, with `^` for the command prefix. `size` writes
 * a size in dots in the label's ^MU units; ^BQ's magnification isn't one.
 */
const templates: Record<
  NewField,
  (x: number, y: number, size: (dots: number) => number) => string
> = {
  text: (x, y, size) => `^FO${x},${y}^A0N,${size(30)}^FDText^FS`,
  code128: (x, y, size) => `^FO${x},${y}^BCN,${size(60)}^FD12345678^FS`,
  qr: (x, y) => `^FO${x},${y}^BQN,2,4^FDQA,https://zplkit.fingal.dev^FS`,
  box: (x, y, size) => `^FO${x},${y}^GB${size(120)},${size(60)},${size(3)}^FS`,
};

/**
 * The commands whose effect ends with their field, which deleting it
 * removes. Others, like ^BY and ^CF, set what later fields use, and
 * commands zplkit doesn't model may too, so they stay.
 */
const FIELD_SCOPED = new Set<Command["type"]>([
  "FieldOrigin",
  "FieldTypeset",
  "Font",
  "FontByName",
  "FieldData",
  "FieldSeparator",
  // Drawing
  "GraphicBox",
  "GraphicCircle",
  "GraphicEllipse",
  "GraphicDiagonal",
  "GraphicField",
  "GraphicSymbol",
  "RecallGraphic",
  "ImageMove",
  "Code11",
  "Code128",
  "Code39",
  "Code93",
  "Codabar",
  "Interleaved2of5",
  "Industrial2of5",
  "Standard2of5",
  "Logmars",
  "Msi",
  "Plessey",
  "Ean13",
  "Ean8",
  "UpcA",
  "UpcE",
  "UpcEanExtension",
  "PostalCode",
  "Planet",
  "Gs1DataBar",
  "Pdf417",
  "MicroPdf417",
  "DataMatrix",
  "QrCode",
  "Aztec",
  "MaxiCode",
  // Field modifiers, and ^FX comments inside the field
  "FieldReverse",
  "FieldHexIndicator",
  "FieldBlock",
  "TextBlock",
  "FieldParameter",
  "SerialNumber",
  "SerializationField",
  "FieldNumber",
  "FieldClock",
  "Comment",
]);

/** The first and last character a field's commands take, if it has any */
const rangeOf = (
  design: Design,
  field: DesignField
): { from: number; to: number } | undefined => {
  const spans = field.commands.flatMap((index) => {
    const span = design.commands[index]?.span;
    return span ? [span] : [];
  });
  if (spans.length === 0) return undefined;
  return {
    from: Math.min(...spans.map((s) => s.start)),
    to: Math.max(...spans.map((s) => s.end)),
  };
};

/** Where a label's ^XZ is, and how many dots one of its ^MU units is there */
const endOf = (design: Design, label: number) => {
  const start = design.labels[label]?.start;
  if (start === undefined) return undefined;
  const index = design.commands.findIndex(
    (command, i) => i > start && command.type === "EndFormat"
  );
  const at = design.commands[index]?.span?.start;
  if (at === undefined) return undefined;
  return { start: at, perUnit: dotsPerUnit(design)[index] };
};

/** Put ZPL on its own line before a label's ^XZ, or right before it */
const insertBeforeEnd = (design: Design, start: number, zpl: string) => {
  const ownLine = design.zpl.charAt(start - 1) === "\n";
  return { from: start, to: start, insert: ownLine ? `${zpl}\n` : zpl };
};

/** Add a field at a point on a label, before the label's ^XZ */
const addField = (
  design: Design,
  label: number,
  kind: NewField,
  x: number,
  y: number
): TextChange[] => {
  const end = endOf(design, label);
  if (!end || changesDelimiter(design.zpl)) return [];
  const { perUnit } = end;
  const prefix = design.zpl.charAt(end.start);
  const zpl = templates[kind](
    Math.max(0, inUnits(x, perUnit)),
    Math.max(0, inUnits(y, perUnit)),
    (dots) => inUnits(dots, perUnit)
  ).replaceAll("^", prefix);
  return [insertBeforeEnd(design, end.start, zpl)];
};

/**
 * Add pasted field ZPL at a point, moving its ^FO or ^FT there if it has
 * one. Only the position is converted to the label's ^MU units: the pasted
 * field's sizes stay as the person wrote them. Pastes that would change what
 * follows them, like whole labels or a ^CD, are left out.
 */
const pasteField = (
  design: Design,
  label: number,
  zpl: string,
  x: number,
  y: number
): TextChange[] => {
  const end = endOf(design, label);
  if (!end || changesDelimiter(design.zpl)) return [];
  if (design.zpl.charAt(end.start) !== "^") return [];
  let pasted = zpl.trim();
  // Whole labels, and changed prefixes or delimiters, reach past the field
  if (/[\^~]\s*(X[AZ]|C[CDT])/i.test(pasted)) return [];
  try {
    const origin = parse(pasted).commands.find(
      (c) => c.type === "FieldOrigin" || c.type === "FieldTypeset"
    );
    if (origin) {
      const { from, to, insert } = editParameters(pasted, origin, {
        0: Math.max(0, inUnits(x, end.perUnit)),
        1: Math.max(0, inUnits(y, end.perUnit)),
      });
      pasted = pasted.slice(0, from) + insert + pasted.slice(to);
    }
  } catch {
    return [];
  }
  return [insertBeforeEnd(design, end.start, pasted)];
};

/**
 * Whether deleteFields and duplicateFields can take a field: it starts with
 * ^FO or ^FT, ends with ^FS, and its commands are next to each other
 */
const canRemove = (field: DesignField, design: Design): boolean => {
  const { commands } = field;
  const first = design.commands[commands[0]];
  const last = design.commands[commands[commands.length - 1]];
  return (
    (first?.type === "FieldOrigin" || first?.type === "FieldTypeset") &&
    last?.type === "FieldSeparator" &&
    commands.every((index, i) => index === commands[0] + i) &&
    rangeOf(design, field) !== undefined
  );
};

/** The fields for keys that can be removed, in the order of the ZPL */
const removable = (design: Design, keys: number[]) => {
  const fields = design.labels.flatMap((label) => label.fields);
  return [...new Set(keys)]
    .flatMap((key) => {
      const field = fields.find((f) => f.key === key);
      const range = field && rangeOf(design, field);
      return field && range && canRemove(field, design) ? [range] : [];
    })
    .sort((a, b) => a.from - b.from);
};

/** Copy fields after themselves, 10 dots right and down */
const duplicateFields = (design: Design, keys: number[]): TextChange[] =>
  [...new Set(keys)]
    .flatMap((key) => {
      const [range] = removable(design, [key]);
      if (!range) return [];
      // Move the original's ^FO or ^FT, then take the moved text as the copy
      let copy = design.zpl.slice(range.from, range.to);
      for (const { from, to, insert } of moveFields(
        design,
        [key],
        DUPLICATE_OFFSET,
        DUPLICATE_OFFSET
      )) {
        copy =
          copy.slice(0, from - range.from) +
          insert +
          copy.slice(to - range.from);
      }
      return [{ from: range.to, to: range.to, insert: copy }];
    })
    .sort((a, b) => a.from - b.from);

/**
 * Remove fields: the commands that only make the field, from its ^FO or ^FT
 * to its ^FS. Settings among them that later fields use keep their text.
 */
const deleteFields = (design: Design, keys: number[]): TextChange[] =>
  removable(design, keys).flatMap((range) => {
    const changes: TextChange[] = [];
    // Whether the last command was removed, so this one joins its change
    let joined = false;
    for (const { type, span } of design.commands) {
      if (!span || span.start < range.from || span.end > range.to) continue;
      if (!FIELD_SCOPED.has(type)) {
        joined = false;
      } else if (joined) {
        changes[changes.length - 1].to = span.end;
      } else {
        changes.push({ from: span.start, to: span.end, insert: "" });
        joined = true;
      }
    }
    return changes;
  });

export type { NewField };
export { addField, canRemove, deleteFields, duplicateFields, pasteField };
