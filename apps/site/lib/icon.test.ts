import { test, expect } from "vitest";
import { renderLabels } from "@zplkit/render";
import { decodeShare } from "../playground/share";
import { siteUrl } from "./shared";
import {
  iconFor,
  iconPixels,
  iconTexts,
  faviconIco,
  viewerLabel,
} from "./icon";

test("each icon says as much as fits in squares a scanner reads", async () => {
  const texts = await iconTexts();
  const said = [16, 32, 48, 180].map((size) => iconFor(size, texts));
  expect(said.map((icon) => icon.text)).toStrictEqual([
    "zplkit",
    "zplkit",
    siteUrl,
    texts[2],
  ]);
  // Only the smallest has squares of a single pixel, as nothing else fits
  expect(said.map((icon) => icon.module)).toStrictEqual([1, 2, 2, 4]);
});

test("the Apple icon links to the tab icon's code in the viewer", async () => {
  const [, , link] = await iconTexts();
  expect(link.startsWith(`${siteUrl}/viewer#`)).toBe(true);
  const shared = await decodeShare(link.split("#")[1]);
  expect(shared?.zpl).toBe(viewerLabel.zpl);
});

test("the icons draw the code the renderer prints for their text", async () => {
  const texts = await iconTexts();
  for (const size of [16, 32, 48, 180]) {
    const { text, module, symbol, offset } = iconFor(size, texts);
    const [printed] = renderLabels(`^XA^FO0,0^BXN,1,200^FD${text}^FS^XZ`, {
      widthMm: symbol / 8,
      heightMm: symbol / 8,
      dpmm: 8,
      antialias: false,
    });
    const pixels = await iconPixels(size, texts);
    // Each square's middle pixel is light where the printer puts ink
    const middle = (index: number) =>
      offset + index * module + Math.floor(module / 2);
    for (let y = 0; y < symbol; y++) {
      for (let x = 0; x < symbol; x++) {
        const red = pixels.data[(middle(y) * size + middle(x)) * 4];
        expect(red > 128, `${size} px at ${x},${y}`).toBe(
          printed.ink[y * symbol + x] > 0.5
        );
      }
    }
  }
});

test("tab icons are rounded tiles and the Apple icon fills its square", async () => {
  const texts = await iconTexts();
  const alpha = (size: number, x: number, y: number) =>
    iconPixels(size, texts).then(
      (pixels) => pixels.data[(y * size + x) * 4 + 3]
    );
  expect(await alpha(32, 0, 0)).toBe(0);
  expect(await alpha(32, 16, 0)).toBe(255);
  expect(await alpha(180, 0, 0)).toBe(255);
});

test("favicon.ico holds a PNG for each tab size", async () => {
  const ico = await faviconIco();
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  expect(view.getUint16(2, true)).toBe(1); // an icon, not a cursor
  expect(view.getUint16(4, true)).toBe(3);
  const sizes = [0, 1, 2].map((i) => ico[6 + i * 16]);
  expect(sizes).toStrictEqual([16, 32, 48]);
  const offset = view.getUint32(6 + 12, true);
  expect([...ico.subarray(offset, offset + 4)]).toStrictEqual([
    0x89, 0x50, 0x4e, 0x47,
  ]);
});
