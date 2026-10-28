import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import { moveFields } from "./move";
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

/** Move every field on the first label */
const moveAll = (zpl: string, dx: number, dy: number) => {
  const design = designFor(zpl, options);
  const keys = design.labels[0].fields.map(({ key }) => key);
  const changes = moveFields(design, keys, dx, dy);
  return { changes, result: apply(zpl, changes) };
};

describe("moveFields", () => {
  test("moves a field's ^FO", () => {
    expect(moveAll("^XA^FO20,30^GB10,10,10^FS^XZ", 5, -10).result).toBe(
      "^XA^FO25,20^GB10,10,10^FS^XZ"
    );
  });

  test("moves a ^FT field", () => {
    expect(moveAll("^XA^FT20,60^A0N,40^FDHi^FS^XZ", 10, 10).result).toBe(
      "^XA^FT30,70^A0N,40^FDHi^FS^XZ"
    );
  });

  test("moves several fields at once", () => {
    const { changes, result } = moveAll(
      "^XA^FO10,10^GB10,10,10^FS^FO50,50^GB10,10,10^FS^XZ",
      1,
      1
    );
    expect(changes).toHaveLength(2);
    expect(changes[0].from).toBeLessThan(changes[1].from);
    expect(result).toBe("^XA^FO11,11^GB10,10,10^FS^FO51,51^GB10,10,10^FS^XZ");
  });

  test("writes millimeters with ^MU", () => {
    expect(moveAll("^XA^MUM^FO10,5^GB10,10,1^FS^XZ", 8, 4).result).toBe(
      "^XA^MUM^FO11,5.5^GB10,10,1^FS^XZ"
    );
  });

  test("moves upside-down labels the way the screen shows", () => {
    expect(moveAll("^XA^POI^FO20,30^GB10,10,10^FS^XZ", 5, 5).result).toBe(
      "^XA^POI^FO15,25^GB10,10,10^FS^XZ"
    );
    expect(moveAll("^XA^PMY^FO20,30^GB10,10,10^FS^XZ", 5, 5).result).toBe(
      "^XA^PMY^FO15,35^GB10,10,10^FS^XZ"
    );
  });

  test("adds a ^FO to a field without one", () => {
    expect(moveAll("^XA^GB10,10,10^FS^XZ", 12, 8).result).toBe(
      "^XA^FO12,8^GB10,10,10^FS^XZ"
    );
  });

  test("moves a stored format's field once", () => {
    const zpl =
      "^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ" +
      "^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDb^FS^XZ";
    const design = designFor(zpl, options);
    const changes = moveFields(design, [3], 5, 0);
    expect(changes).toHaveLength(1);
    expect(apply(zpl, changes)).toContain("^DFR:BOX.ZPL^FS^FO15,10^A0N,30");
  });

  test("leaves everything else as written", () => {
    const zpl = "^XA\n^FO 20,30 ^GB10,10,10^FS\n^XZ";
    const { changes, result } = moveAll(zpl, 1, 0);
    expect(changes).toEqual([{ from: 8, to: 10, insert: "21" }]);
    expect(result).toBe("^XA\n^FO 21,30 ^GB10,10,10^FS\n^XZ");
  });
});
