# Visual Designer: Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the viewer's preview editable: hover and select fields, see their ZPL highlighted, drag with snapping guides, nudge, resize with handles, select several and align them, delete and duplicate, and see problems and shared fields on the label. Part 1 of 3; the field popover (part 2) and adding fields and phones (part 3) get their own plans.

**Architecture:** Every decision lives in plain TypeScript modules in `apps/site/playground/designer/`, tested in Node: geometry (dots to screen), the selection model, and the drag and keyboard controllers, which turn input into the engine's `TextChange` lists. A thin React overlay (`DesignOverlay.tsx`) draws outlines, handles, guides and tags over the label images inside `<Bench>`, and sends edits to the editor through a new `apply()` on `EditorHandle`, so canvas edits and typing share one undo history. While a drag is in flight the preview keeps showing the ZPL from before the drag, and the overlay draws the moving field as a cropped image, so dragging never waits for a render.

**Tech Stack:** React 19, Next 16, CodeMirror 6, Vitest (Node), the designer engine on branch `feat/designer-engine`.

**Spec:** `docs/superpowers/specs/2026-10-28-visual-designer-design.md`. **Visual design:** the Claude Design export, unzipped at `/private/tmp/claude-501/-Users-ludde/aeb936e7-881e-490f-8c0d-ccdc1bb508ad/scratchpad/design2/` (read `zplkit Designer.dc.html`, sections 1a, 2a, 3a, 3b, 4b, 6a, 7a; notes in `scratchpad/design2-notes.md`). Treat the export as reference, not code to copy.

## Global Constraints

- The ZPL is the source of truth: every canvas edit is an engine `TextChange` list applied to the editor in one transaction. Never edit the ZPL another way.
- Designing is always on, with no mode switch. A click selects; a drag starts after the pointer moves 3 px.
- Colors: selection and hover use `--zk-view` (teal); snapping guides use `--zk-accent` (cobalt); lint uses `--zk-warn` (amber). Define them in light and dark like the existing tokens in `apps/site/app/global.css`.
- Each edit is one undo step: a drag uses one `designerEdit` drag id from pointer down to pointer up; a nudge, an alignment, a delete or a duplicate is its own step.
- Dragging must stay smooth on a 4 × 6 in label at 300 dpi: no render and no `designFor()` call per pointer move.
- No em dashes in copy. Don't name other ZPL renderers or designers.
- Checks before every commit, with `set -o pipefail`: `pnpm -s -r --filter "./packages/*" build`, `pnpm -r test`, `pnpm -s format:check`, `pnpm -s lint`, `pnpm -s commands --check`, `(cd apps/site && pnpm -s typecheck)`.
- Commits signed: `HUSKY=0 git -c user.email=ludwig@fingal.dev commit -S`, scope `feat(site)` (or the package's scope).
- UI tasks end with a controller check in the browser (the implementer can't open one): the controller follows the task's "Check in the browser" list on the dev server at http://127.0.0.1:5181/viewer before the task is complete.

## Review Focus

- **The editor and the canvas stay one document:** after a drag, typing, undo and redo must leave the editor text, the rendered label and the overlay agreeing. Test in Task 3 (apply keeps the history) and checked in Task 6.
- **Labels in millimeters, upside down or mirrored:** the overlay's outlines and drags follow what's on screen. Tests in Task 2 (geometry) and Task 5 (drag).
- **Several labels shown:** clicking a field on label 3 selects it there, and shared fields show twins on the other labels. Tests in Task 4.
- **A field that isn't drawn yet, or has no ink:** it can still be hovered, selected and dragged. Test in Task 4.
- **Fast typing during a selection:** the selection follows the field by key as the ZPL changes, and drops cleanly when the field is gone. Test in Task 4.

---

### Task 1: Engine follow-ups

**Files:**
- Modify: `apps/site/playground/designer/fields-edit.ts`, `apps/site/playground/designer/fields.ts`
- Test: `apps/site/playground/designer/fields-edit.test.ts`, `apps/site/playground/designer/fields.test.ts`

**Interfaces:**
- Produces: `fieldAt(label: DesignLabel, x: number, y: number, under?: DesignField): DesignField | undefined`, where `under` returns the next field below that one at the point (for Alt-click), or the topmost again when `under` is the lowest.

- [ ] **Step 1: Write the failing tests:**
  - `"deletes a barcode command zplkit doesn't model with its field"`: in `^XA^FO10,10^B4N,20^FDAB^FS^FO10,60^A0N,30^FDx^FS^XZ` (^B4 parses as Raw), deleting the first field gives `^XA^FO10,60^A0N,30^FDx^FS^XZ`. Raw commands whose code is `^B` followed by a letter or digit, other than `^BY`, are field-scoped.
  - `"Alt-click selects what's underneath"`: for two overlapping boxes, `fieldAt(label, 60, 60, top)` returns the lower one, and passing the lower one returns the top one again.
- [ ] **Step 2: Run them to see them fail:** `cd apps/site && pnpm -s vitest --run playground/designer/fields-edit.test.ts playground/designer/fields.test.ts`
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run them to see them pass.**
- [ ] **Step 5: Commit** `fix(site): designer deletes unmodeled barcodes with their field, and finds fields underneath`

---

### Task 2: Geometry between dots and the screen

**Files:**
- Create: `apps/site/playground/designer/geometry.ts`
- Test: `apps/site/playground/designer/geometry.test.ts`

**Interfaces:**
- Consumes: `Rect` from `@zplkit/render/internal`.
- Produces:

```ts
/** Where a label image is on screen, in px, and its size in dots */
type LabelBox = { left: number; top: number; width: number; height: number; dotsWide: number; dotsHigh: number };
/** A rect in dots on a label, as px in the overlay */
toScreen(box: LabelBox, rect: Rect): Rect
/** A point in px in the overlay, as dots on the label (not clamped) */
toDots(box: LabelBox, x: number, y: number): { x: number; y: number }
/** A distance in px, as dots */
pxToDots(box: LabelBox, px: number): number
/** The label box under a point, by index, or undefined */
labelAt(boxes: LabelBox[], x: number, y: number): number | undefined
```

Bounds from the engine are already in the final image's dots (centered, turned and mirrored), so the mapping is a plain scale: `px = left + dots * width / dotsWide`.

- [ ] **Step 1: Write the failing tests:** a 400 × 200 dot label shown at 200 × 100 px from (10, 20) maps `{ x: 100, y: 50, width: 40, height: 20 }` to `{ x: 60, y: 45, width: 20, height: 10 }`; `toDots` inverts it; `pxToDots(box, 3)` is 6; `labelAt` picks the second of two stacked boxes for a point inside it and undefined for a point in the gap.
- [ ] **Step 2–4:** fail, implement, pass (`playground/designer/geometry.test.ts`).
- [ ] **Step 5: Commit** `feat(site): designer maps dots to the screen`

---

### Task 3: The editor applies designer edits and highlights fields

**Files:**
- Create: `apps/site/playground/designer/highlight.ts`
- Modify: `apps/site/playground/Editor.tsx`, `apps/site/playground/styles.css`
- Test: `apps/site/playground/designer/highlight.test.ts`

**Interfaces:**
- Consumes: `designerEdit(changes, { drag?, selection? })`, `designerHistory()` (engine).
- Produces:

```ts
// highlight.ts
type Highlight = { selected: { from: number; to: number }[]; hovered: { from: number; to: number }[] };
/** The extension that draws highlighted lines: a teal gutter bar and tint for selected, a lighter tint for hovered */
highlightField(): Extension
/** An effect setting what's highlighted */
setHighlight: StateEffectType<Highlight>

// Editor.tsx, EditorHandle gains:
apply: (spec: TransactionSpec) => void  // dispatches as is, keeping the selection and history
highlight: (highlight: Highlight) => void
// EditorProps gains:
onCursor?: (offset: number) => void  // after a selection change made by the person (userEvent "select" or a click), not by apply()
```

Highlighting marks whole lines that a range touches: a `--zk-view` bar in a new gutter and a `--zk-view-soft` line background for selected, a fainter background for hovered; the selected lines' numbers turn teal. The `[value]` sync effect stays for outside changes (templates, files); `apply()` is how designer edits arrive, so `value` already matches when the parent re-renders.

- [ ] **Step 1: Write the failing tests** with `EditorState` (no DOM): setting a highlight with a selected range on line 2 of a three-line doc decorates exactly line 2 as selected; a range spanning lines 2 and 3 decorates both; mapping through a later edit that inserts a line above keeps the highlight on the same text; an empty highlight clears it.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Wire `Editor.tsx`:** add `highlightField()` to the ZPL language's extensions only; implement `apply`, `highlight` and `onCursor`. Add a test in `history.test.ts` style that a transaction made with `designerEdit` and dispatched through a state (as `apply` does) keeps one undo step for a two-step drag; that is the contract `apply` must keep.
- [ ] **Step 6: Commit** `feat(site): editor applies designer edits and highlights a field's lines`
- [ ] **Check in the browser (controller):** typing, undo and redo still behave in the viewer and the playground; the playground's TypeScript editor shows no highlight gutter.

---

### Task 4: The selection model

**Files:**
- Create: `apps/site/playground/designer/selection.ts`
- Test: `apps/site/playground/designer/selection.test.ts`

**Interfaces:**
- Consumes: `Design`, `DesignField`, `fieldAt`, `fieldsIn`, `fieldAtOffset`, `spansOf`, `labelsSharing` (engine).
- Produces:

```ts
type Selection = { keys: number[]; label: number };  // keys in selection order; label the selection was made on
type Hover = { key: number; label: number } | undefined;

/** Click at a point on a label: select the field there (shift adds or removes it; alt picks the one underneath), or clear on empty space */
clickAt(design: Design, selection: Selection, label: number, x: number, y: number, mods: { shift: boolean; alt: boolean }): Selection
/** A selection box on a label */
selectIn(design: Design, label: number, rect: Rect, add: boolean, selection: Selection): Selection
/** The editor's cursor moved: select the field there, or keep the selection if the cursor is outside every field */
selectAtOffset(design: Design, offset: number, selection: Selection): Selection
/** After the ZPL changed: keep keys that still exist (a key shifts with inserted or removed commands before it, so follow fields by their position command's text offset, see below) */
carry(previous: Design, next: Design, selection: Selection, changes?: ChangeSet): Selection
/** The text ranges to highlight for a selection or hover */
highlightOf(design: Design, selection: Selection, hover: Hover): Highlight
/** Twins: the same fields on the other labels shown, to draw dashed */
twinsOf(design: Design, selection: Selection): { label: number; field: DesignField }[]
```

`carry` maps each selected key to the offset of its first command in the previous design, maps that offset through the edit (through `changes`, the CodeMirror `ChangeSet` of the edit, when given; without it, keys are kept only when the field at that key still starts at the same text), and picks the field starting there in the next design.

- [ ] **Step 1: Write the failing tests:**
  - clicking a field selects it; shift-click adds a second; shift-click on a selected field removes it; clicking empty space clears; alt-click selects the field underneath.
  - selecting on label 3 of `^XA^FO0,0^A0N,30^SN001,1,Y^FS^PQ3^XZ` keeps `label: 2` and `twinsOf` returns the field on labels 0 and 1 (Review Focus).
  - a placeholder field (`^B4`) and an empty field (`^FD^FS`) can be selected by clicking their position (Review Focus).
  - `selectAtOffset` with the cursor inside `^FD` of the second field selects it; a cursor on `^XA` keeps the selection.
  - `carry` after inserting a new field before the selected one (its key shifts by the inserted commands) still selects it; after deleting it, the selection is empty (Review Focus).
  - `highlightOf` returns the selected field's `spansOf` as selected and the hovered one's as hovered.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Commit** `feat(site): designer selection follows clicks, the cursor and edits`

---

### Task 5: Drag, nudge and keyboard controllers

**Files:**
- Create: `apps/site/playground/designer/drag.ts`, `apps/site/playground/designer/keys.ts`
- Test: `apps/site/playground/designer/drag.test.ts`, `apps/site/playground/designer/keys.test.ts`

**Interfaces:**
- Consumes: `moveFields`, `snapMove`, `resizeField`, `resizeHandles`, `alignMoves`, `distributeMoves`, `deleteFields`, `duplicateFields`, `canRemove`, `designerEdit` (engine); `Selection` (Task 4).

```ts
// drag.ts
type DragKind = { kind: "move" } | { kind: "resize"; handle: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" } | { kind: "box" };
/** Start a drag on a label at a point in dots; the design is the one before the drag, kept for the whole drag */
startDrag(design: Design, selection: Selection, label: number, at: { x: number; y: number }, kind: DragKind): Drag
type Drag = {
  /** The pointer moved: whether the 3 px threshold is passed, the snapped distance, guides, and the edit to apply now (empty below the threshold) */
  moveTo(at: { x: number; y: number }, opts: { snap: boolean; pxToDots: number }): {
    started: boolean; dx: number; dy: number; guides: Guide[];
    readout: string; // e.g. "^FO351,648" for a move, "^GB120,60" for a box resize
    edit: TransactionSpec | undefined; // designerEdit(changes, { drag: id, selection }) relative to the text before the drag
  };
  /** The final edit is the last moveTo's; a drag that never started is a click */
  started(): boolean;
};
```

Every `edit` replaces the previous one's effect: build its changes against the design from before the drag and invert the previous step's changes first (CodeMirror `ChangeSet.invert`), or simpler, keep the drag's previous changes and dispatch `changes: previous.inverted.compose(next)`; the test pins the result, not the method. The 3 px threshold uses `pxToDots` so it's 3 screen px at any zoom. `snap` false is Alt. A move snaps the union of the selected fields' bounds against the other fields on the same label and the label; a resize doesn't snap.

```ts
// keys.ts
/** A key on the canvas: arrows nudge 1 dot (shift 10), Delete or Backspace delete, mod+D duplicates, Escape clears; undefined when the key isn't the designer's */
keyEdit(design: Design, selection: Selection, key: { key: string; shift: boolean; mod: boolean }): { edit?: TransactionSpec; selection?: Selection } | undefined
/** An align or distribute button on several selected fields */
alignEdit(design: Design, selection: Selection, how: Edge | "distribute-x" | "distribute-y"): TransactionSpec
/** Which align control matches how the fields already line up, for tinting */
alignedEdges(design: Design, selection: Selection): Edge[]
```

- [ ] **Step 1: Write the failing tests:**
  - a move drag below 3 px returns `started: false` and no edit; past it, the edit applied to the original text moves `^FO20,30` by the snapped distance; five moves then applying each step's edit in turn leaves the text as one move from the original; the readout is the `^FO` it writes.
  - snapping: a field dragged to within 4 dots of another's left edge snaps, and `snap: false` doesn't.
  - Review Focus: on `^XA^MUM` at 8 dpmm the readout and the text are in millimeters; on `^POI` dragging right writes a smaller x.
  - a resize drag on a box's `se` handle writes `^GB` with the new size; on `nw` it also moves the `^FO`.
  - keys: ArrowRight nudges by 1, Shift+ArrowRight by 10, Delete removes the field (and returns an empty selection), mod+D duplicates and selects the copy, Escape clears the selection; `keyEdit` returns undefined for "a".
  - `alignEdit(…, "left")` on three fields at x 10, 30, 50 moves the second and third to 10 in one edit; `alignedEdges` returns `["left"]` for fields already sharing a left edge.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Commit** `feat(site): designer drags, nudges and aligns fields`

---

### Task 6: The overlay on the bench

**Files:**
- Create: `apps/site/playground/designer/DesignOverlay.tsx`, `apps/site/playground/designer/overlay.css`
- Modify: `apps/site/playground/Bench.tsx` (accept an `overlay` render prop that gets the label boxes; stop drawing its crosshair guides while the overlay has a selection or a drag), `apps/site/playground/Viewer.tsx`
- No unit tests (DOM); the logic is in Tasks 2, 4 and 5.

**Interfaces:**
- Consumes: everything above. `Viewer.tsx` computes `designFor(zpl, { widthMm, heightMm, dpmm, fonts, font0, limit: PREVIEW_LABELS })` with `useMemo`, keeps `Selection` and `Hover` in state, carries the selection on each ZPL change (Task 4), and passes the editor's `apply` and `highlight`.
- Behavior, from design sections 1a, 2a, 3a, 3b, 4b, 6a and 7a:
  - Hover: a thin dashed `--zk-view` outline; the field's lines get the hover tint in the editor.
  - Selected: a solid `--zk-view` outline 3 dots outside the field's bounds, handles only where `resizeHandles` allows (eight for corners, four for proportional, top and bottom for a barcode's height), and a tag above it with its kind and line (`Text · L12`).
  - Several selected: each with an outline and no handles, and a floating bar above the group with align left, center, right, top, middle, bottom and distribute; the control matching `alignedEdges` is tinted.
  - Shared fields: dashed twins on the other labels; the tag says `Shared by 3 labels` or `Shared by 5 copies`.
  - Lint: an amber dashed outline and the gutter's diamond on every field with a problem, selected or not (map problems to fields with `fieldAtOffset` on the problem's start).
  - Not drawn: a hatched outline with the command name (`^BF · not drawn`).
  - Drag: on pointer down on a field, start a move (on a handle, a resize; on empty space, a selection box); on move, apply the step's edit through `editor.apply` and show the readout (dark, next to the field: the `^FO` it writes, then the position in the View unit) and the named cobalt guides; Alt skips snapping. The moving fields are drawn by cropping their bounds from the label image at drag start and translating the crop; the preview gets the ZPL from before the drag until pointer up (Viewer passes `previewZpl` frozen while `dragging`), then renders once.
  - Keyboard: the overlay is focusable (`tabIndex={0}`, an `aria-label` naming the selection) and routes keys through `keyEdit`; clicking a field focuses it.
  - Clicking empty space clears the selection; right-click on empty space copies the `^FO` for that spot (the full menu is part 3), and the status bar says "Right-click for ^FO308,328" instead of today's "Click to copy".
  - Ruler marks: the selected field's extent on both rulers.
- [ ] **Step 1: Build the overlay and wire it** following the behavior above and the design's sizes. Keep `DesignOverlay.tsx` to rendering and event plumbing; any decision goes back into Tasks 2, 4 or 5's modules with a test.
- [ ] **Step 2: Run all checks and commit** `feat(site): designer overlay: select, drag, resize and align on the label`
- [ ] **Check in the browser (controller):**
  - Shipping label template: hover, click, shift-click, a selection box; the editor highlights the right lines; the cursor on a line selects its field.
  - Drag a text field: guides at the label center and other fields' edges, Alt skips them, the editor's `^FO` updates live, one undo puts it back, redo moves it again; the drag stays smooth on 4 × 6 at 300 dpi.
  - Resize a box from a corner; arrows and Shift+arrows nudge; Delete and mod+D; Escape.
  - Three fields: align left, distribute.
  - Numbered boxes template: selecting on label 2 shows twins and "Shared by 6 copies" (or the count shown).
  - A label with `^POI`, one with `^MUM`, one with a `^B4` placeholder and one with a lint problem (amber outline).
  - Typing in the editor while a field is selected keeps the selection on that field.
  - Dark mode.

---

## Later plans

- **Part 2, the field popover:** options per kind (text, Code 128, QR, box), partly understood notes, the not-understood state with raw ZPL, contents of stored-format fields (`^FN` on that label).
- **Part 3, adding and phones:** the right-click menu and Add button with a placeholder, paste and copy, the template text from the design (`^A0N,30,30^FDTEXT`), phones (tap, nudge bar, options sheet, Show on label), docs for the designer.
