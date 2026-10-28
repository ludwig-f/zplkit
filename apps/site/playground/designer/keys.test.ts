import { EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import { alignEdit, alignedEdges, keyEdit } from "./keys";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };
const plain = { shift: false, mod: false };

const setup = (zpl: string, count = 1) => {
  const design = designFor(zpl, options);
  const keys = design.labels[0].fields.slice(0, count).map((f) => f.key);
  return { design, selection: { keys, label: 0 } };
};

const run = (zpl: string, edit: TransactionSpec | undefined) =>
  EditorState.create({ doc: zpl })
    .update(edit ?? {})
    .state.doc.toString();

describe("keyEdit", () => {
  const zpl = "^XA^FO20,30^GB10,10,10^FS^XZ";

  test("arrows nudge by 1, shift by 10", () => {
    const { design, selection } = setup(zpl);
    expect(
      run(
        zpl,
        keyEdit(design, selection, { key: "ArrowRight", ...plain })?.edit
      )
    ).toBe("^XA^FO21,30^GB10,10,10^FS^XZ");
    expect(
      run(
        zpl,
        keyEdit(design, selection, {
          key: "ArrowRight",
          shift: true,
          mod: false,
        })?.edit
      )
    ).toBe("^XA^FO30,30^GB10,10,10^FS^XZ");
    expect(
      run(zpl, keyEdit(design, selection, { key: "ArrowUp", ...plain })?.edit)
    ).toBe("^XA^FO20,29^GB10,10,10^FS^XZ");
  });

  test("Delete removes the field and clears the selection", () => {
    const { design, selection } = setup(zpl);
    for (const key of ["Delete", "Backspace"]) {
      const result = keyEdit(design, selection, { key, ...plain });
      expect(run(zpl, result?.edit)).toBe("^XA^XZ");
      expect(result?.selection).toEqual({ keys: [], label: 0 });
    }
  });

  test("mod+D duplicates and says where the copy starts", () => {
    const { design, selection } = setup(zpl);
    const result = keyEdit(design, selection, {
      key: "d",
      shift: false,
      mod: true,
    });
    const text = run(zpl, result?.edit);
    expect(text).toBe("^XA^FO20,30^GB10,10,10^FS^FO30,40^GB10,10,10^FS^XZ");
    expect(text.slice(result?.selectAt)).toBe("^FO30,40^GB10,10,10^FS^XZ");
    expect(result?.selection).toBeUndefined();
  });

  test("Escape clears the selection", () => {
    const { design, selection } = setup(zpl);
    expect(keyEdit(design, selection, { key: "Escape", ...plain })).toEqual({
      selection: { keys: [], label: 0 },
    });
  });

  test("Escape with nothing selected is left to the page", () => {
    const { design } = setup(zpl);
    expect(
      keyEdit(design, { keys: [], label: 0 }, { key: "Escape", ...plain })
    ).toBeUndefined();
  });

  test("other keys are not the designer's", () => {
    const { design, selection } = setup(zpl);
    expect(keyEdit(design, selection, { key: "a", ...plain })).toBeUndefined();
  });
});

describe("alignEdit", () => {
  const zpl =
    "^XA^FO10,10^GB20,20,2^FS^FO30,50^GB40,20,2^FS^FO50,90^GB30,20,2^FS^XZ";

  test("left moves the others to the leftmost in one edit", () => {
    const { design, selection } = setup(zpl, 3);
    expect(run(zpl, alignEdit(design, selection, "left"))).toBe(
      "^XA^FO10,10^GB20,20,2^FS^FO10,50^GB40,20,2^FS^FO10,90^GB30,20,2^FS^XZ"
    );
  });

  test("distribute-y evens the gaps", () => {
    const text =
      "^XA^FO0,0^GB10,10,1^FS^FO0,20^GB10,10,1^FS^FO0,90^GB10,10,1^FS^XZ";
    const { design, selection } = setup(text, 3);
    expect(run(text, alignEdit(design, selection, "distribute-y"))).toBe(
      "^XA^FO0,0^GB10,10,1^FS^FO0,45^GB10,10,1^FS^FO0,90^GB10,10,1^FS^XZ"
    );
  });
});

describe("alignedEdges", () => {
  test("lists the edges the fields already share", () => {
    const text = "^XA^FO10,10^GB20,20,2^FS^FO10,50^GB40,20,2^FS^XZ";
    const { design, selection } = setup(text, 2);
    expect(alignedEdges(design, selection)).toEqual(["left"]);
  });

  test("none for one field or fields that line up nowhere", () => {
    const text = "^XA^FO10,10^GB20,20,2^FS^FO15,50^GB40,30,2^FS^XZ";
    const one = setup(text, 1);
    expect(alignedEdges(one.design, one.selection)).toEqual([]);
    const { design, selection } = setup(text, 2);
    expect(alignedEdges(design, selection)).toEqual([]);
  });
});
