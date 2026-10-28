"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  ChangeSet,
  EditorState,
  type TransactionSpec,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from "@codemirror/view";
import {
  defaultKeymap,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from "@codemirror/commands";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { zplHighlighting, zplLanguage } from "./zpl-language";
import { tsxLanguage } from "./tsx-language";
import { designerHistory } from "./designer/history";
import {
  highlightField,
  setHighlight,
  type Highlight,
} from "./designer/highlight";

/** A problem to underline, as offsets in the text */
type EditorProblem = {
  from: number;
  to: number;
  severity: "error" | "warning";
  message: string;
};

type EditorHandle = {
  /** Select a range and scroll it into view */
  select: (from: number, to: number) => void;
  /** Dispatch a transaction as is, keeping the selection and history */
  apply: (spec: TransactionSpec) => void;
  /** Set which lines are drawn as selected and hovered */
  highlight: (highlight: Highlight) => void;
  /** Undo or redo the latest edit, as the editor's own keys do */
  undo: () => void;
  redo: () => void;
};

type EditorProps = {
  value: string;
  problems: EditorProblem[];
  /**
   * Called with the new text and the change that made it. Handlers must not
   * dispatch to the editor synchronously (CodeMirror throws during an
   * update); schedule with queueMicrotask if needed.
   */
  onChange: (value: string, changes: ChangeSet) => void;
  /**
   * Called with the cursor's offset after a selection the person made. Like
   * onChange, it must not dispatch to the editor synchronously (CodeMirror
   * throws during an update); use queueMicrotask if needed.
   */
  onCursor?: (offset: number) => void;
  /**
   * What's being edited: ZPL, or zplkit code in TypeScript and JSX
   * @defaultValue "zpl"
   */
  language?: "zpl" | "tsx";
};

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "var(--panel)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-code)", lineHeight: "1.65" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--accent)" },
  ".cm-gutters": {
    backgroundColor: "var(--panel)",
    color: "var(--muted)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": {
    backgroundColor: "var(--active-line)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection) !important",
  },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--warn) 1.5px",
    textUnderlineOffset: "4px",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--error) 1.5px",
    textUnderlineOffset: "4px",
  },
  // Diamonds for warnings and squares for errors, as in the problems list
  ".cm-lint-marker": {
    width: "8px",
    height: "8px",
    margin: "0 4px",
    content: "''",
  },
  ".cm-lint-marker-warning": {
    content: "''",
    backgroundColor: "var(--warn)",
    transform: "rotate(45deg) scale(0.85)",
  },
  ".cm-lint-marker-error": {
    content: "''",
    backgroundColor: "var(--error)",
  },
  ".cm-hl-selected": { backgroundColor: "var(--zk-view-soft)" },
  ".cm-hl-hovered": {
    backgroundColor: "color-mix(in srgb, var(--zk-view-soft) 50%, transparent)",
  },
  ".cm-hl-gutter": { width: "3px", marginRight: "4px" },
  ".cm-hl-bar": { height: "100%", backgroundColor: "var(--zk-view)" },
  ".cm-hl-selected-gutter.cm-lineNumbers, .cm-lineNumbers .cm-hl-selected-gutter":
    { color: "var(--zk-view)", fontWeight: "600" },
  ".cm-tooltip": {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
  },
});

/** CodeMirror editor for ZPL or zplkit code, showing problems as underlines */
const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, problems, onChange, onCursor, language = "zpl" },
  ref
) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;
  /**
   * The latest texts this editor reported, which the sync effect must not
   * undo. This relies on the parent feeding `value` back from onChange: once
   * the value catches up with the document the list is cleared. It's capped
   * so texts the parent never echoes (it may skip some mid-drag) can't pile
   * up, and a long-gone text coming back from outside is applied again.
   */
  const emitted = useRef<string[]>([]);

  useEffect(() => {
    view.current = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          designerHistory(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          // Code keeps its indentation readable without wrapping
          ...(language === "zpl"
            ? [
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ "aria-label": "ZPL" }),
                zplLanguage,
                zplHighlighting,
                highlightField(),
              ]
            : [
                EditorView.contentAttributes.of({ "aria-label": "Code" }),
                // Tab indents; Escape, then Tab, moves focus on
                keymap.of([indentWithTab]),
                tsxLanguage,
              ]),
          lintGutter(),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const changes = update.transactions.reduce(
                (all, tr) => all.compose(tr.changes),
                ChangeSet.empty(update.startState.doc.length)
              );
              const text = update.state.doc.toString();
              emitted.current = [...emitted.current, text].slice(-8);
              onChangeRef.current(text, changes);
            }
            // Only selections the person made, not edits or apply()
            if (
              update.selectionSet &&
              update.transactions.some((tr) => tr.isUserEvent("select"))
            ) {
              onCursorRef.current?.(update.state.selection.main.head);
            }
          }),
        ],
      }),
    });

    return () => view.current?.destroy();
    // The editor is created once; later values are synced below
  }, []);

  // Replace the text when it changes from outside, e.g. picking an example.
  // Texts the editor reported itself are skipped: a passive effect can run
  // after apply() has moved on, and replacing the document then would undo it.
  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const own = emitted.current.includes(value);
    // A stale value this editor reported itself, e.g. mid-drag, is not news
    if (current.state.doc.toString() === value) emitted.current = [];
    else if (!own) {
      emitted.current = [];
      current.dispatch({
        changes: { from: 0, to: current.state.doc.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const length = current.state.doc.length;

    current.dispatch(
      setDiagnostics(
        current.state,
        problems
          .filter((problem) => problem.to <= length)
          .map((problem) => ({
            from: problem.from,
            to: problem.to,
            severity: problem.severity,
            message: problem.message,
          }))
      )
    );
  }, [problems]);

  useImperativeHandle(ref, () => ({
    select(from, to) {
      const current = view.current;
      if (!current) return;
      current.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true,
      });
      current.focus();
    },
    apply(spec) {
      view.current?.dispatch(spec);
    },
    highlight(highlight) {
      view.current?.dispatch({ effects: setHighlight.of(highlight) });
    },
    undo() {
      if (view.current) undo(view.current);
    },
    redo() {
      if (view.current) redo(view.current);
    },
  }));

  return <div className="editor" ref={container} />;
});

export type { EditorHandle, EditorProblem };
export default Editor;
