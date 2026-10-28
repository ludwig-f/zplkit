# Visual Designer Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine under the viewer's visual designer: find each field on the rendered labels and its bounds, map fields to and from their ZPL text, and turn moves, nudges, snapping, alignment and resizing into the smallest text edits, with one undo history. No screens: those wait for the visual design.

**Architecture:** `@zplkit/render` gets an internal `designLabels()` that lays labels out like `renderLabels()` and measures each field's bounds in the final image. `@zplkit/core` gets an internal `editParameters()` that rewrites a command's parameters in place, leaving every other character as written. The designer logic lives in `apps/site/playground/designer/` as pure functions over the ZPL text, returning CodeMirror-shaped changes, plus a history extension that makes each drag one undo step.

**Tech Stack:** TypeScript, Vitest, CodeMirror 6 (`@codemirror/state`, `@codemirror/commands`), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-28-visual-designer-design.md`

## Global Constraints

- The ZPL is the source of truth: every edit is a text change to the ZPL, the smallest that does it. Commands the edit doesn't target keep every character as written.
- Never rewrite what isn't understood.
- New renderer and core functions are internal: exported from `@zplkit/render/internal` and `@zplkit/core/internal`, not the main entry points.
- Don't name other ZPL renderers or designers in code, tests or docs; say "reference renders".
- No em dashes in copy.
- Checks before every commit: `pnpm -s -r --filter "./packages/*" build`, `pnpm -r test`, `pnpm -s format:check`, `pnpm -s lint`, `pnpm -s commands --check`, `(cd apps/site && pnpm -s typecheck)`, run with `set -o pipefail`.
- Commits are signed: `HUSKY=0 git -c user.email=ludwig@fingal.dev commit -S`. One commit per package and conventional scope (`feat(render)`, `feat(core)`, `feat(site)`), so release-please versions each package by its own changes.

## Review Focus

- **Labels in millimeters or inches (`^MU`):** moving a field by 8 dots at 8 dpmm changes `^FO10,5` to `^FO11,5`, not `^FO18,5`. Test in Task 4.
- **Upside-down and mirrored labels (`^POI`, `^PMY`):** dragging right on screen moves the field right on screen, so `^FO` x goes down. Test in Task 4.
- **Fields without `^FO` or `^FT`:** they print at the label home; moving one inserts a `^FO` instead of doing nothing. Test in Task 4.
- **A changed command prefix (`^CC`):** edits keep the label's own prefix, like `#FO`, never writing `^`. Test in Task 2.
- **A field in a stored format (`^DF`) recalled by several labels:** it's one field with one `^FO`; moving it from any label changes that `^FO` once, and it reports how many labels share it. Tests in Tasks 3 and 4.

## Known limits (decided, not tested)

- ZPL that changes the parameter delimiter (`^CD`) is shown but not edited: `editParameters()` throws, and the designer treats those fields as read-only.
- A field clamped at the left edge by `^LS` moves by the same delta as the others; its bounds catch up after the next render.

---

### Task 1: Field bounds from the renderer

**Files:**
- Create: `packages/render/src/design.ts`
- Create: `packages/render/src/internal.ts`
- Modify: `packages/render/src/render.ts` (export `draw` and `justified` to `design.ts`, from the module, not from `index.ts`)
- Modify: `packages/render/package.json` (`exports` gets `"./internal": { "types": "./build/internal.d.ts", "default": "./build/internal.js" }`)
- Test: `packages/render/src/design.test.ts`

**Interfaces:**
- Produces:

```ts
type Rect = { x: number; y: number; width: number; height: number };

type DesignField = {
  /** Index of the field's first command; the same on every label that prints it */
  key: number;
  kind: Element["kind"];
  /** Indices of the commands that make the field, in the parsed command list */
  commands: number[];
  /** Where its ink is, in dots on the rendered image */
  bounds: Rect;
  /** False for placeholders of commands that aren't drawn yet */
  drawn: boolean;
};

type DesignLabel = {
  width: number;
  height: number;
  inverted: boolean;
  mirrored: boolean;
  /** In drawing order, so later fields are on top */
  fields: DesignField[];
};

designLabels(commands: readonly Command[], options: RenderOptions): DesignLabel[]
```

Exported from `packages/render/src/internal.ts` as `export { designLabels } from "./design.js"; export type { DesignField, DesignLabel, Rect } from "./design.js";`, with the same "not part of the public API" comment as `packages/zpl/src/internal.ts`.

- [ ] **Step 1: Write the failing tests** in `packages/render/src/design.test.ts`, each rendering with `{ widthMm: 50, heightMm: 25, dpmm: 8 }` (400 × 200 dots) unless it says otherwise:
  - `"a box's bounds are its own"`: `^XA^FO100,50^GB200,80,4^FS^XZ` gives one field `{ key: 1, kind: "box", bounds: { x: 100, y: 50, width: 200, height: 80 }, drawn: true }`.
  - `"text is measured where its ink is"`: `^XA^FO20,20^A0N,40^FDHi^FS^XZ` gives one text field whose bounds start at or after x 20, y 20, and fit inside `{ x: 20, y: 20, width: 60, height: 40 }`.
  - `"a field's elements share one field"`: a Code 128 with its interpretation line (`^XA^FO20,20^BCN,60,Y^FD123^FS^XZ`) is one field whose bounds cover the bars and the text below them.
  - `"bounds follow a centered print width"`: `^XA^PW200^FO0,0^GB50,50,50^FS^XZ` has bounds `{ x: 100, y: 0, width: 50, height: 50 }` (print width 200 centered on 400).
  - `"bounds follow an upside-down label"`: `^XA^POI^FO0,0^GB50,50,50^FS^XZ` has bounds `{ x: 350, y: 150, width: 50, height: 50 }` and the label has `inverted: true`.
  - `"each label has its fields"`: `^XA^FO0,0^GB10,10,10^FS^XZ^XA^FO20,0^GB10,10,10^FS^XZ` gives two labels with one field each.
  - `"copies share a key"`: `^XA^FO0,0^A0N,30^SN001,1,Y^FS^PQ2^XZ` gives two labels whose fields have the same `key`.
  - `"stored format fields keep the format's key"`: `^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDb^FS^XZ` gives two labels whose text fields have the same `key`, the index of the `^FO` inside the `^DF` label.
  - `"commands that aren't drawn yet are placeholders"`: `^XA^FO20,20^B4N,20^FDAB^FS^XZ` gives one field with `drawn: false` and non-empty bounds.
  - `"empty fields keep their position"`: `^XA^FO30,40^A0N,30^FD^FS^XZ` gives a field with bounds `{ x: 30, y: 40, width: 0, height: 0 }`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/render && pnpm -s vitest --run src/design.test.ts`
Expected: FAIL, `design.js` not found.

- [ ] **Step 3: Implement `designLabels()`** in `packages/render/src/design.ts`. Lay out with `layout()` exactly as `renderLabels()` does, then for each element draw it alone (through `justified()` and `draw()`) into one scratch `Raster` per label, cleared with `ink.fill(0)` between elements, and take the bounding box of dots with ink above 0. Group elements by their first command index into one field, uniting bounds. Map bounds through the same print-width centering, mirroring and turning that `renderLabels()` applies to the image. An element with no ink gets a zero-size rect at its `x`, `y`. `drawn` is false for `kind: "placeholder"`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd packages/render && pnpm -s vitest --run src/design.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Check the speed** with a scratch script (not committed) that times `designLabels()` on the viewer's Shipping label template at 8 dpmm, 4 × 6 in.
Expected: under 50 ms per call on a dev machine, after one warm-up call. If it's slower, scan only rows the element can reach (from its `y` to the label's bottom) before trying anything else.

- [ ] **Step 6: Run all checks and commit**

```bash
git add packages/render
git commit -m "feat(render): internal design layout with field bounds"
```

---

### Task 2: Rewriting a command's parameters in place

**Files:**
- Create: `packages/zpl/src/edit.ts`
- Modify: `packages/zpl/src/internal.ts` (export `editParameters` and `TextChange`)
- Modify: `packages/zpl/src/index.test.ts` (the internal entry's export list becomes `["editParameters", "measuredFields"]`, sorted)
- Test: `packages/zpl/src/edit.test.ts`

**Interfaces:**
- Produces:

```ts
/** A change to ZPL text, shaped like a CodeMirror change */
type TextChange = { from: number; to: number; insert: string };

/**
 * Replace parameters of a parsed command, by position, keeping every other
 * character of the command as written
 */
editParameters(
  zpl: string,
  command: Command,
  changes: Record<number, string | number>
): TextChange
```

Parameters are the command's body after its code, split on `,`. The code is the prefix and two letters, except `^A` followed by a font name (prefix and `A`), so for `^A0N,40,30` parameter 0 is `0N`, 1 is `40`, 2 is `30`; for `^A@N,40,30,E:ARIAL.TTF` parameter 1 is `40` too. Numbers are written without trailing zeros (`10.5`, not `10.50`). Changing a parameter past the last one adds empty ones between.

- [ ] **Step 1: Write the failing tests** in `packages/zpl/src/edit.test.ts`. A helper applies a `TextChange` to the text.
  - `"changes one parameter"`: in `^XA^FO20,30^FS^XZ`, changing the `FieldOrigin` command's parameter 0 to 25 gives `^XA^FO25,30^FS^XZ`.
  - `"keeps the rest as written"`: in `^XA^FO 20 ,30,1^FS^XZ` (spaces kept), changing parameter 1 to 35 gives `^XA^FO 20 ,35,1^FS^XZ`.
  - `"adds missing parameters"`: in `^XA^FO20^FS^XZ`, changing parameter 1 to 30 gives `^XA^FO20,30^FS^XZ`; in `^XA^GB100^FS^XZ`, changing parameter 2 to 4 gives `^XA^GB100,,4^FS^XZ`.
  - `"reads ^A's font as its first parameter"`: in `^XA^A0N,40,30^FS^XZ`, changing parameter 1 to 50 gives `^XA^A0N,50,30^FS^XZ`; in `^XA^A@N,40,30,E:ARIAL.TTF^FS^XZ` it gives `^XA^A@N,50,30,E:ARIAL.TTF^FS^XZ`.
  - `"keeps a changed prefix"` (Review Focus): in `^XA^CC#\n#FO20,30#FS#XZ`, changing the `FieldOrigin` command's parameter 0 to 25 gives `^XA^CC#\n#FO25,30#FS#XZ`.
  - `"writes numbers without trailing zeros"`: changing a parameter to `10.5` writes `10.5`, to `11` writes `11`.
  - `"won't edit with a changed delimiter"`: in `^XA^CD;^FO20;30^FS^XZ`, `editParameters` throws a `ZplError`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/zpl && pnpm -s vitest --run src/edit.test.ts`
Expected: FAIL, `edit.js` not found.

- [ ] **Step 3: Implement `editParameters()`** in `packages/zpl/src/edit.ts`, working on `zpl.slice(command.span.start, command.span.end)` only. To refuse `^CD`, check for a `^CD` or `~CD` (any prefix) earlier in the text than the command.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd packages/zpl && pnpm -s vitest --run src/edit.test.ts src/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Run all checks and commit**

```bash
git add packages/zpl
git commit -m "feat(core): internal editParameters rewrites a command in place"
```

---

### Task 3: Fields in the viewer: finding, hitting and sharing

**Files:**
- Create: `apps/site/playground/designer/fields.ts`
- Test: `apps/site/playground/designer/fields.test.ts`

**Interfaces:**
- Consumes: `designLabels`, `DesignField`, `DesignLabel`, `Rect` (Task 1); `parse` from `@zplkit/core`.
- Produces:

```ts
type Design = {
  zpl: string;
  dpmm: number;
  commands: Command[];
  labels: DesignLabel[];
};

designFor(zpl: string, options: RenderOptions): Design
/** The topmost field under a point on a label, in dots */
fieldAt(label: DesignLabel, x: number, y: number): DesignField | undefined
/** Fields whose bounds overlap a rectangle, like a selection box */
fieldsIn(label: DesignLabel, rect: Rect): DesignField[]
/** The field whose ZPL holds a text offset, like the editor's cursor */
fieldAtOffset(design: Design, offset: number): DesignField | undefined
/** The ranges of ZPL text a field's commands take, in order, for highlighting */
spansOf(design: Design, field: DesignField): { from: number; to: number }[]
/** How many labels print a field */
labelsSharing(design: Design, key: number): number
```

`fieldAt` treats a zero-size field as a 6 × 6 dot target centered on its position, so empty fields stay selectable.

- [ ] **Step 1: Write the failing tests** in `fields.test.ts`, with `{ widthMm: 50, heightMm: 25, dpmm: 8 }`:
  - `"finds the topmost field under a point"`: for two overlapping boxes `^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS`, `fieldAt` at (60, 60) is the second; at (20, 20) the first; at (300, 150) none.
  - `"selects empty fields near their position"`: `^FO30,40^A0N,30^FD^FS` is found at (32, 42).
  - `"finds fields in a selection box"`: for boxes at x 10, 150 and 300, a rect from (0, 0) 200 × 200 finds the first two.
  - `"finds the field the cursor is in"`: for `^XA\n^FO20,20^A0N,40^FDHi^FS\n^FO20,80^GB100,2,2^FS\n^XZ`, an offset inside `^FDHi` gives the text field; an offset inside `^GB` gives the box; an offset inside `^XA` gives none.
  - `"spans are the field's commands"`: the text field's `spansOf` are the spans of `^FO20,20`, `^A0N,40`, `^FDHi` and `^FS`.
  - `"stored format fields are shared"` (Review Focus): the stored format ZPL from Task 1 has `labelsSharing` 2 for the format's text field, and 1 for a field of a plain label.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/fields.test.ts`
Expected: FAIL, `fields` not found.

- [ ] **Step 3: Implement** in `fields.ts`. `fieldAtOffset` searches the first label with the field's key, so cursors in a stored format resolve to its field.

- [ ] **Step 4: Run them to see them pass**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/fields.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/playground/designer
git commit -m "feat(site): designer finds fields, under the pointer and the cursor"
```

---

### Task 4: Moving fields

**Files:**
- Create: `apps/site/playground/designer/move.ts`
- Test: `apps/site/playground/designer/move.test.ts`

**Interfaces:**
- Consumes: `Design`, `DesignField` (Task 3); `editParameters`, `TextChange` from `@zplkit/core/internal` (Task 2).
- Produces:

```ts
/**
 * Move fields by a distance on screen, in dots: their ^FO or ^FT changes,
 * or a ^FO is added to a field that has neither
 */
moveFields(design: Design, keys: number[], dx: number, dy: number): TextChange[]
```

A key appearing on several labels is changed once. On a label with `inverted`, the move turns half a turn (`-dx`, `-dy`); with `mirrored`, `dx` flips. Values are written in the units `^MU` sets before the command (dots, or millimeters at `dpmm` dots per mm, or inches at `25 * dpmm`, as layout uses), rounded to 2 decimals. Changes come back sorted by `from` and never overlap, so they can be applied as one CodeMirror transaction.

- [ ] **Step 1: Write the failing tests** in `move.test.ts`, applying the changes to the text to compare:
  - `"moves a field's ^FO"`: `^XA^FO20,30^GB10,10,10^FS^XZ` moved by (5, -10) gives `^XA^FO25,20^GB10,10,10^FS^XZ`.
  - `"moves a ^FT field"`: `^XA^FT20,60^A0N,40^FDHi^FS^XZ` moved by (10, 10) gives `^XA^FT30,70^A0N,40^FDHi^FS^XZ`.
  - `"moves several fields at once"`: two boxes moved by (1, 1) each get their own `^FO` change, in one sorted list.
  - `"writes millimeters with ^MU"` (Review Focus): `^XA^MUM^FO10,5^GB10,10,1^FS^XZ` at 8 dpmm moved by (8, 4) gives `^XA^MUM^FO11,5.5^GB10,10,1^FS^XZ`.
  - `"moves upside-down labels the way the screen shows"` (Review Focus): `^XA^POI^FO20,30^GB10,10,10^FS^XZ` moved by (5, 5) gives `^FO15,25`; `^XA^PMY^FO20,30^GB10,10,10^FS^XZ` moved by (5, 5) gives `^FO15,35`.
  - `"adds a ^FO to a field without one"` (Review Focus): `^XA^GB10,10,10^FS^XZ` moved by (12, 8) gives `^XA^FO12,8^GB10,10,10^FS^XZ`.
  - `"moves a stored format's field once"` (Review Focus): in the stored format ZPL from Task 1, moving the shared text field's key by (5, 0) gives exactly one change, to the `^FO10,10` inside `^DF`, making it `^FO15,10`.
  - `"leaves everything else as written"`: for `^XA\n^FO 20,30 ^GB10,10,10^FS\n^XZ`, moving by (1, 0) changes only the `20`.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/move.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `moveFields()`** in `move.ts`. Find a field's position command as its first command when that's a `FieldOrigin` or `FieldTypeset`; new values are the command's own values plus the converted distance. For a field without one, insert `^FO{dx},{dy}` (converted the same way) before the field's first command, using the prefix character the ZPL uses at that point.

- [ ] **Step 4: Run them to see them pass**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/move.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/playground/designer
git commit -m "feat(site): designer moves fields by editing their position"
```

---

### Task 5: Snapping, aligning and distributing

**Files:**
- Create: `apps/site/playground/designer/snap.ts`
- Create: `apps/site/playground/designer/align.ts`
- Test: `apps/site/playground/designer/snap.test.ts`, `apps/site/playground/designer/align.test.ts`

**Interfaces:**
- Consumes: `Rect` (Task 1).
- Produces:

```ts
type Guide = { axis: "x" | "y"; at: number };

/**
 * Adjust a move so the moving rect's left, center or right lines up with
 * another rect's left, center or right, or the label's edges and center,
 * within `threshold` dots; the same for top, middle and bottom
 */
snapMove(
  moving: Rect,
  dx: number,
  dy: number,
  others: Rect[],
  label: { width: number; height: number },
  threshold?: number // default 4
): { dx: number; dy: number; guides: Guide[] }

type Edge = "left" | "center" | "right" | "top" | "middle" | "bottom";
/** How far each rect moves to line up with the others' outermost edge, or their common center */
alignMoves(rects: Map<number, Rect>, edge: Edge): Map<number, { dx: number; dy: number }>
/** How far each rect moves so the gaps between them are equal, keeping the first and last */
distributeMoves(rects: Map<number, Rect>, axis: "x" | "y"): Map<number, { dx: number; dy: number }>
```

Moves are whole dots. Snapping picks the closest line within the threshold on each axis independently, and returns a guide for each line it snapped to.

- [ ] **Step 1: Write the failing tests:**
  - `snap.test.ts`, `"snaps to another field's left edge"`: moving `{ x: 0, y: 0, width: 20, height: 20 }` by (97, 0) next to `{ x: 100, y: 50, width: 40, height: 40 }` gives `{ dx: 100, dy: 0 }` and a guide `{ axis: "x", at: 100 }`.
  - `"snaps centers"`: a 20-wide rect moved so its center is 2 dots from another's center lines the centers up.
  - `"snaps to the label's center"`: on a 400 × 200 label, a 40-wide rect moved to x 179 snaps to x 180 with a guide at 200.
  - `"leaves moves alone outside the threshold"`: a move landing 5 dots from every line comes back unchanged with no guides.
  - `align.test.ts`, `"aligns left edges"`: rects at x 10, 30 and 50 move by (0, 0), (-20, 0) and (-40, 0).
  - `"aligns centers"`: rects 20 and 40 wide at x 0 and 100 line up their centers on the center of their combined bounds.
  - `"distributes with equal gaps"`: 10-wide rects at x 0, 15 and 90 move the middle one to x 45.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/snap.test.ts playground/designer/align.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** both modules.

- [ ] **Step 4: Run them to see them pass**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/snap.test.ts playground/designer/align.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/playground/designer
git commit -m "feat(site): designer snaps, aligns and distributes fields"
```

---

### Task 6: Resizing fields

**Files:**
- Create: `apps/site/playground/designer/resize.ts`
- Test: `apps/site/playground/designer/resize.test.ts`

**Interfaces:**
- Consumes: `Design`, `DesignField` (Task 3); `editParameters`, `TextChange` (Task 2); `moveFields` (Task 4).
- Produces:

```ts
type Handles = "none" | "corners" | "proportional";
/** Which handles a field gets */
resizeHandles(design: Design, field: DesignField): Handles
/** Resize a field to new bounds on screen, moving it if its top or left moved */
resizeField(design: Design, key: number, bounds: Rect): TextChange[]
```

What resizes, by command type and parameter:

| Field | Command | Parameters | Handles |
|---|---|---|---|
| Box | `GraphicBox` (`^GB`) | 0 width, 1 height | corners |
| Ellipse | `GraphicEllipse` (`^GE`) | 0 width, 1 height | corners |
| Diagonal | `GraphicDiagonal` (`^GD`) | 0 width, 1 height | corners |
| Circle | `GraphicCircle` (`^GC`) | 0 diameter | proportional |
| Text with its own `^A` | `Font` | 1 height, 2 width (scaled with height when set) | proportional |
| Code 128 | `Code128` (`^BC`) | 1 height | corners, height only |
| QR code | `QrCode` (`^BQ`) | 2 magnification, rounded, 1 to 100 | proportional |

Everything else gets `"none"` for now; its options are edited in the popover later. Sizes are written in the field's `^MU` units, like moves.

- [ ] **Step 1: Write the failing tests:**
  - `"resizes a box"`: `^XA^FO10,10^GB100,50,3^FS^XZ` to bounds `{ x: 10, y: 10, width: 120, height: 60 }` gives `^GB120,60,3`.
  - `"moves a box resized from its top left"`: to `{ x: 0, y: 0, width: 110, height: 60 }` gives `^FO0,0^GB110,60,3`.
  - `"resizes text by its height"`: `^XA^FO10,10^A0N,40,30^FDHi^FS^XZ` to bounds twice as tall gives `^A0N,80,60`.
  - `"text without its own font doesn't resize"`: `^XA^CF0,40^FO10,10^FDHi^FS^XZ` has `resizeHandles` `"none"`.
  - `"resizes a QR code by its magnification"`: `^XA^FO10,10^BQN,2,4^FDQA,hi^FS^XZ` to bounds 1.5 times as wide gives `^BQN,2,6`.
  - `"barcodes only get taller"`: `^XA^FO10,10^BCN,60^FD123^FS^XZ` to 80 dots of bars gives `^BCN,80`, and its width doesn't change.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/resize.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** in `resize.ts`. Combine the size change with `moveFields()` for a top or left move, as one sorted, non-overlapping change list.

- [ ] **Step 4: Run them to see them pass**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/resize.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/playground/designer
git commit -m "feat(site): designer resizes boxes, shapes, text and codes"
```

---

### Task 7: One undo history for canvas and code

**Files:**
- Create: `apps/site/playground/designer/history.ts`
- Modify: `apps/site/playground/Editor.tsx` (use `designerHistory()` instead of `history()`; no other change)
- Test: `apps/site/playground/designer/history.test.ts`

**Interfaces:**
- Consumes: `TextChange` (Task 2).
- Produces:

```ts
/** The editor's history, joining each drag into one undo step */
designerHistory(): Extension
/**
 * A transaction applying designer changes. `drag` names the drag it belongs
 * to; transactions with the same drag join one undo step, and a new drag
 * starts a new one.
 */
designerEdit(changes: TextChange[], options: { drag?: number }): TransactionSpec
```

Use `history({ joinToEvent })` from `@codemirror/commands`, joining a transaction to the previous event when both carry the same drag id (an annotation defined in `history.ts`), and `isolateHistory` so a drag never joins typing. Edits without a drag, like a nudge or an alignment, are each their own step.

- [ ] **Step 1: Write the failing tests** with `EditorState.create({ doc, extensions: [designerHistory()] })` and `undo` from `@codemirror/commands`:
  - `"a drag is one undo step"`: five `designerEdit` transactions with `drag: 1` moving `^FO20,30` to `^FO25,30`, then one `undo`, gives the original text.
  - `"typing and a drag undo separately"`: typing `X` at the end, then a drag, then one `undo` leaves the `X` and undoes the drag.
  - `"two drags undo separately"`: drag 1 then drag 2, one `undo` undoes only drag 2.
  - `"a nudge is its own step"`: two nudges without a drag, one `undo` undoes only the second.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/history.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `history.ts`, and swap `history()` for `designerHistory()` in `Editor.tsx`.

- [ ] **Step 4: Run them to see them pass**, and check the viewer by hand: typing, undo and redo in the editor behave as before.

Run: `cd apps/site && pnpm -s vitest --run playground/designer/history.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run all checks and commit**

```bash
git add apps/site/playground
git commit -m "feat(site): designer edits join one undo history with typing"
```

---

### Task 8: Adding, pasting, duplicating and deleting fields

**Files:**
- Create: `apps/site/playground/designer/fields-edit.ts`
- Test: `apps/site/playground/designer/fields-edit.test.ts`

**Interfaces:**
- Consumes: `Design`, `DesignField`, `spansOf` (Task 3); `moveFields` (Task 4); `TextChange` (Task 2).
- Produces:

```ts
type NewField = "text" | "code128" | "qr" | "box";
/** Add a field at a point on a label, before the label's ^XZ */
addField(design: Design, label: number, kind: NewField, x: number, y: number): TextChange[]
/** Add pasted field ZPL at a point, moving its ^FO or ^FT there if it has one */
pasteField(design: Design, label: number, zpl: string, x: number, y: number): TextChange[]
/** Copy fields after themselves, 10 dots right and down */
duplicateFields(design: Design, keys: number[]): TextChange[]
/** Remove fields, from their ^FO or ^FT to their ^FS */
deleteFields(design: Design, keys: number[]): TextChange[]
/** Whether deleteFields and duplicateFields can take a field */
canRemove(field: DesignField, design: Design): boolean
```

New fields, with `{x},{y}` written in the label's `^MU` units:

| Kind | ZPL |
|---|---|
| text | `^FO{x},{y}^A0N,30^FDText^FS` |
| code128 | `^FO{x},{y}^BCN,60^FD12345678^FS` |
| qr | `^FO{x},{y}^BQN,2,4^FDQA,https://zplkit.fingal.dev^FS` |
| box | `^FO{x},{y}^GB120,60,3^FS` |

New text goes on its own line when the label's `^XZ` starts a line, else right before it. Only fields that start with `^FO` or `^FT` can be duplicated or deleted, since a field without one shares its commands with settings before it; `canRemove` says so, and the UI disables those actions.

- [ ] **Step 1: Write the failing tests:**
  - `"adds text before ^XZ"`: in `^XA
^FO10,10^GB10,10,10^FS
^XZ`, adding text at (40, 50) gives `^XA
^FO10,10^GB10,10,10^FS
^FO40,50^A0N,30^FDText^FS
^XZ`.
  - `"adds to the right label"`: with two labels, adding a box to label 1 changes only the second `^XA…^XZ`.
  - `"pastes a field where it's dropped"`: pasting `^FO0,0^A0N,30^FDHi^FS` at (40, 50) inserts `^FO40,50^A0N,30^FDHi^FS`.
  - `"duplicates a field next to itself"`: `^XA^FO10,10^GB10,10,10^FS^XZ` duplicated gives `^XA^FO10,10^GB10,10,10^FS^FO20,20^GB10,10,10^FS^XZ`.
  - `"deletes a field and nothing else"`: `^XA^BY3^FO10,10^BCN,60^FD1^FS^FO10,90^BCN,60^FD2^FS^XZ` with the first barcode deleted gives `^XA^BY3^FO10,90^BCN,60^FD2^FS^XZ`, keeping `^BY3` for the second.
  - `"won't delete a field without a position"`: `^XA^CF0,30^FDHi^FS^XZ` has `canRemove` false.

- [ ] **Step 2: Run them to see them fail**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/fields-edit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** in `fields-edit.ts`.

- [ ] **Step 4: Run them to see them pass**

Run: `cd apps/site && pnpm -s vitest --run playground/designer/fields-edit.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run all checks and commit**

```bash
git add apps/site/playground/designer
git commit -m "feat(site): designer adds, pastes, duplicates and deletes fields"
```

---

## After the engine

The screens (selection, handles, the popover, adding fields, problems on fields, phones) get their own plan once the visual design is in. That plan wires these functions into `Viewer.tsx`, `Bench.tsx` and `Editor.tsx`, decides how a drag draws the moving field without re-rendering every frame, and decides how fields are classed as fully or partly understood for the popover.
