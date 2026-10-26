import { test, expect } from "vitest";
import {
  decodeCodeShare,
  decodeShare,
  encodeCodeShare,
  encodeShare,
} from "./share";

const state = {
  zpl: "^XA^FO50,50^A0,40^FDHello, wörld ^ _ ~^FS^XZ",
  width: { mm: 50.8 },
  height: undefined,
  dpmm: 12,
  smoothing: 0.4,
};

test("a shared link decodes to the same label and settings", async () => {
  expect(await decodeShare(await encodeShare(state))).toStrictEqual(state);
});

test("sizes in inches stay in inches", async () => {
  const inches = { ...state, width: { inches: 4 }, height: { inches: 6 } };
  expect(await decodeShare(await encodeShare(inches))).toStrictEqual(inches);
});

test("links only use characters that are safe in a URL", async () => {
  expect(await encodeShare(state)).toMatch(/^[A-Za-z0-9_-]+$/);
});

test("links are shorter than the ZPL for typical labels", async () => {
  const zpl = "^XA" + "^FO50,50^A0,40^FDHello^FS".repeat(20) + "^XZ";
  const link = await encodeShare({ ...state, zpl });
  expect(link.length).toBeLessThan(zpl.length / 2);
});

test("anything that isn't a link decodes to undefined", async () => {
  expect(await decodeShare("not-a-share-link")).toBeUndefined();
  expect(await decodeShare("")).toBeUndefined();
});

test("a shared playground link decodes to the same code", async () => {
  const code = {
    code: 'export default <Label dpmm={8} />; // "wörld"',
    smoothing: 0,
  };
  expect(await decodeCodeShare(await encodeCodeShare(code))).toStrictEqual(
    code
  );
});

test("viewer and playground links can't be mistaken for each other", async () => {
  const code = await encodeCodeShare({ code: "x", smoothing: 0.4 });
  expect(await decodeShare(code)).toBeUndefined();
  expect(await decodeCodeShare(await encodeShare(state))).toBeUndefined();
});
