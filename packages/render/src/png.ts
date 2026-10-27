/**
 * A minimal PNG encoder for rasters: 8-bit grayscale, no filtering,
 * compressed with the platform's CompressionStream so it runs in browsers
 * and Node without dependencies.
 */
import type { Raster } from "./raster.js";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};

/**
 * zlib-compress bytes, as PNG's image data requires. The stream is read by
 * hand rather than through Blob or Response, which some DOM shims lack.
 */
const deflate = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>);
  void writer.close();

  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
};

/** Encode a raster as a PNG: ink is black, no ink is white */
const encodePng = async (raster: Raster): Promise<Uint8Array> => {
  const { width, height, ink } = raster;

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale

  // Each row starts with its filter type, 0 for none
  const pixels = new Uint8Array(height * (width + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * (width + 1) + 1 + x] = Math.round(
        255 * (1 - ink[y * width + x])
      );
    }
  }

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", await deflate(pixels)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
};

export { encodePng };
