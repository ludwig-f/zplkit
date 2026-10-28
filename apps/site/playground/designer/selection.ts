import type { ChangeSet } from "@codemirror/state";
import type { DesignField, Rect } from "@zplkit/render/internal";
import {
  fieldAt,
  fieldAtOffset,
  fieldsIn,
  spansOf,
  type Design,
} from "./fields";
import type { DragKind, Handle } from "./drag";
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
    let index = next.commands.findIndex((c) => c.span?.start === start);
    const found = next.commands[index]?.span;
    if (
      !found ||
      (!changes &&
        next.zpl.slice(found.start, found.end) !==
          previous.zpl.slice(span.start, span.end))
    )
      continue;
    // A command inserted before it, like a ^FO a move adds, starts the field now
    if (labelWith(next, index, selection.label) < 0) {
      index = fieldAtOffset(next, start)?.key ?? -1;
    }
    if (
      index >= 0 &&
      labelWith(next, index, selection.label) >= 0 &&
      !keys.includes(index)
    )
      keys.push(index);
  }
  const label = keys.length ? labelWith(next, keys[0], selection.label) : -1;
  return { keys, label: label < 0 ? selection.label : label };
};

/**
 * The selection once the design follows an edit: carried through it, or the
 * field at `selectAt.offset` (like a duplicate) when the text is the one
 * that edit made. A selectAt for another text, e.g. an edit that changed
 * nothing, is dropped.
 */
const redesigned = (
  previous: Design,
  next: Design,
  selection: Selection,
  options: {
    changes?: ChangeSet;
    selectAt?: { offset: number; zpl: string };
  } = {}
): Selection => {
  const carried = carry(previous, next, selection, options.changes);
  const { selectAt } = options;
  return selectAt && selectAt.zpl === next.zpl
    ? selectAtOffset(next, selectAt.offset, { ...carried, keys: [] })
    : carried;
};

/** Every field under a point on a label, topmost first */
const hitsAt = (
  design: Design,
  label: number,
  x: number,
  y: number
): DesignField[] => {
  const at = design.labels[label];
  const hits: DesignField[] = [];
  let hit = at && fieldAt(at, x, y);
  while (at && hit && !hits.includes(hit)) {
    hits.push(hit);
    hit = fieldAt(at, x, y, hit);
  }
  return hits;
};

/**
 * A press on a label at a point in dots: what it starts and the selection
 * it works on. A handle of the one selected field resizes; empty space draws
 * a selection box; a press over a selected field, even one covered by
 * others, moves the selection, and a press without dragging picks on pointer
 * up (`clickOnUp`). With alt, a press on unselected fields picks on pointer
 * up too, keeping the selection meanwhile; a drag from it moves `moves`, the
 * topmost field, which clickAt would pick. Any other field is picked right
 * away, with shift adding it, and moves.
 */
const pressAt = (
  design: Design,
  selection: Selection,
  label: number,
  at: { x: number; y: number },
  {
    handle,
    shift,
    alt = false,
  }: { handle?: Handle; shift: boolean; alt?: boolean }
): {
  kind: DragKind;
  selection: Selection;
  clickOnUp: boolean;
  /** What a drag moves when it isn't `selection`; selected once the drag starts */
  moves?: Selection;
} => {
  const fields = design.labels[label]?.fields ?? [];
  const selected =
    selection.label === label
      ? fields.filter((f) => selection.keys.includes(f.key))
      : [];
  if (handle && selected.length === 1) {
    return { kind: { kind: "resize", handle }, selection, clickOnUp: false };
  }
  const hits = hitsAt(design, label, at.x, at.y);
  if (!hits.length)
    return { kind: { kind: "box" }, selection, clickOnUp: true };
  if (hits.some((hit) => selected.includes(hit))) {
    return { kind: { kind: "move" }, selection, clickOnUp: true };
  }
  if (alt) {
    const moves = clickAt(design, selection, label, at.x, at.y, {
      shift,
      alt: true,
    });
    return { kind: { kind: "move" }, selection, clickOnUp: true, moves };
  }
  return {
    kind: { kind: "move" },
    selection: clickAt(design, selection, label, at.x, at.y, {
      shift,
      alt: false,
    }),
    clickOnUp: false,
  };
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
export {
  carry,
  clickAt,
  highlightOf,
  pressAt,
  redesigned,
  selectAtOffset,
  selectIn,
  twinsOf,
};
