import { describe, expect, test } from "vitest";
import { designFor } from "./fields";
import { resizeField, resizeHandles } from "./resize";
import type { TextChange } from "@zplkit/core/internal";
import type { Rect } from "@zplkit/render/internal";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };

/** Apply changes from the end, so earlier offsets stay valid */
const apply = (zpl: string, changes: TextChange[]): string =>
  [...changes]
    .sort((a, b) => b.from - a.from)
    .reduce(
      (text, c) => text.slice(0, c.from) + c.insert + text.slice(c.to),
      zpl
    );

/** Resize the first field on the first label, giving it its bounds to change */
const resize = (zpl: string, change: (bounds: Rect) => Rect): string => {
  const design = designFor(zpl, options);
  const field = design.labels[0].fields[0];
  return apply(zpl, resizeField(design, field.key, change(field.bounds)));
};

describe("resizeField", () => {
  test("resizes a box", () => {
    expect(
      resize("^XA^FO10,10^GB100,50,3^FS^XZ", () => ({
        x: 10,
        y: 10,
        width: 120,
        height: 60,
      }))
    ).toBe("^XA^FO10,10^GB120,60,3^FS^XZ");
  });

  test("moves a box resized from its top left", () => {
    expect(
      resize("^XA^FO10,10^GB100,50,3^FS^XZ", () => ({
        x: 0,
        y: 0,
        width: 110,
        height: 60,
      }))
    ).toBe("^XA^FO0,0^GB110,60,3^FS^XZ");
  });

  test("resizes text by its height", () => {
    expect(
      resize("^XA^FO10,10^A0N,40,30^FDHi^FS^XZ", (b) => ({
        ...b,
        width: b.width * 2,
        height: b.height * 2,
      }))
    ).toBe("^XA^FO10,10^A0N,80,60^FDHi^FS^XZ");
  });

  test("moves a ^FT field resized downward", () => {
    expect(
      resize("^XA^FT10,60^A0N,40,30^FDHi^FS^XZ", (b) => ({
        ...b,
        height: b.height + 20,
      }))
    ).toMatch(/^\^XA\^FT10,80\^A0N,\d+,\d+\^FDHi/);
  });

  test("text doesn't shrink below 10 dots", () => {
    expect(
      resize("^XA^FO10,10^A0N,40,30^FDHi^FS^XZ", (b) => ({
        ...b,
        width: 1,
        height: 1,
      }))
    ).toBe("^XA^FO10,10^A0N,10,10^FDHi^FS^XZ");
  });

  test("text without its own font doesn't resize", () => {
    const design = designFor("^XA^CF0,40^FO10,10^FDHi^FS^XZ", options);
    const field = design.labels[0].fields[0];
    expect(resizeHandles(design, field)).toBe("none");
    expect(resizeField(design, field.key, field.bounds)).toEqual([]);
  });

  test("resizes a QR code by its magnification", () => {
    expect(
      resize("^XA^FO10,10^BQN,2,4^FDQA,hi^FS^XZ", (b) => ({
        ...b,
        width: b.width * 1.5,
        height: b.height * 1.5,
      }))
    ).toBe("^XA^FO10,10^BQN,2,6^FDQA,hi^FS^XZ");
  });

  test("barcodes only get taller", () => {
    expect(
      resize("^XA^FO10,10^BCN,60^FD123^FS^XZ", (b) => ({
        ...b,
        height: b.height + 20,
      }))
    ).toBe("^XA^FO10,10^BCN,80^FD123^FS^XZ");
  });

  test("writes sizes in ^MU units", () => {
    expect(
      resize("^XA^MUM^FO1,1^GB10,5,1^FS^XZ", (b) => ({
        ...b,
        width: b.width + 16,
      }))
    ).toBe("^XA^MUM^FO1,1^GB12,5,1^FS^XZ");
  });
});

describe("resizeHandles", () => {
  test("gives each kind of field its handles", () => {
    const handles = (zpl: string) => {
      const design = designFor(zpl, options);
      return resizeHandles(design, design.labels[0].fields[0]);
    };
    expect(handles("^XA^FO10,10^GB100,50,3^FS^XZ")).toBe("corners");
    expect(handles("^XA^FO10,10^GC40,3^FS^XZ")).toBe("proportional");
    expect(handles("^XA^FO10,10^BCN,60^FD1^FS^XZ")).toBe("corners");
    expect(handles("^XA^FO10,10^BQN,2,4^FDQA,1^FS^XZ")).toBe("proportional");
  });
});
