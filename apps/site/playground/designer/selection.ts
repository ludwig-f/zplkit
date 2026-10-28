import type { ChangeSet } from "@codemirror/state";
import type { DesignField, Rect } from "@zplkit/render/internal";
import {
  fieldAt,
  fieldAtOffset,
  fieldsIn,
  spansOf,
  type Design,
} from "./fields";
import type { Highlight } from "./highlight";

/** The selected fields' keys in selection order, and the label they were picked on */
type Selection = { keys: number[]; label: number };

/** The field under the pointer, and the label it's on */
type Hover = { key: number; label: number } | undefined;

/** The first label that prints a field, preferring `label` */
const labelWith = (design: Design, key: number, label: number): number =>
  design.labels[label]?.fields.some((f) => f.key === key)
    ? label
    : design.labels.findIndex((l) => l.fields.some((f) => f.key === key));

/** Click at a point on a label: select the field there (shift adds or removes it; alt picks the one underneath), or clear on empty space */
const clickAt = (
  design: Design,
  selection: Selection,
  label: number,
  x: number,
  y: number,
  mods: { shift: boolean; alt: boolean }
): Selection => {
  const at = design.labels[label];
  let reference: DesignField | undefined;
  if (at && mods.alt) {
    // The topmost selected field among those under the pointer
    const top = fieldAt(at, x, y);
    let hit = top;
    while (hit && !reference) {
      if (selection.keys.includes(hit.key)) reference = hit;
      else {
        hit = fieldAt(at, x, y, hit);
        if (hit === top) break;
      }
    }
  }
  const field = at ? fieldAt(at, x, y, reference) : undefined;
  if (!field) return mods.shift ? selection : { keys: [], label };
  if (!mods.shift) return { keys: [field.key], label };
  return selection.keys.includes(field.key)
    ? { keys: selection.keys.filter((key) => key !== field.key), label }
    : { keys: [...selection.keys, field.key], label };
};

/** A selection box on a label */
const selectIn = (
  design: Design,
  label: number,
  rect: Rect,
  add: boolean,
  selection: Selection
): Selection => {
  const inside = design.labels[label]
    ? fieldsIn(design.labels[label], rect).map((f) => f.key)
    : [];
  const kept = add ? selection.keys : [];
  return {
    keys: [...kept, ...inside.filter((key) => !kept.includes(key))],
    label,
  };
};

/** The editor's cursor moved: select the field there, or keep the selection if the cursor is outside every field */
const selectAtOffset = (
  design: Design,
  offset: number,
  selection: Selection
): Selection => {
  const field = fieldAtOffset(design, offset);
  if (!field || selection.keys.includes(field.key)) return selection;
  const label = labelWith(design, field.key, selection.label);
  return { keys: [field.key], label: label < 0 ? selection.label : label };
};

/**
 * After the ZPL changed: keep the fields that still exist. A key shifts with
 * commands inserted or removed before it, so fields are followed by where
 * their first command starts in the text.
 */
const carry = (
  previous: Design,
  next: Design,
  selection: Selection,
  changes?: ChangeSet
): Selection => {
  const keys: number[] = [];
  for (const key of selection.keys) {
    const span = previous.commands[key]?.span;
    if (!span) continue;
    let start = span.start;
    if (changes) {
      // The edit removed the first command when nothing of it is left
      start = changes.mapPos(span.start, 1);
      if (changes.mapPos(span.end, -1) <= start) continue;
    }
    const index = next.commands.findIndex((c) => c.span?.start === start);
    const found = next.commands[index]?.span;
    if (
      !found ||
      (!changes &&
        next.zpl.slice(found.start, found.end) !==
          previous.zpl.slice(span.start, span.end))
    )
      continue;
    if (labelWith(next, index, selection.label) >= 0 && !keys.includes(index))
      keys.push(index);
  }
  const label = keys.length ? labelWith(next, keys[0], selection.label) : -1;
  return { keys, label: label < 0 ? selection.label : label };
};

/** The field with a key on a label */
const fieldOn = (design: Design, key: number, label: number) =>
  design.labels[label]?.fields.find((f) => f.key === key);

/** The text ranges to highlight for a selection or hover */
const highlightOf = (
  design: Design,
  selection: Selection,
  hover: Hover
): Highlight => {
  const spans = (key: number, label: number) => {
    const field =
      fieldOn(design, key, label) ??
      fieldOn(design, key, labelWith(design, key, label));
    return field ? spansOf(design, field) : [];
  };
  return {
    selected: selection.keys.flatMap((key) => spans(key, selection.label)),
    hovered: hover ? spans(hover.key, hover.label) : [],
  };
};

/** Twins: the same fields on the other labels shown, to draw dashed */
const twinsOf = (
  design: Design,
  selection: Selection
): { label: number; field: DesignField }[] =>
  design.labels.flatMap((label, index) =>
    index === selection.label
      ? []
      : label.fields
          .filter((field) => selection.keys.includes(field.key))
          .map((field) => ({ label: index, field }))
  );

export type { Hover, Selection };
export { carry, clickAt, highlightOf, selectAtOffset, selectIn, twinsOf };
