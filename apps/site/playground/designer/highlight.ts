import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type Range,
  type Transaction,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  lineNumberMarkers,
} from "@codemirror/view";

/** The ranges to highlight, as offsets in the text */
type Highlight = {
  selected: { from: number; to: number }[];
  hovered: { from: number; to: number }[];
};

/** An effect setting what's highlighted */
const setHighlight = StateEffect.define<Highlight>();

const selectedLine = Decoration.line({ class: "cm-hl-selected" });
const hoveredLine = Decoration.line({ class: "cm-hl-hovered" });

class BarMarker extends GutterMarker {
  elementClass = "cm-hl-selected-gutter";
  toDOM() {
    const bar = document.createElement("div");
    bar.className = "cm-hl-bar";
    return bar;
  }
}
const bar = new BarMarker();

/** Whether a transaction replaces the whole document in one change */
const replacesAll = (tr: Transaction) => {
  let all = false;
  tr.changes.iterChanges((from, to) => {
    if (from === 0 && to === tr.startState.doc.length) all = true;
  });
  return all;
};

/** The highlighted ranges, kept in place through edits */
const highlightState = StateField.define<Highlight>({
  create: () => ({ selected: [], hovered: [] }),
  update: (value, tr) => {
    let next = value;
    if (tr.docChanged && replacesAll(tr)) {
      // A new document, not an edit: nothing to keep in place
      next = { selected: [], hovered: [] };
    } else if (tr.docChanged) {
      const length = tr.newDoc.length;
      const map = (ranges: Highlight["selected"]) =>
        ranges
          .map(({ from, to }) => {
            const start = tr.changes.mapPos(from, 1);
            return {
              from: start,
              to: Math.max(start, tr.changes.mapPos(to, -1)),
            };
          })
          .filter(({ from }) => from <= length);
      next = { selected: map(value.selected), hovered: map(value.hovered) };
    }
    for (const effect of tr.effects)
      if (effect.is(setHighlight)) next = effect.value;
    return next;
  },
});

/** The numbers of the lines the ranges touch, in order */
const linesOf = (state: EditorState, ranges: Highlight["selected"]) => {
  const lines = new Set<number>();
  for (const { from, to } of ranges) {
    const length = state.doc.length;
    const first = state.doc.lineAt(Math.min(from, length)).number;
    const last = state.doc.lineAt(Math.min(to, length)).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return [...lines].sort((a, b) => a - b);
};

/** The line numbers currently highlighted, selected winning over hovered */
const highlightedLines = (state: EditorState) => {
  const value = state.field(highlightState);
  const selected = linesOf(state, value.selected);
  const hovered = linesOf(state, value.hovered).filter(
    (n) => !selected.includes(n)
  );
  return { selected, hovered };
};

const lineDecorations = (state: EditorState) => {
  const { selected, hovered } = highlightedLines(state);
  const ranges: Range<Decoration>[] = [
    ...selected.map((n) => selectedLine.range(state.doc.line(n).from)),
    ...hovered.map((n) => hoveredLine.range(state.doc.line(n).from)),
  ];
  return Decoration.set(ranges, true);
};

const markers = (state: EditorState) =>
  RangeSet.of(
    highlightedLines(state).selected.map((n) =>
      bar.range(state.doc.line(n).from)
    ),
    true
  );

/**
 * The extension that draws highlighted lines: a teal gutter bar and tint for
 * selected, a lighter tint for hovered
 */
const highlightField = (): Extension => [
  highlightState,
  EditorView.decorations.compute([highlightState, "doc"], lineDecorations),
  gutter({
    class: "cm-hl-gutter",
    markers: (view) => markers(view.state),
    initialSpacer: () => bar,
  }),
  lineNumberMarkers.compute([highlightState, "doc"], markers),
];

export { highlightField, highlightedLines, setHighlight };
export type { Highlight };
