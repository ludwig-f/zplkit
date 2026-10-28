import { history, isolateHistory } from "@codemirror/commands";
import {
  Annotation,
  StateField,
  Transaction,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";
import type { TextChange } from "@zplkit/core/internal";

/** The drag a transaction belongs to */
const dragId = Annotation.define<number>();

/** The drag of the latest transaction that changed the document */
const lastDrag = StateField.define<number | undefined>({
  create: () => undefined,
  update: (value, tr) => (tr.docChanged ? tr.annotation(dragId) : value),
});

/**
 * The editor's history, joining each drag into one undo step. Anything else
 * joins as CodeMirror's default does.
 */
const designerHistory = (): Extension => [
  lastDrag,
  history({
    joinToEvent: (tr, adjacent) => {
      const previous = tr.startState.field(lastDrag, false);
      const drag = tr.annotation(dragId);
      if (drag !== undefined || previous !== undefined)
        return drag === previous;
      return adjacent;
    },
  }),
];

/**
 * A transaction applying designer changes. `drag` names the drag it belongs
 * to; transactions with the same drag join one undo step, and a new drag
 * starts a new one.
 */
const designerEdit = (
  changes: TextChange[],
  options: { drag?: number }
): TransactionSpec => {
  const { drag } = options;
  if (drag === undefined) {
    // Each edit without a drag is its own step
    return { changes, annotations: [isolateHistory.of("full")] };
  }
  return {
    changes,
    // A fixed time, so a pause mid-drag never splits the step
    annotations: [dragId.of(drag), Transaction.time.of(0)],
  };
};

export { designerEdit, designerHistory };
