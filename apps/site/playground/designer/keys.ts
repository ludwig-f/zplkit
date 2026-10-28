import type { TransactionSpec } from "@codemirror/state";
import type { TextChange } from "@zplkit/core/internal";
import type { Rect } from "@zplkit/render/internal";
import { alignMoves, distributeMoves, type Edge } from "./align";
import type { Design } from "./fields";
import { deleteFields, duplicateFields } from "./fields-edit";
import { designerEdit } from "./history";
import { moveFields } from "./move";
import type { Selection } from "./selection";

const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

const EDGES: Edge[] = ["left", "center", "right", "top", "middle", "bottom"];

/** The selected fields' bounds on the selection's label, by key */
const selectedRects = (
  design: Design,
  selection: Selection
): Map<number, Rect> => {
  const rects = new Map<number, Rect>();
  const fields = design.labels[selection.label]?.fields ?? [];
  for (const key of selection.keys) {
    const field = fields.find((f) => f.key === key);
    if (field) rects.set(key, field.bounds);
  }
  return rects;
};

/** Changes for moves that differ per field, grouped so equal moves share a call */
const movesToChanges = (
  design: Design,
  moves: Map<number, { dx: number; dy: number }>
): TextChange[] => {
  const groups = new Map<string, { keys: number[]; dx: number; dy: number }>();
  for (const [key, { dx, dy }] of moves) {
    if (dx === 0 && dy === 0) continue;
    const id = `${dx},${dy}`;
    const group = groups.get(id) ?? { keys: [], dx, dy };
    group.keys.push(key);
    groups.set(id, group);
  }
  return [...groups.values()]
    .flatMap(({ keys, dx, dy }) => moveFields(design, keys, dx, dy))
    .sort((a, b) => a.from - b.from);
};

/**
 * A key on the canvas: arrows nudge 1 dot (shift 10), Delete or Backspace
 * delete, mod+D duplicates, Escape clears; undefined when the key isn't the
 * designer's, or nothing is selected. For a duplicate, `selectAt` is where the copy starts once the
 * edit is applied.
 */
const keyEdit = (
  design: Design,
  selection: Selection,
  { key, shift, mod }: { key: string; shift: boolean; mod: boolean }
):
  | { edit?: TransactionSpec; selection?: Selection; selectAt?: number }
  | undefined => {
  if (selection.keys.length === 0) return undefined;
  if (key === "Escape")
    return { selection: { keys: [], label: selection.label } };

  const arrow = ARROWS[key];
  if (arrow && !mod) {
    const step = shift ? 10 : 1;
    const changes = moveFields(
      design,
      selection.keys,
      arrow.x * step,
      arrow.y * step
    );
    return changes.length > 0 ? { edit: designerEdit(changes, {}) } : undefined;
  }
  if (key === "Delete" || key === "Backspace") {
    const changes = deleteFields(design, selection.keys);
    if (changes.length === 0) return undefined;
    return {
      edit: designerEdit(changes, {}),
      selection: { keys: [], label: selection.label },
    };
  }
  if (mod && key.toLowerCase() === "d") {
    const changes = duplicateFields(design, selection.keys);
    if (changes.length === 0) return undefined;
    return { edit: designerEdit(changes, {}), selectAt: changes[0].from };
  }
  return undefined;
};

/** An align or distribute button on several selected fields */
const alignEdit = (
  design: Design,
  selection: Selection,
  how: Edge | "distribute-x" | "distribute-y"
): TransactionSpec => {
  const rects = selectedRects(design, selection);
  const moves =
    how === "distribute-x"
      ? distributeMoves(rects, "x")
      : how === "distribute-y"
      ? distributeMoves(rects, "y")
      : alignMoves(rects, how);
  return designerEdit(movesToChanges(design, moves), {});
};

/** Which align control matches how the fields already line up, for tinting */
const alignedEdges = (design: Design, selection: Selection): Edge[] => {
  const rects = selectedRects(design, selection);
  if (rects.size < 2) return [];
  return EDGES.filter((edge) =>
    [...alignMoves(rects, edge).values()].every(
      ({ dx, dy }) => dx === 0 && dy === 0
    )
  );
};

export { alignEdit, alignedEdges, keyEdit };
