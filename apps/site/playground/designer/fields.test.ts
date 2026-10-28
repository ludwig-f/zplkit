import { describe, expect, test } from "vitest";
import {
  designFor,
  fieldAt,
  fieldAtOffset,
  fieldsIn,
  labelsSharing,
  spansOf,
} from "./fields";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };

describe("fields", () => {
  test("finds the topmost field under a point", () => {
    const { labels } = designFor(
      "^XA^FO10,10^GB100,100,100^FS^FO50,50^GB100,100,100^FS^XZ",
      options
    );
    const [label] = labels;
    expect(fieldAt(label, 60, 60)).toBe(label.fields[1]);
    expect(fieldAt(label, 20, 20)).toBe(label.fields[0]);
    expect(fieldAt(label, 300, 150)).toBeUndefined();
  });

  test("selects empty fields near their position", () => {
    const { labels } = designFor("^XA^FO30,40^A0N,30^FD^FS^XZ", options);
    expect(fieldAt(labels[0], 32, 42)).toBe(labels[0].fields[0]);
  });

  test("finds fields in a selection box", () => {
    const { labels } = designFor(
      "^XA^FO10,10^GB50,50,50^FS^FO150,10^GB50,50,50^FS^FO300,10^GB50,50,50^FS^XZ",
      options
    );
    const found = fieldsIn(labels[0], { x: 0, y: 0, width: 200, height: 200 });
    expect(found).toEqual(labels[0].fields.slice(0, 2));
  });

  test("finds the field the cursor is in", () => {
    const zpl = "^XA\n^FO20,20^A0N,40^FDHi^FS\n^FO20,80^GB100,2,2^FS\n^XZ";
    const design = designFor(zpl, options);
    const [text, box] = design.labels[0].fields;
    expect(fieldAtOffset(design, zpl.indexOf("^FDHi") + 2)).toBe(text);
    expect(fieldAtOffset(design, zpl.indexOf("^GB") + 1)).toBe(box);
    expect(fieldAtOffset(design, 1)).toBeUndefined();
  });

  test("spans are the field's commands", () => {
    const zpl = "^XA\n^FO20,20^A0N,40^FDHi^FS\n^XZ";
    const design = designFor(zpl, options);
    const spans = spansOf(design, design.labels[0].fields[0]);
    const at = (text: string) => {
      const from = zpl.indexOf(text);
      return { from, to: from + text.length };
    };
    expect(spans).toEqual([
      at("^FO20,20"),
      at("^A0N,40"),
      at("^FDHi"),
      at("^FS"),
    ]);
  });

  test("stored format fields are shared", () => {
    const zpl =
      "^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ" +
      "^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDb^FS^XZ";
    const design = designFor(zpl, options);
    expect(labelsSharing(design, 3)).toBe(2);
    const plain = designFor("^XA^FO10,10^GB50,50,50^FS^XZ", options);
    expect(labelsSharing(plain, plain.labels[0].fields[0].key)).toBe(1);
  });
});
