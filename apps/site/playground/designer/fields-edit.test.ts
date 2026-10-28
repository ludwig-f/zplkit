import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import {
  addField,
  canRemove,
  deleteFields,
  duplicateFields,
  pasteField,
} from "./fields-edit";
import type { TextChange } from "@zplkit/core/internal";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };

/** Apply changes from the end, so earlier offsets stay valid */
const apply = (zpl: string, changes: TextChange[]): string =>
  [...changes]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (text, c) => text.slice(0, c.from) + c.insert + text.slice(c.to),
      zpl
    );

describe("addField", () => {
  test("adds text before ^XZ", () => {
    const zpl = "^XA\n^FO10,10^GB10,10,10^FS\n^XZ";
    const design = designFor(zpl, options);
    expect(apply(zpl, addField(design, 0, "text", 40, 50))).toBe(
      "^XA\n^FO10,10^GB10,10,10^FS\n^FO40,50^A0N,30^FDText^FS\n^XZ"
    );
  });

  test("adds to the recalling label, not the stored format", () => {
    const zpl =
      "^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ";
    const design = designFor(zpl, options);
    const [change] = addField(design, 0, "box", 5, 6);
    expect(change.from).toBe(zpl.lastIndexOf("^XZ"));
  });

  test("adds to the right label", () => {
    const zpl = "^XA^FO1,1^GB10,10,10^FS^XZ^XA^FO2,2^GB10,10,10^FS^XZ";
    const design = designFor(zpl, options);
    expect(apply(zpl, addField(design, 1, "box", 5, 6))).toBe(
      "^XA^FO1,1^GB10,10,10^FS^XZ^XA^FO2,2^GB10,10,10^FS^FO5,6^GB120,60,3^FS^XZ"
    );
  });

  test("sizes new fields in dots, written in the label's ^MU units", () => {
    const zpl = "^XA^MUM^XZ";
    const design = designFor(zpl, options);
    const box = apply(zpl, addField(design, 0, "box", 80, 80));
    expect(box).toBe("^XA^MUM^FO10,10^GB15,7.5,0.38^FS^XZ");
    expect(designFor(box, options).labels[0].fields[0].bounds).toEqual({
      x: 80,
      y: 80,
      width: 120,
      height: 60,
    });
    expect(apply(zpl, addField(design, 0, "text", 80, 80))).toBe(
      "^XA^MUM^FO10,10^A0N,3.75^FDText^FS^XZ"
    );
    expect(apply(zpl, addField(design, 0, "code128", 80, 80))).toBe(
      "^XA^MUM^FO10,10^BCN,7.5^FD12345678^FS^XZ"
    );
    expect(apply(zpl, addField(design, 0, "qr", 80, 80))).toBe(
      "^XA^MUM^FO10,10^BQN,2,4^FDQA,https://zplkit.fingal.dev^FS^XZ"
    );
  });

  test("writes whole dots", () => {
    const zpl = "^XA^XZ";
    const design = designFor(zpl, options);
    expect(apply(zpl, addField(design, 0, "box", 40.6, 50.2))).toBe(
      "^XA^FO41,50^GB120,60,3^FS^XZ"
    );
  });

  test("won't add after a ^CD changed the delimiter", () => {
    const design = designFor("^XA^CD|^XZ", options);
    expect(addField(design, 0, "text", 10, 10)).toEqual([]);
  });
});

describe("pasteField", () => {
  test("pastes a field where it's dropped", () => {
    const zpl = "^XA^XZ";
    const design = designFor(zpl, options);
    expect(
      apply(zpl, pasteField(design, 0, "^FO0,0^A0N,30^FDHi^FS", 40, 50))
    ).toBe("^XA^FO40,50^A0N,30^FDHi^FS^XZ");
  });

  test("moves only the position on labels in other units", () => {
    const zpl = "^XA^MUM^XZ";
    const design = designFor(zpl, options);
    expect(
      apply(zpl, pasteField(design, 0, "^FO0,0^GB80,40,3^FS", 80, 80))
    ).toBe("^XA^MUM^FO10,10^GB80,40,3^FS^XZ");
  });

  test("won't paste whole labels", () => {
    const design = designFor("^XA^XZ", options);
    expect(pasteField(design, 0, "^XA^FO0,0^GB10,10,10^FS^XZ", 10, 10)).toEqual(
      []
    );
    expect(pasteField(design, 0, "^FO0,0^GB10,10,10^FS^XZ", 10, 10)).toEqual(
      []
    );
  });

  test("won't paste after a ^CD changed the delimiter", () => {
    const design = designFor("^XA^CD|^XZ", options);
    expect(pasteField(design, 0, "^FO0,0^FDHi^FS", 10, 10)).toEqual([]);
  });

  test("won't paste where the prefix isn't ^", () => {
    const design = designFor("^XA^CC#\n#XZ", options);
    expect(pasteField(design, 0, "^FO0,0^FDHi^FS", 10, 10)).toEqual([]);
  });

  test("won't paste a changed prefix or delimiter", () => {
    const design = designFor("^XA^XZ", options);
    for (const pasted of ["^CD|^FO0,0^FDHi^FS", "^CC#\n#FO0,0#FS"]) {
      expect(pasteField(design, 0, pasted, 10, 10)).toEqual([]);
    }
  });

  test("never throws", () => {
    const design = designFor("^XA^XZ", options);
    for (const pasted of ["", "^", "^FT", "^FO,", "^FO0,0^FS^FS"]) {
      expect(() => pasteField(design, 0, pasted, 10, 10)).not.toThrow();
    }
  });
});

describe("duplicateFields", () => {
  test("duplicates a field next to itself", () => {
    const zpl = "^XA^FO10,10^GB10,10,10^FS^XZ";
    const design = designFor(zpl, options);
    const key = design.labels[0].fields[0].key;
    expect(apply(zpl, duplicateFields(design, [key]))).toBe(
      "^XA^FO10,10^GB10,10,10^FS^FO20,20^GB10,10,10^FS^XZ"
    );
  });

  test("fills in a ^FT's missing values", () => {
    const zpl = "^XA^FT,60^A0N,30^FDb^FS^XZ";
    const design = designFor(zpl, options);
    const key = design.labels[0].fields[0].key;
    expect(apply(zpl, duplicateFields(design, [key]))).toBe(
      "^XA^FT,60^A0N,30^FDb^FS^FT10,70^A0N,30^FDb^FS^XZ"
    );
  });
});

describe("deleteFields", () => {
  test("deletes a field and nothing else", () => {
    const zpl = "^XA^BY3^FO10,10^BCN,60^FD1^FS^FO10,90^BCN,60^FD2^FS^XZ";
    const design = designFor(zpl, options);
    const key = design.labels[0].fields[0].key;
    expect(apply(zpl, deleteFields(design, [key]))).toBe(
      "^XA^BY3^FO10,90^BCN,60^FD2^FS^XZ"
    );
  });

  test("keeps settings later fields use", () => {
    const zpl = "^XA^FO10,10^BY3^BCN,60^FD1^FS^FO10,90^BCN,60^FD2^FS^XZ";
    const design = designFor(zpl, options);
    const key = design.labels[0].fields[0].key;
    expect(apply(zpl, deleteFields(design, [key]))).toBe(
      "^XA^BY3^FO10,90^BCN,60^FD2^FS^XZ"
    );

    const font = "^XA^FO10,10^CF0,40^FDa^FS^FO10,60^FDb^FS^XZ";
    const fontDesign = designFor(font, options);
    const first = fontDesign.labels[0].fields[0].key;
    expect(apply(font, deleteFields(fontDesign, [first]))).toBe(
      "^XA^CF0,40^FO10,60^FDb^FS^XZ"
    );
  });

  test("deletes the field's own modifiers and comments", () => {
    const zpl = "^XA\n^FO10,10^FR^FXnote^GB10,10,10^FS\n^XZ";
    const design = designFor(zpl, options);
    const key = design.labels[0].fields[0].key;
    expect(apply(zpl, deleteFields(design, [key]))).toBe("^XA\n\n^XZ");
  });

  test("won't delete a field without a position", () => {
    const design = designFor("^XA^CF0,30^FDHi^FS^XZ", options);
    expect(canRemove(design.labels[0].fields[0], design)).toBe(false);
  });

  test("won't delete a stored format's field filled by another label", () => {
    const design = designFor(
      "^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ",
      options
    );
    expect(canRemove(design.labels[0].fields[0], design)).toBe(false);
  });
});
