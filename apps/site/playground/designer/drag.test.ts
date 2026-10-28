import { EditorState, type TransactionSpec } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import { describe, expect, test } from "vitest";
import { startDrag } from "./drag";
import { designFor } from "./fields";
import { designerHistory } from "./history";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };
const move = { snap: false, pxToDots: 1 };

/** A state with the ZPL, a design of it and the first field selected */
const setup = (zpl: string) => {
  const design = designFor(zpl, options);
  const selection = { keys: [design.labels[0].fields[0].key], label: 0 };
  const state = EditorState.create({
    doc: zpl,
    extensions: [designerHistory()],
  });
  return { design, selection, state };
};

const applied = (state: EditorState, edit: TransactionSpec | undefined) =>
  edit ? state.update(edit).state : state;

describe("startDrag move", () => {
  const zpl = "^XA^FO20,30^GB10,10,10^FS^XZ";

  test("below 3 px it is a click", () => {
    const { design, selection } = setup(zpl);
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 22, y: 31 },
      { kind: "move" }
    );
    const step = drag.moveTo({ x: 24, y: 32 }, move);
    expect(step.started).toBe(false);
    expect(step.edit).toBeUndefined();
    expect(drag.started()).toBe(false);
  });

  test("the threshold is 3 screen px at any zoom", () => {
    const { design, selection } = setup(zpl);
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    );
    expect(
      drag.moveTo({ x: 4, y: 0 }, { snap: false, pxToDots: 2 }).started
    ).toBe(false);
    expect(
      drag.moveTo({ x: 6, y: 0 }, { snap: false, pxToDots: 2 }).started
    ).toBe(true);
  });

  test("past it the edit moves the field", () => {
    const { design, selection, state } = setup(zpl);
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    );
    const step = drag.moveTo({ x: 100, y: 200 }, move);
    expect(step.started).toBe(true);
    expect(step.readout).toBe("^FO120,230");
    expect(applied(state, step.edit).doc.toString()).toBe(
      "^XA^FO120,230^GB10,10,10^FS^XZ"
    );
  });

  test("steps replace each other and make one undo step", () => {
    const { design, selection, state: first } = setup(zpl);
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    );
    let state = first;
    for (const x of [10, 20, 35, 50, 60]) {
      state = applied(state, drag.moveTo({ x, y: x / 2 }, move).edit);
    }
    expect(state.doc.toString()).toBe("^XA^FO80,60^GB10,10,10^FS^XZ");
    let undone = state;
    undo({ state, dispatch: (tr) => (undone = tr.state) });
    expect(undone.doc.toString()).toBe(zpl);
  });

  test("moving back to the start leaves the text as it was", () => {
    const { design, selection, state: first } = setup(zpl);
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    );
    let state = applied(first, drag.moveTo({ x: 50, y: 50 }, move).edit);
    state = applied(state, drag.moveTo({ x: 0, y: 0 }, move).edit);
    expect(state.doc.toString()).toBe(zpl);
    expect(drag.started()).toBe(true);
  });

  test("snaps to another field's left edge, and not with snap off", () => {
    const text = "^XA^FO120,30^GB10,10,10^FS^FO100,100^GB40,40,3^FS^XZ";
    const { design, selection, state } = setup(text);
    // The left edge lands on 104, 4 dots from 100
    const snapped = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: -16, y: 0 }, { snap: true, pxToDots: 1 });
    expect(snapped.dx).toBe(-20);
    expect(snapped.guides).toContainEqual({ axis: "x", at: 100 });
    expect(applied(state, snapped.edit).doc.toString()).toContain("^FO100,30");

    const free = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: -16, y: 0 }, move);
    expect(free.dx).toBe(-16);
    expect(free.guides).toEqual([]);
    expect(applied(state, free.edit).doc.toString()).toContain("^FO104,30");
  });

  test("writes millimeters under ^MUM", () => {
    const { design, selection, state } = setup(
      "^XA^MUM^FO10,5^GB10,10,1^FS^XZ"
    );
    const step = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: 8, y: 4 }, move);
    expect(step.readout).toBe("^FO11,5.5");
    expect(applied(state, step.edit).doc.toString()).toBe(
      "^XA^MUM^FO11,5.5^GB10,10,1^FS^XZ"
    );
  });

  test("on an upside-down label dragging right writes a smaller x", () => {
    const { design, selection, state } = setup(
      "^XA^POI^FO20,30^GB10,10,10^FS^XZ"
    );
    const step = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: 5, y: 0 }, move);
    expect(step.readout).toBe("^FO15,30");
    expect(applied(state, step.edit).doc.toString()).toBe(
      "^XA^POI^FO15,30^GB10,10,10^FS^XZ"
    );
  });
});

describe("startDrag resize", () => {
  const zpl = "^XA^FO10,10^GB100,50,3^FS^XZ";

  test("se writes the new size", () => {
    const { design, selection, state } = setup(zpl);
    const step = startDrag(
      design,
      selection,
      0,
      { x: 110, y: 60 },
      { kind: "resize", handle: "se" }
    ).moveTo({ x: 130, y: 70 }, move);
    expect(step.readout).toBe("^GB120,60,3");
    expect(applied(state, step.edit).doc.toString()).toBe(
      "^XA^FO10,10^GB120,60,3^FS^XZ"
    );
  });

  test("nw also moves the origin", () => {
    const { design, selection, state } = setup(zpl);
    const step = startDrag(
      design,
      selection,
      0,
      { x: 10, y: 10 },
      { kind: "resize", handle: "nw" }
    ).moveTo({ x: 0, y: 0 }, move);
    expect(applied(state, step.edit).doc.toString()).toBe(
      "^XA^FO0,0^GB110,60,3^FS^XZ"
    );
  });
});

describe("startDrag bounds", () => {
  test("a move gives the first field's bounds after the step", () => {
    const { design, selection } = setup("^XA^FO20,30^GB10,10,10^FS^XZ");
    const step = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: 5, y: 7 }, move);
    expect(step.bounds).toEqual({ x: 25, y: 37, width: 10, height: 10 });
  });

  test("a resize gives the resized bounds, keeping text's shape", () => {
    const { design, selection } = setup("^XA^FO10,10^A0N,30,30^FDHi^FS^XZ");
    const old = design.labels[0].fields[0].bounds;
    const step = startDrag(
      design,
      selection,
      0,
      { x: old.x + old.width, y: old.y + old.height },
      { kind: "resize", handle: "se" }
    ).moveTo({ x: old.x + old.width, y: old.y + old.height * 2 }, move);
    expect(step.bounds?.x).toBe(old.x);
    expect(step.bounds?.height).toBeCloseTo(old.height * 2);
    expect(step.bounds?.width).toBeCloseTo(old.width * 2);
  });

  test("below the threshold there are none", () => {
    const { design, selection } = setup("^XA^FO20,30^GB10,10,10^FS^XZ");
    const step = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "move" }
    ).moveTo({ x: 1, y: 0 }, move);
    expect(step.bounds).toBeUndefined();
  });
});

describe("startDrag box", () => {
  test("tracks the threshold but writes nothing", () => {
    const { design, selection } = setup("^XA^FO10,10^GB100,50,3^FS^XZ");
    const drag = startDrag(
      design,
      selection,
      0,
      { x: 0, y: 0 },
      { kind: "box" }
    );
    const step = drag.moveTo({ x: 20, y: 20 }, move);
    expect(step.started).toBe(true);
    expect(step.edit).toBeUndefined();
  });
});
