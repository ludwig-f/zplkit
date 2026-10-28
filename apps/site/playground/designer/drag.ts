import { ChangeSet, Text, type TransactionSpec } from "@codemirror/state";
import type { Command } from "@zplkit/core";
import type { TextChange } from "@zplkit/core/internal";
import type { DesignField, Rect } from "@zplkit/render/internal";
import type { Design } from "./fields";
import { designerEdit } from "./history";
import { moveFields } from "./move";
import { resizeField, resizeHandles } from "./resize";
import type { Selection } from "./selection";
import { snapMove, type Guide } from "./snap";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragKind =
  | { kind: "move" }
  | { kind: "resize"; handle: Handle }
  | { kind: "box" };

type Step = {
  started: boolean;
  dx: number;
  dy: number;
  guides: Guide[];
  readout: string;
  /** The first selected field's bounds after this step, in dots, to draw it while the label isn't redrawn */
  bounds?: Rect;
  edit: TransactionSpec | undefined;
};

type Drag = {
  /** The pointer moved: whether the 3 px threshold is passed, the snapped distance, guides, and the edit to apply now (empty below the threshold) */
  moveTo: (
    at: { x: number; y: number },
    opts: { snap: boolean; pxToDots: number }
  ) => Step;
  /** Whether the pointer moved past the threshold; a drag that never started is a click */
  started: () => boolean;
};

/** How far the pointer moves before a drag starts, in screen px */
const THRESHOLD = 3;

/** The next drag's id, so each drag is one undo step */
let nextDrag = 1;

/** The commands that set a field's size, for the resize readout */
const SIZE_COMMANDS = new Set<Command["type"]>([
  "GraphicBox",
  "GraphicEllipse",
  "GraphicDiagonal",
  "GraphicCircle",
  "Font",
  "Code128",
  "QrCode",
]);

/** A command's text once the changes inside it are applied */
const textOf = (design: Design, index: number, changes: TextChange[]) => {
  const span = design.commands[index]?.span;
  if (!span) return "";
  let text = design.zpl.slice(span.start, span.end);
  const inside = changes
    .filter((c) => c.from >= span.start && c.to <= span.end)
    .sort((a, b) => b.from - a.from);
  for (const c of inside) {
    text =
      text.slice(0, c.from - span.start) +
      c.insert +
      text.slice(c.to - span.start);
  }
  return text;
};

/** The ^FO or ^FT a move writes for a field, including one it adds */
const moveReadout = (
  design: Design,
  field: DesignField | undefined,
  changes: TextChange[]
): string => {
  const index = field?.commands[0];
  const span = index === undefined ? undefined : design.commands[index]?.span;
  if (index === undefined || !span) return "";
  const added = changes.find(
    (c) => c.from === span.start && c.to === span.start
  );
  return added ? added.insert : textOf(design, index, changes);
};

/** The size command a resize writes for a field */
const resizeReadout = (
  design: Design,
  field: DesignField | undefined,
  changes: TextChange[]
): string => {
  const indices = field?.commands.slice(1) ?? [];
  const index =
    indices.find((i) => {
      const span = design.commands[i]?.span;
      return (
        span && changes.some((c) => c.from >= span.start && c.to <= span.end)
      );
    }) ?? indices.find((i) => SIZE_COMMANDS.has(design.commands[i]?.type));
  return index === undefined ? "" : textOf(design, index, changes);
};

/** The union of rects */
const union = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
};

/** A field's bounds dragged by a handle, keeping the opposite side (and the shape, when `keep`); a field with no size, like empty text, keeps its bounds */
const resized = (
  old: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  keep: boolean
): Rect => {
  if (!old.width || !old.height) return old;
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  let width = old.width + (east ? dx : west ? -dx : 0);
  let height = old.height + (south ? dy : north ? -dy : 0);
  width = Math.max(width, 1);
  height = Math.max(height, 1);
  if (keep) {
    // Scale by the axis the handle moves, the larger one at a corner
    const wide = east || west ? width / old.width : 0;
    const high = south || north ? height / old.height : 0;
    const scale = Math.max(wide, high);
    width = old.width * scale;
    height = old.height * scale;
  }
  const x = west ? old.x + old.width - width : old.x;
  const y = north ? old.y + old.height - height : old.y;
  return { x, y, width, height };
};

/**
 * Start a drag on a label at a point in dots. The design is the one before
 * the drag, kept for the whole drag, so every step's edit is relative to the
 * text before the drag and replaces the previous step's.
 */
const startDrag = (
  design: Design,
  selection: Selection,
  label: number,
  at: { x: number; y: number },
  kind: DragKind
): Drag => {
  const id = nextDrag++;
  const fields = design.labels[label]?.fields ?? [];
  const selected = fields.filter((f) => selection.keys.includes(f.key));
  const others = fields
    .filter((f) => !selection.keys.includes(f.key))
    .map((f) => f.bounds);
  const original = Text.of(design.zpl.split("\n"));
  const length = design.zpl.length;
  let started = false;
  /** Undoes the previous step's changes */
  let inverted: ChangeSet | undefined;

  const moveTo: Drag["moveTo"] = (to, opts) => {
    let dx = Math.round(to.x - at.x);
    let dy = Math.round(to.y - at.y);
    if (
      !started &&
      Math.hypot(to.x - at.x, to.y - at.y) >= THRESHOLD * opts.pxToDots
    ) {
      started = true;
    }
    if (!started) {
      return {
        started,
        dx: 0,
        dy: 0,
        guides: [],
        readout: "",
        edit: undefined,
      };
    }

    let guides: Guide[] = [];
    let changes: TextChange[] = [];
    let readout = "";
    let bounds: Rect | undefined;
    if (kind.kind === "move" && selected.length > 0) {
      if (opts.snap) {
        const snapped = snapMove(
          union(selected.map((f) => f.bounds)),
          dx,
          dy,
          others,
          design.labels[label]
        );
        ({ dx, dy, guides } = snapped);
      }
      changes = moveFields(design, selection.keys, dx, dy);
      readout = moveReadout(design, selected[0], changes);
      const { x, y, width, height } = selected[0].bounds;
      bounds = { x: x + dx, y: y + dy, width, height };
    } else if (kind.kind === "resize" && selected.length > 0) {
      const [field] = selected;
      const handles = resizeHandles(design, field);
      if (handles !== "none") {
        bounds = resized(
          field.bounds,
          kind.handle,
          dx,
          dy,
          handles === "proportional"
        );
        changes = resizeField(design, field.key, bounds);
        readout = resizeReadout(design, field, changes);
      }
    } else if (kind.kind === "box") {
      return { started, dx, dy, guides, readout, edit: undefined };
    }

    // Replace the previous step: undo it, then make this one
    const next = ChangeSet.of(changes, length);
    const composed = inverted ? inverted.compose(next) : next;
    inverted = next.invert(original);
    const edit: TransactionSpec = {
      ...designerEdit([], { drag: id }),
      changes: composed,
    };
    return { started, dx, dy, guides, readout, bounds, edit };
  };

  return { moveTo, started: () => started };
};

export { startDrag };
export type { Drag, DragKind, Handle };
