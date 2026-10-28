import { ChangeSet } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import {
  carry,
  clickAt,
  highlightOf,
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
});
