import { parse } from "@zplkit/core";
import { editParameters } from "@zplkit/core/internal";
import type { TextChange } from "@zplkit/core/internal";
import type { DesignField } from "@zplkit/render/internal";
import type { Design } from "./fields";
import { dotsPerUnit, moveFields, round } from "./move";

type NewField = "text" | "code128" | "qr" | "box";

/** How far a duplicate sits from its original, in dots */
const DUPLICATE_OFFSET = 10;

/** The ZPL of each new field, with `^` for the command prefix */
const templates: Record<NewField, (x: number, y: number) => string> = {
  text: (x, y) => `^FO${x},${y}^A0N,30^FDText^FS`,
  code128: (x, y) => `^FO${x},${y}^BCN,60^FD12345678^FS`,
  qr: (x, y) => `^FO${x},${y}^BQN,2,4^FDQA,https://zplkit.fingal.dev^FS`,
  box: (x, y) => `^FO${x},${y}^GB120,60,3^FS`,
};

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
  const index = design.commands
    .map((command, i) => (command.type === "EndFormat" ? i : -1))
    .filter((i) => i >= 0)[label];
  const start = design.commands[index]?.span?.start;
  if (index === undefined || start === undefined) return undefined;
  return { start, perUnit: dotsPerUnit(design)[index] };
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
  if (!end) return [];
  const prefix = design.zpl.charAt(end.start);
  const zpl = templates[kind](
    round(x / end.perUnit),
    round(y / end.perUnit)
  ).replaceAll("^", prefix);
  return [insertBeforeEnd(design, end.start, zpl)];
};

/** Add pasted field ZPL at a point, moving its ^FO or ^FT there if it has one */
const pasteField = (
  design: Design,
  label: number,
  zpl: string,
  x: number,
  y: number
): TextChange[] => {
  const end = endOf(design, label);
  if (!end) return [];
  let pasted = zpl.trim();
  const origin = parse(pasted).commands.find(
    (c) => c.type === "FieldOrigin" || c.type === "FieldTypeset"
  );
  if (origin) {
    const { from, to, insert } = editParameters(pasted, origin, {
      0: round(x / end.perUnit),
      1: round(y / end.perUnit),
    });
    pasted = pasted.slice(0, from) + insert + pasted.slice(to);
  }
  return [insertBeforeEnd(design, end.start, pasted)];
};

/** Whether deleteFields and duplicateFields can take a field */
const canRemove = (field: DesignField, design: Design): boolean => {
  const first = design.commands[field.commands[0]];
  return (
    (first?.type === "FieldOrigin" || first?.type === "FieldTypeset") &&
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

/** Remove fields, from their ^FO or ^FT to their ^FS */
const deleteFields = (design: Design, keys: number[]): TextChange[] =>
  removable(design, keys).map(({ from, to }) => ({ from, to, insert: "" }));

export type { NewField };
export { addField, canRemove, deleteFields, duplicateFields, pasteField };
