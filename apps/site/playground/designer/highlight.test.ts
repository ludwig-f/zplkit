import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  highlightField,
  highlightedLines,
  replacesAll,
  setHighlight,
} from "./highlight";

const doc = "^XA\n^FO10,10^FDHi^FS\n^XZ";
const start = (): EditorState =>
  EditorState.create({ doc, extensions: [highlightField()] });

/** Offsets of the second line, ^FO10,10^FDHi^FS */
const line2 = { from: 4, to: 20 };

describe("highlightField", () => {
  it("decorates exactly the line a selected range is on", () => {
    const state = start().update({
      effects: setHighlight.of({ selected: [line2], hovered: [] }),
    }).state;
    expect(highlightedLines(state)).toEqual({ selected: [2], hovered: [] });
  });

  it("decorates every line a range spans", () => {
    const state = start().update({
      effects: setHighlight.of({
        selected: [{ from: 4, to: doc.length }],
        hovered: [],
      }),
    }).state;
    expect(highlightedLines(state).selected).toEqual([2, 3]);
  });

  it("marks hovered lines apart from selected ones", () => {
    const state = start().update({
      effects: setHighlight.of({
        selected: [{ from: 4, to: 6 }],
        hovered: [{ from: 0, to: 2 }],
      }),
    }).state;
    expect(highlightedLines(state)).toEqual({ selected: [2], hovered: [1] });
  });

  it("keeps the highlight on the same text through an edit above", () => {
    let state = start().update({
      effects: setHighlight.of({ selected: [line2], hovered: [] }),
    }).state;
    state = state.update({ changes: { from: 3, insert: "\n^CI28" } }).state;
    expect(state.doc.line(3).text).toBe("^FO10,10^FDHi^FS");
    expect(highlightedLines(state)).toEqual({ selected: [3], hovered: [] });
  });

  it("clears with an empty highlight", () => {
    let state = start().update({
      effects: setHighlight.of({ selected: [line2], hovered: [line2] }),
    }).state;
    state = state.update({
      effects: setHighlight.of({ selected: [], hovered: [] }),
    }).state;
    expect(highlightedLines(state)).toEqual({ selected: [], hovered: [] });
  });

  it("drops the highlight when the whole document is replaced", () => {
    let state = start().update({
      effects: setHighlight.of({ selected: [line2], hovered: [line2] }),
    }).state;
    state = state.update({
      changes: { from: 0, to: doc.length, insert: "^XA\n^FDA^FS\n^XZ" },
    }).state;
    expect(highlightedLines(state)).toEqual({ selected: [], hovered: [] });
  });
});

describe("replacesAll", () => {
  it("is true for a change of the whole document, like a template", () => {
    const tr = start().update({
      changes: { from: 0, to: doc.length, insert: "^XA^XZ" },
    });
    expect(replacesAll(tr.changes)).toBe(true);
  });

  it("is false for an edit inside it, even one that starts at 0", () => {
    const state = start();
    expect(
      replacesAll(
        state.update({ changes: { from: 6, to: 8, insert: "20" } }).changes
      )
    ).toBe(false);
    expect(
      replacesAll(
        state.update({ changes: { from: 0, to: 3, insert: "" } }).changes
      )
    ).toBe(false);
  });
});
