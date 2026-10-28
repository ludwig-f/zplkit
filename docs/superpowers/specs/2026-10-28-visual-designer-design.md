# Visual designer for the ZPL viewer

Status: design, before visual design and planning. Written 2026-10-28.

## Intent

The viewer at `/viewer` previews ZPL. The designer makes that preview editable: select a field on the label, move it, resize it, change its options, add new ones. It's meant to be the best label designer there is, and the showcase that makes developers want zplkit.

Existing designers set a low bar. The best known online one "kind of worked" but wasn't nice to use. zplkit can do better because it already has what a designer needs underneath: a parser that knows where every command is in the text, a renderer that draws exactly what the printer prints, lint that knows what's wrong, and a converter that turns ZPL into zplkit code.

### The moment that sells it

A developer pastes their own ZPL, from production, from another tool, from a carrier, and it becomes editable right away. Fields can be selected, dragged and resized on the preview, and the ZPL in the editor changes as they do.

The second demo is the road to code: the designed label opens in the playground as JSX, where its values become props and an array of rows (say, from a database) becomes one label per row.

### Who it's for

Developers who have ZPL or will generate it with zplkit. Polish matters: it should feel finished, and everything should just work.

## Principles

1. **The ZPL is the source of truth.** There's no separate design model that gets turned into ZPL. Every canvas edit is an edit to the ZPL text, made with the smallest change that does it (for a move, the numbers in `^FO`). Edits in the editor show up on the canvas, and edits on the canvas show up in the editor, as one document.
2. **The canvas is the real render.** What's drawn is zplkit's renderer output, the same dots the printer prints, not an approximation drawn with browser text and shapes.
3. **Never rewrite what isn't understood.** The designer only changes what it changes on purpose. Commands it doesn't model are kept as written, byte for byte.
4. **Instant.** Dragging and nudging feel immediate, even on a 4 × 6 in label with many fields.

## Goals

### Selecting

- Click a field on the canvas to select it.
- The selected field's ZPL is highlighted in the editor, so it's clear what's being changed and where.
- It works the other way too: putting the cursor in a field's ZPL selects that field on the canvas.
- Select several fields (Shift-click, or drag a selection box) to move or align them together.

### Moving and resizing

- Drag a field to move it. Its `^FO` (or `^FT`) numbers update live in the editor.
- Handles resize what can be resized, by rewriting the parameters each kind of field depends on: a box's width and height, a font's height and width, a barcode's height and module width, a QR code's magnification.
- Arrow keys nudge the selection by 1 dot, Shift+arrow by 10.
- Dragging snaps to other fields' edges and centers and to the label's edges and center, with guides showing what it snapped to.
- Align and distribute several selected fields.

### Editing options

- A selected field has a popover with every option for its kind: for text, the font, height, width, rotation, text block, contents; for a barcode, its type's options and data; for a box, size, thickness, color and rounding.
- Options and handles edit the same commands, so the popover, the canvas and the editor always agree.

### Fields the designer doesn't fully understand

Real ZPL contains commands zplkit only partly understands, or not at all. Nothing pasted is ever stuck:

- **Every field can be selected and moved,** because every field has a position zplkit can rewrite, whatever else it contains.
- **Fully understood** fields (text, barcodes, boxes, shapes): every option is editable.
- **Partly understood** fields: the options zplkit knows are editable, and a short note says what's kept as it is.
- **Not understood:** the popover says zplkit can't edit this field's contents, offers its ZPL to edit directly in the popover, and links to its lines in the editor.

### Several labels

ZPL often makes more than one label: several `^XA…^XZ` blocks, copies and serial numbers of one label, or a stored format (`^DF`) that several labels recall with their own `^FN` data. The viewer shows up to 5 of them stacked.

- Fields can be selected and edited on any label shown. The edit changes the ZPL as it's written.
- A field written once but printed on several labels (copies, serial numbers, stored formats) moves on all of them together. Its popover says so, like "Shared by 5 labels". Data that belongs to one label, like its `^FN` values, is edited on that label only.
- Separate `^XA…^XZ` blocks are separate labels, each edited on its own.

(Agreed in conversation.)

### Adding, removing, undoing

- Add text, a barcode, a QR code or a box into empty space on the label.
- Paste a field's ZPL straight onto the canvas.
- Delete and duplicate the selection.
- Undo and redo cover canvas edits and editor edits alike, as one history.

### Trust

- Lint problems show on the field they belong to, as well as in the Problems panel.
- Fields that aren't drawn yet are still shown and selectable, marked as such.

### To code

- The existing export (Show code, Open in playground) turns the designed label into JSX or method calls.
- In the playground, people turn values into props and map rows to labels themselves. The "Product labels" example already shows that pattern.

## Non-goals

- **Marking fields as data in the designer** (turning "Organic Oat Drink" into a `name` placeholder). The first version leaves this to the playground. It can come later if exporting turns out clunky. (My call, agreed in conversation.)
- **A design format of its own.** No project files, layers panel or groups that exist only in the designer. Anything the designer knows is in the ZPL. (My call, from principle 1.)

## Anti-goals: failures even if it works

- **Wrong ZPL:** the designer writes something the printer reads differently from what the canvas shows.
- **Labels it can't handle:** pasting real-world ZPL leads to errors, or fields that can't even be moved.
- **Lag:** dragging that stutters, or redraws that fall behind the pointer.
- **Silent rewrites:** reformatting, reordering or "cleaning up" ZPL the person didn't touch.

## Constraints

- **It's part of the viewer,** not the playground: the playground's source is TypeScript, where positions may come from variables and loops, so dragging can't rewrite them safely. People who want code use the export.
- **Built on what exists:** the viewer's editor (CodeMirror), `@zplkit/core`'s parser (every command has its span in the text), `@zplkit/render`'s layout (every drawn element lists the commands that produced it), lint, and `convert`.
- **Phones:** the viewer works on phones today with Editor, Preview and Problems tabs. The designer should at least keep that working; selecting a field and editing it in the popover would be nice on touch, but dragging precision is a desktop job. (My call; the visual design should decide how far to go.)
- **Copy:** no em dashes. Other ZPL renderers or designers aren't named on the site.

## Order of work

The visual design comes first, from Claude Design. Until it arrives, the plan covers the engine underneath, which doesn't depend on how it looks: finding fields and their bounds, hit-testing, rewriting commands from their spans, live dragging, and one undo history. The screens are planned once the design is in. (Agreed in conversation.)

The renderer doesn't yet expose element bounds or a layout callable outside the preview element. The designer gets them through an internal entry point, like `@zplkit/core/internal`, not new public API. (My call.)

## Left to the builder

- How canvas edits are applied to the text (which commands each handle rewrites, how live dragging stays fast, for example by drawing a moved field on top while dragging and re-rendering once it's dropped).
- What counts as a field: grouping commands into one selectable thing, using the element's command list.
- The undo model that merges canvas and editor edits.
- Which commands are "fully" or "partly" understood, from what the parser and renderer support.

## Brief for Claude Design

Design the visual designer inside the existing ZPL viewer at `/viewer` (see the app's current chrome: toolbar on top, ZPL editor on the left with a bar holding the line count and Format, the preview on the right on a dotted bench with rulers, a status bar above it with View settings, the Problems panel under the editor, and tabs on phones).

Please design:

1. **Selection on the canvas:** what a selected field looks like on top of the real rendered label, its resize handles, and multi-selection.
2. **The link between canvas and code:** how the selected field's lines are highlighted in the editor, and how the canvas shows the field the editor's cursor is in.
3. **Moving:** snapping guides, alignment and distribution controls for several fields, and how the position reads while dragging (in dots, and in the unit chosen in View).
4. **The field popover:** where it appears and how it's laid out for text, a barcode, a QR code and a box. Also the "partly understood" note, and the "not understood" state with its raw ZPL and a link to the code.
5. **Adding fields:** how someone adds text, a barcode, a QR code or a box into empty space.
6. **Problems on the canvas:** how lint problems and fields that aren't drawn yet show on the field itself.
7. **Several labels:** how a field shared by several labels (copies, serial numbers, a stored format) shows that it's shared, on the canvas and in the popover.
8. **Phones:** how much of this works on a phone, and how.

Two questions are open for the design to answer: is designing a mode you turn on, or always on? And today, clicking the preview copies the `^FO` for that spot; what happens to that?

It should feel precise and calm, a tool developers trust with production labels: the label stays the hero, and the designer's chrome stays out of its way.
