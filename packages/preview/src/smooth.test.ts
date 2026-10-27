import { test, expect } from "vitest";
import { smooth } from "./smooth.js";

/** RGBA pixels from gray values, fully opaque */
const pixels = (...grays: number[]) =>
  new Uint8ClampedArray(grays.flatMap((gray) => [gray, gray, gray, 255]));

const grays = (data: Uint8ClampedArray) =>
  [...data].filter((_, index) => index % 4 === 0);

test("0 snaps every pixel to black or white like the printer", () => {
  const data = pixels(0, 60, 127, 128, 200, 255);
  smooth(data, 0);
  expect(grays(data)).toStrictEqual([0, 0, 0, 255, 255, 255]);
});

test("1 keeps the anti-aliased pixels", () => {
  const data = pixels(0, 60, 200, 255);
  smooth(data, 1);
  expect(grays(data)).toStrictEqual([0, 60, 200, 255]);
});

test("values in between blend the two", () => {
  const data = pixels(60, 200);
  smooth(data, 0.5);
  expect(grays(data)).toStrictEqual([30, 228]);
});

test("sets all three color channels and leaves alpha alone", () => {
  const data = new Uint8ClampedArray([60, 60, 60, 128]);
  smooth(data, 0);
  expect([...data]).toStrictEqual([0, 0, 0, 128]);
});
