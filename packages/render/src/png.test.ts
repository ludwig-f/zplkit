import { describe, test, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "./png.js";
import { renderZpl } from "./index.js";
import { Raster } from "./raster.js";

/** Read an 8-bit grayscale PNG back into rows of pixel values */
const decode = (png: Uint8Array) => {
  const buffer = Buffer.from(png);
  expect(buffer.subarray(0, 8)).toStrictEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([data[8], data[9]]).toStrictEqual([8, 0]); // 8-bit grayscale
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  return Array.from({ length: height }, (_, y) => {
    expect(raw[y * (width + 1)]).toBe(0); // no filter
    return [...raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1))];
  });
};

describe("encodePng", () => {
  test("writes ink as black on white", async () => {
    const raster = new Raster(3, 2);
    raster.ink.set([1, 0, 0.5, 0, 1, 0]);

    expect(decode(await encodePng(raster))).toStrictEqual([
      [0, 255, 128],
      [255, 0, 255],
    ]);
  });
});

describe("renderZpl", () => {
  test("returns one base64 PNG per label, sized from the options", async () => {
    const images = await renderZpl("^XA^FO2,2^GB4,4,4^FS^XZ^XA^XZ", {
      widthMm: 1,
      heightMm: 1,
      dpmm: 8,
      grayscale: false,
    });

    expect(images).toHaveLength(2);
    const rows = decode(Buffer.from(images[0], "base64"));
    expect([rows[0].length, rows.length]).toStrictEqual([8, 8]);
    expect(rows[3]).toStrictEqual([255, 255, 0, 0, 0, 0, 255, 255]);
  });

  test("prints whole dots unless grayscale is asked for", async () => {
    const zpl = "^XA^FO1,1^GC12,2^FS^XZ";
    const options = { widthMm: 2, heightMm: 2, dpmm: 8 };
    const levels = async (grayscale: boolean) =>
      new Set(
        decode(
          Buffer.from(
            (await renderZpl(zpl, { ...options, grayscale }))[0],
            "base64"
          )
        ).flat()
      );

    expect([...(await levels(false))].sort()).toStrictEqual([0, 255]);
    expect((await levels(true)).size).toBeGreaterThan(2);
  });
});
