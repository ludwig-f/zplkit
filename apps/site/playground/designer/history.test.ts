import { EditorState } from "@codemirror/state";
import { undo } from "@codemirror/commands";
import { describe, expect, it, vi } from "vitest";
import { designerEdit, designerHistory } from "./history";

const start = (doc: string): EditorState =>
  EditorState.create({ doc, extensions: [designerHistory()] });

const undoOnce = (state: EditorState): EditorState => {
  let next = state;
  undo({ state, dispatch: (tr) => (next = tr.state) });
  return next;
};

/** Move the first number of ^FO by one dot, as a drag step does */
const step = (state: EditorState, drag?: number): EditorState => {
  const text = state.doc.toString();
  const at = text.indexOf("^FO") + 3;
  const end = at + String(parseInt(text.slice(at), 10)).length;
  const value = parseInt(text.slice(at), 10) + 1;
  return state.update(
    designerEdit([{ from: at, to: end, insert: String(value) }], { drag })
  ).state;
};

const type = (state: EditorState, insert: string): EditorState =>
  state.update({
    changes: { from: state.doc.length, insert },
    userEvent: "input.type",
  }).state;

describe("designerHistory", () => {
  it("a drag is one undo step", () => {
    let state = start("^FO20,30");
    for (let i = 0; i < 5; i++) state = step(state, 1);
    expect(state.doc.toString()).toBe("^FO25,30");
    expect(undoOnce(state).doc.toString()).toBe("^FO20,30");
  });

  it("typing and a drag undo separately", () => {
    let state = type(start("^FO20,30"), "X");
    state = step(step(state, 1), 1);
    expect(state.doc.toString()).toBe("^FO22,30X");
    state = undoOnce(state);
    expect(state.doc.toString()).toBe("^FO20,30X");
  });

  it("typing after a drag does not join the drag", () => {
    let state = step(step(start("^FO20,30"), 1), 1);
    state = type(state, "X");
    expect(undoOnce(state).doc.toString()).toBe("^FO22,30");
  });

  it("two drags undo separately", () => {
    let state = start("^FO20,30");
    state = step(step(state, 1), 1);
    state = step(step(state, 2), 2);
    expect(state.doc.toString()).toBe("^FO24,30");
    expect(undoOnce(state).doc.toString()).toBe("^FO22,30");
  });

  it("a nudge is its own step", () => {
    let state = start("^FO20,30");
    state = step(step(state));
    expect(state.doc.toString()).toBe("^FO22,30");
    expect(undoOnce(state).doc.toString()).toBe("^FO21,30");
  });

  it("one drag stays one step however long it takes", () => {
    vi.useFakeTimers();
    try {
      let state = start("^FO20,30");
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(2000);
        state = step(state, 1);
      }
      expect(undoOnce(state).doc.toString()).toBe("^FO20,30");
    } finally {
      vi.useRealTimers();
    }
  });

  it("typing still groups and undoes as before", () => {
    let state = start("A");
    for (const ch of "bcd") state = type(state, ch);
    expect(state.doc.toString()).toBe("Abcd");
    expect(undoOnce(state).doc.toString()).toBe("A");
  });

  it("a drag that moves the selection is still one undo step", () => {
    let state = start("^FO20,30");
    for (let i = 0; i < 2; i++) {
      const text = state.doc.toString();
      const at = text.indexOf("^FO") + 3;
      const value = parseInt(text.slice(at), 10);
      state = state.update(
        designerEdit(
          [{ from: at, to: at + String(value).length, insert: `${value + 1}` }],
          { drag: 1, selection: { anchor: 0, head: 3 } }
        )
      ).state;
    }
    expect(state.doc.toString()).toBe("^FO22,30");
    expect(state.selection.main).toMatchObject({ anchor: 0, head: 3 });
    expect(undoOnce(state).doc.toString()).toBe("^FO20,30");
  });
});

describe("designerEdit dispatched through a state, as the editor's apply does", () => {
  it("keeps one undo step for a two-step drag", () => {
    let state = start("^FO20,30");
    state = step(step(state, 7), 7);
    expect(state.doc.toString()).toBe("^FO22,30");
    expect(undoOnce(state).doc.toString()).toBe("^FO20,30");
  });
});
