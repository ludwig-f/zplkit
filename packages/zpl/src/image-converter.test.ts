import { suite, describe, test, expect } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import ImageConverter, { ZplImage, zplMapCodes } from "./ImageConverter.js";
import ZplError from "./ZplError.js";

suite("ImageConverter", () => {
  const converter = new ImageConverter();

  describe("getEncodedString", () => {
    test("should return the encoded string for the given counter and character", () => {
      const counter = 3;
      const string = "A";
      // @ts-expect-error - testing a private method
      const encoded = converter.getEncodedString(3, string);
      expect(encoded).toStrictEqual(zplMapCodes[counter] + string);
    });
  });

  describe("encodeHexAscii", () => {
    test("should encode the given string to hex ascii", () => {
      // @ts-expect-error - testing a private method
      const encoded = converter.encodeHexAscii("test");
      expect(encoded).toStrictEqual("GtGeGsGt");
    });
  });

  describe("toZPL", () => {
    test("should convert the given image to ZPL", async () => {
      const imageBuffer = await readFile(
        join(import.meta.dirname, "../assets/test-image.png")
      );
      const result: ZplImage = await converter.toZPL(imageBuffer);

      expect(result.width).toStrictEqual(297);
      expect(result.height).toStrictEqual(228);
      expect(result.totalBytes).toStrictEqual(8664);
      expect(result.bytesPerRow).toStrictEqual(38);
      expect(typeof result.data).toStrictEqual("string");
      expect(result.data.length).toBeGreaterThan(0);
    });

    // Hashes of what jimp produced before it was replaced
    const sha1 = (data: string) =>
      createHash("sha1").update(data).digest("hex").slice(0, 12);

    test.each([
      ["test-image.png", "52cb9755d636"],
      ["test-image.jpg", "6d6dc4d55473"],
    ])("reads %s", async (file, hash) => {
      const image = await readFile(
        join(import.meta.dirname, "../assets", file)
      );
      const result = await converter.toZPL(image);
      expect([result.width, result.height, result.totalBytes]).toStrictEqual([
        297, 228, 8664,
      ]);
      expect(sha1(result.data)).toBe(hash);
    });

    test("takes pixels too, like a canvas's ImageData", async () => {
      // Black, white, transparent black, dark gray
      const data = new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 60, 60, 60, 255,
      ]);
      const uncompressed = new ImageConverter();
      uncompressed.compress = false;
      const result = await uncompressed.toZPL({ width: 4, height: 1, data });
      expect(result).toMatchObject({ width: 4, totalBytes: 1, bytesPerRow: 1 });
      expect(result.data).toBe("90\n");
    });

    test("rejects formats other than PNG and JPEG", async () => {
      await expect(
        converter.toZPL(Buffer.from("GIF89a\x01\x00\x01\x00"))
      ).rejects.toThrow(ZplError);
    });
  });
});
