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

  test("adds to the right label", () => {
    const zpl = "^XA^FO1,1^GB10,10,10^FS^XZ^XA^FO2,2^GB10,10,10^FS^XZ";
    const design = designFor(zpl, options);
    expect(apply(zpl, addField(design, 1, "box", 5, 6))).toBe(
      "^XA^FO1,1^GB10,10,10^FS^XZ^XA^FO2,2^GB10,10,10^FS^FO5,6^GB120,60,3^FS^XZ"
    );
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

  test("won't delete a field without a position", () => {
    const design = designFor("^XA^CF0,30^FDHi^FS^XZ", options);
    expect(canRemove(design.labels[0].fields[0], design)).toBe(false);
  });
});
