import { ChangeSet, EditorState, Text } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { startDrag } from "./drag";
import { designFor } from "./fields";
import { moveFields } from "./move";
import {
  carry,
  clickAt,
  highlightOf,
  pressAt,
  redesigned,
  selectAtOffset,
  selectIn,
  twinsOf,
} from "./selection";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };
const none = { keys: [], label: 0 };
const plain = { shift: false, alt: false };
const two = "^XA^FO10,10^GB100,100,100^FS^FO200,10^GB50,50,50^FS^XZ";

describe("selection", () => {
  test("a click selects, shift toggles, empty space clears", () => {
    const design = designFor(two, options);
    const [a, b] = design.labels[0].fields;
    const first = clickAt(design, none, 0, 20, 20, plain);
    expect(first.keys).toEqual([a.key]);
    const both = clickAt(design, first, 0, 210, 20, { ...plain, shift: true });
    expect(both.keys).toEqual([a.key, b.key]);
    const one = clickAt(design, both, 0, 20, 20, { ...plain, shift: true });
    expect(one.keys).toEqual([b.key]);
    expect(clickAt(design, both, 0, 300, 180, plain).keys).toEqual([]);
  });

  test("alt-click selects the field underneath", () => {
    const design = designFor(
      "^XA^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ",
      options
    );
    const [lower, top] = design.labels[0].fields;
    const first = clickAt(design, none, 0, 60, 60, plain);
    expect(first.keys).toEqual([top.key]);
    const under = clickAt(design, first, 0, 60, 60, { ...plain, alt: true });
    expect(under.keys).toEqual([lower.key]);
  });

  test("alt-click cycles through stacked fields that are all selected", () => {
    const design = designFor(
      "^XA^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ",
      options
    );
    const [lower, top] = design.labels[0].fields;
    const all = { keys: [lower.key, top.key], label: 0 };
    const alt = { ...plain, alt: true };
    const down = clickAt(design, all, 0, 60, 60, alt);
    expect(down.keys).toEqual([lower.key]);
    expect(clickAt(design, down, 0, 60, 60, alt).keys).toEqual([top.key]);
  });

  test("selecting on a later copy keeps its label and shows twins", () => {
    const design = designFor("^XA^FO0,0^A0N,30^SN001,1,Y^FS^PQ3^XZ", options);
    const field = design.labels[2].fields[0];
    const { x, y } = field.bounds;
    const selection = clickAt(design, none, 2, x + 1, y + 1, plain);
    expect(selection).toEqual({ keys: [field.key], label: 2 });
    expect(twinsOf(design, selection).map((t) => t.label)).toEqual([0, 1]);
  });

  test("placeholder and empty fields can be selected", () => {
    const placeholder = designFor("^XA^FO30,40^B4N,20^FDAB^FS^XZ", options);
    const [p] = placeholder.labels[0].fields;
    expect(
      clickAt(placeholder, none, 0, p.bounds.x + 1, p.bounds.y + 1, plain).keys
    ).toEqual([p.key]);
    const empty = designFor("^XA^FO30,40^A0N,30^FD^FS^XZ", options);
    expect(clickAt(empty, none, 0, 31, 41, plain).keys).toEqual([
      empty.labels[0].fields[0].key,
    ]);
  });

  test("a box selects what it touches, adding on request", () => {
    const design = designFor(two, options);
    const [a, b] = design.labels[0].fields;
    const box = { x: 0, y: 0, width: 150, height: 150 };
    const first = selectIn(design, 0, box, false, none);
    expect(first.keys).toEqual([a.key]);
    const more = selectIn(
      design,
      0,
      { x: 190, y: 0, width: 100, height: 100 },
      true,
      first
    );
    expect(more.keys).toEqual([a.key, b.key]);
  });

  test("the cursor selects the field it is in", () => {
    const zpl = "^XA^FO10,10^FDone^FS^FO10,60^FDtwo^FS^XZ";
    const design = designFor(zpl, options);
    const selected = { keys: [design.labels[0].fields[0].key], label: 0 };
    const at = selectAtOffset(design, zpl.indexOf("two"), selected);
    expect(at.keys).toEqual([design.labels[0].fields[1].key]);
    expect(selectAtOffset(design, 1, selected)).toBe(selected);
  });

  test("carry follows a field through an insert and drops a deleted one", () => {
    const before = "^XA^FO10,10^FDone^FS^FO10,60^FDtwo^FS^XZ";
    const previous = designFor(before, options);
    const selection = { keys: [previous.labels[0].fields[1].key], label: 0 };

    const insert = "^FO10,110^FDnew^FS";
    const inserted = ChangeSet.of({ from: 3, insert }, before.length);
    const afterInsert = designFor(
      before.slice(0, 3) + insert + before.slice(3),
      options
    );
    const moved = carry(previous, afterInsert, selection, inserted);
    expect(moved.keys).toEqual([afterInsert.labels[0].fields[2].key]);
    expect(moved.keys[0]).not.toBe(selection.keys[0]);
    // Without the edit, only a field that stayed put can be kept
    expect(carry(previous, afterInsert, selection).keys).toEqual([]);
    expect(carry(previous, previous, selection).keys).toEqual(selection.keys);

    const from = before.indexOf("^FO10,60");
    const to = before.indexOf("^XZ");
    const deleted = ChangeSet.of({ from, to }, before.length);
    const afterDelete = designFor(
      before.slice(0, from) + before.slice(to),
      options
    );
    expect(carry(previous, afterDelete, selection, deleted).keys).toEqual([]);
    expect(carry(previous, afterDelete, selection).keys).toEqual([]);
  });

  test("carry drops a deleted field even when another follows it", () => {
    const before = "^XA^FO10,10^FDone^FS^FO10,60^FDtwo^FS^XZ";
    const previous = designFor(before, options);
    const selection = { keys: [previous.labels[0].fields[0].key], label: 0 };
    const to = before.indexOf("^FO10,60");
    const deleted = ChangeSet.of({ from: 3, to }, before.length);
    const next = designFor(before.slice(0, 3) + before.slice(to), options);
    expect(carry(previous, next, selection, deleted).keys).toEqual([]);
  });

  test("highlightOf gives selected and hovered spans", () => {
    const design = designFor(two, options);
    const [a, b] = design.labels[0].fields;
    const h = highlightOf(
      design,
      { keys: [a.key], label: 0 },
      {
        key: b.key,
        label: 0,
      }
    );
    const text = (r: { from: number; to: number }[]) =>
      r.map(({ from, to }) => design.zpl.slice(from, to)).join("");
    expect(text(h.selected)).toBe("^FO10,10^GB100,100,100^FS");
    expect(text(h.hovered)).toBe("^FO200,10^GB50,50,50^FS");
  });

  test("carry keeps a field a move just gave a ^FO", () => {
    const before = "^XA^GB10,10,10^FS^XZ";
    const previous = designFor(before, options);
    const selection = { keys: [previous.labels[0].fields[0].key], label: 0 };
    const edit = moveFields(previous, selection.keys, 5, 0);
    expect(edit[0].insert).toContain("^FO");
    const changes = ChangeSet.of(edit, before.length);
    const next = designFor(
      changes.apply(Text.of([before])).toString(),
      options
    );
    const kept = carry(previous, next, selection, changes);
    expect(kept.keys).toEqual([next.labels[0].fields[0].key]);
  });

  test("redesigned selects a duplicate once its text is in", () => {
    const before = "^XA^FO10,10^GB50,50,50^FS^XZ";
    const previous = designFor(before, options);
    const selection = { keys: [previous.labels[0].fields[0].key], label: 0 };
    const copy = "^FO60,60^GB50,50,50^FS";
    const after = before.replace("^XZ", copy + "^XZ");
    const next = designFor(after, options);
    const offset = after.indexOf(copy);
    const picked = redesigned(previous, next, selection, {
      selectAt: { offset, zpl: after },
    });
    expect(picked.keys).toEqual([next.labels[0].fields[1].key]);
    // A duplicate whose edit never made it doesn't select later
    const stale = redesigned(previous, next, selection, {
      selectAt: { offset, zpl: before },
    });
    expect(stale.keys).toEqual([next.labels[0].fields[0].key]);
  });

  describe("pressAt", () => {
    const design = designFor(two, options);
    const [a, b] = design.labels[0].fields;
    const none = { keys: [], label: 0 };
    const press = { shift: false };

    test("on a handle of one selected field: resize", () => {
      const one = { keys: [a.key], label: 0 };
      expect(
        pressAt(design, one, 0, { x: 0, y: 0 }, { ...press, handle: "se" })
      ).toEqual({
        kind: { kind: "resize", handle: "se" },
        selection: one,
        clickOnUp: false,
      });
    });

    test("on empty space: a selection box, clicking clears on up", () => {
      expect(pressAt(design, none, 0, { x: 300, y: 180 }, press)).toEqual({
        kind: { kind: "box" },
        selection: none,
        clickOnUp: true,
      });
    });

    test("on a selected field: move it, a click picks on up", () => {
      const both = { keys: [a.key, b.key], label: 0 };
      expect(pressAt(design, both, 0, { x: 20, y: 20 }, press)).toEqual({
        kind: { kind: "move" },
        selection: both,
        clickOnUp: true,
      });
    });

    test("on another field: select it now and move it", () => {
      expect(pressAt(design, none, 0, { x: 20, y: 20 }, press)).toEqual({
        kind: { kind: "move" },
        selection: { keys: [a.key], label: 0 },
        clickOnUp: false,
      });
      const added = pressAt(
        design,
        { keys: [a.key], label: 0 },
        0,
        { x: 210, y: 20 },
        { shift: true }
      );
      expect(added.selection.keys).toEqual([a.key, b.key]);
    });

    test("repeated alt-clicks on stacked fields cycle top, middle, bottom, top", () => {
      const stacked = designFor(
        "^XA^FO10,10^GB100,100,100^FS^FO30,30^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ",
        options
      );
      const [bottom, middle, top] = stacked.labels[0].fields;
      const alt = { shift: false, alt: true };
      let selection: { keys: number[]; label: number } = none;
      const picked: number[][] = [];
      for (let i = 0; i < 4; i++) {
        // As the overlay does: press, then click on release when asked
        const press = pressAt(stacked, selection, 0, { x: 60, y: 60 }, alt);
        expect(press.clickOnUp).toBe(true);
        selection = press.selection;
        selection = clickAt(stacked, selection, 0, 60, 60, alt);
        picked.push(selection.keys);
      }
      expect(picked).toEqual([
        [top.key],
        [middle.key],
        [bottom.key],
        [top.key],
      ]);
    });

    test("an alt press keeps the selection, and a drag moves the topmost", () => {
      const stacked = designFor(
        "^XA^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^FO300,10^GB10,10,10^FS^XZ",
        options
      );
      const [, top, away] = stacked.labels[0].fields;
      const elsewhere = { keys: [away.key], label: 0 };
      const press = pressAt(
        stacked,
        elsewhere,
        0,
        { x: 60, y: 60 },
        { shift: false, alt: true }
      );
      expect(press.selection).toBe(elsewhere);
      expect(press.kind).toEqual({ kind: "move" });
      expect(press.moves).toEqual({ keys: [top.key], label: 0 });
    });

    test("a press on a covered selected field moves it, keeping the selection", () => {
      const stacked = designFor(
        "^XA^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ",
        options
      );
      const [lower] = stacked.labels[0].fields;
      const selected = { keys: [lower.key], label: 0 };
      const pressed = pressAt(stacked, selected, 0, { x: 60, y: 60 }, press);
      expect(pressed).toEqual({
        kind: { kind: "move" },
        selection: selected,
        clickOnUp: true,
      });
      const step = startDrag(
        stacked,
        pressed.moves ?? pressed.selection,
        0,
        {
          x: 60,
          y: 60,
        },
        pressed.kind
      ).moveTo({ x: 80, y: 60 }, { snap: false, pxToDots: 1 });
      expect(step.edit).toBeDefined();
      const text = EditorState.create({ doc: stacked.zpl })
        .update(step.edit!)
        .state.doc.toString();
      expect(text).toBe(
        "^XA^FO30,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ"
      );
    });

    test("a handle with several selected is a press on the field", () => {
      const both = { keys: [a.key, b.key], label: 0 };
      expect(
        pressAt(design, both, 0, { x: 20, y: 20 }, { ...press, handle: "se" })
          .kind
      ).toEqual({ kind: "move" });
    });
  });
});
