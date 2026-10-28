import { describe, expect, test } from "vitest";
import { parse } from "@zplkit/core";
import { designLabels } from "./design.js";
import { renderLabels } from "./render.js";

const options = { widthMm: 50, heightMm: 25, dpmm: 8 };
const design = (zpl: string) => designLabels(parse(zpl).commands, options);

describe("designLabels", () => {
  test("a box's bounds are its own", () => {
    const [label] = design("^XA^FO100,50^GB200,80,4^FS^XZ");
    expect(label.fields).toHaveLength(1);
    expect(label.fields[0]).toMatchObject({
      key: 1,
      kind: "box",
      bounds: { x: 100, y: 50, width: 200, height: 80 },
      drawn: true,
    });
  });

  test("text is measured where its ink is", () => {
    const zpl = "^XA^FO20,20^A0N,40^FDHi^FS^XZ";
    const [label] = design(zpl);
    expect(label.fields).toHaveLength(1);
    const { kind, bounds } = label.fields[0];
    expect(kind).toBe("text");

    // The box around the dots the renderer draws, which can start a little
    // above or left of the field's position
    const [raster] = renderLabels(parse(zpl).commands, options);
    const dots = Array.from(raster.ink, (ink, i) => ({
      ink,
      x: i % raster.width,
      y: Math.floor(i / raster.width),
    })).filter((dot) => dot.ink > 0);
    const xs = dots.map((dot) => dot.x);
    const ys = dots.map((dot) => dot.y);
    expect(bounds).toEqual({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs) + 1,
      height: Math.max(...ys) - Math.min(...ys) + 1,
    });
    expect(bounds.x).toBeGreaterThanOrEqual(15);
    expect(bounds.y).toBeGreaterThanOrEqual(15);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(80);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(60);
  });

  test("a field's elements share one field", () => {
    const [label] = design("^XA^FO20,20^BCN,60,Y^FD123^FS^XZ");
    expect(label.fields).toHaveLength(1);
    const { bounds } = label.fields[0];
    expect(bounds.x).toBe(20);
    expect(bounds.y).toBe(20);
    // The bars are 60 dots tall, so the text below them adds to it
    expect(bounds.height).toBeGreaterThan(60);
  });

  test("bounds follow a centered print width", () => {
    const [label] = design("^XA^PW200^FO0,0^GB50,50,50^FS^XZ");
    expect(label.fields[0].bounds).toEqual({
      x: 100,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  test("bounds follow an upside-down label", () => {
    const [label] = design("^XA^POI^FO0,0^GB50,50,50^FS^XZ");
    expect(label.inverted).toBe(true);
    expect(label.fields[0].bounds).toEqual({
      x: 350,
      y: 150,
      width: 50,
      height: 50,
    });
  });

  test("bounds follow a mirrored label", () => {
    const [label] = design("^XA^PMY^FO0,0^GB50,50,50^FS^XZ");
    expect(label.mirrored).toBe(true);
    expect(label.fields[0].bounds).toEqual({
      x: 350,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  test("each label has its fields", () => {
    const labels = design(
      "^XA^FO0,0^GB10,10,10^FS^XZ^XA^FO20,0^GB10,10,10^FS^XZ"
    );
    expect(labels).toHaveLength(2);
    expect(labels.map((label) => label.fields.length)).toEqual([1, 1]);
    expect(labels[0]).toMatchObject({ width: 400, height: 200 });
  });

  test("copies share a key", () => {
    const labels = design("^XA^FO0,0^A0N,30^SN001,1,Y^FS^PQ2^XZ");
    expect(labels).toHaveLength(2);
    expect(labels[0].fields[0].key).toBe(labels[1].fields[0].key);
  });

  test("stored format fields keep the format's key", () => {
    const zpl =
      "^XA^DFR:BOX.ZPL^FS^FO10,10^A0N,30^FN1^FS^XZ" +
      "^XA^XFR:BOX.ZPL^FN1^FDa^FS^XZ^XA^XFR:BOX.ZPL^FN1^FDb^FS^XZ";
    const labels = design(zpl);
    expect(labels).toHaveLength(2);
    const keys = labels.map((label) =>
      label.fields.filter((field) => field.kind === "text").map((f) => f.key)
    );
    expect(keys[0]).toHaveLength(1);
    expect(keys[0]).toEqual(keys[1]);
    expect(keys[0][0]).toBe(3);
  });

  test("commands that aren't drawn yet are placeholders", () => {
    const [label] = design("^XA^FO20,20^B4N,20^FDAB^FS^XZ");
    expect(label.fields).toHaveLength(1);
    const { drawn, bounds } = label.fields[0];
    expect(drawn).toBe(false);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  test("empty fields keep their position", () => {
    const [label] = design("^XA^FO30,40^A0N,30^FD^FS^XZ");
    expect(label.fields).toHaveLength(1);
    expect(label.fields[0].bounds).toEqual({
      x: 30,
      y: 40,
      width: 0,
      height: 0,
    });
  });
});
