import { test, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { decodeObjectData } from "./data.js";

const bytes = new Uint8Array([0, 1, 127, 128, 255]);
const base64 = Buffer.from(bytes).toString("base64");

test("reads hex", () => {
  expect(decodeObjectData("00017F80FF")).toStrictEqual(bytes);
  expect(decodeObjectData("00017f80ff")).toStrictEqual(bytes);
});

test("skips line breaks and spaces in hex", () => {
  expect(decodeObjectData("0001\n7F80 FF")).toStrictEqual(bytes);
});

test("reads :B64: with its CRC", () => {
  expect(decodeObjectData(`:B64:${base64}:1A2B`)).toStrictEqual(bytes);
});

test("reads :Z64:, base64 of zlib-compressed data", () => {
  const z64 = Buffer.from(deflateSync(bytes)).toString("base64");
  expect(decodeObjectData(`:Z64:${z64}:1A2B`)).toStrictEqual(bytes);
});

test("returns undefined for data it can't read", () => {
  expect(decodeObjectData("XYZ")).toBe(undefined);
  expect(decodeObjectData(":Z64:bm90IHpsaWI=:0000")).toBe(undefined);
});
