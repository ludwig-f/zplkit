/**
 * Font files on the printer: downloaded with ~DU or ~DY, or passed in to
 * stand for fonts already stored there. Files are found by device, name and
 * extension; a reference without a device, or a font passed in without one,
 * matches any device.
 */
import { decodeObjectData } from "./data.js";
import { parseFont } from "./font.js";
import type { Font } from "./font.js";

type FontPath = { device?: string; name: string; extension: string };

/** Parsed fonts by their data, so a preview doesn't re-parse on each render */
const parsedData = new Map<string, Font | null>();
const parsedBytes = new WeakMap<Uint8Array, Font | null>();

/** The font in a file, or null if it isn't TrueType */
const tryParse = (bytes: Uint8Array): Font | null => {
  try {
    const font = parseFont(bytes);
    font.glyphIndex(0x48);
    return font;
  } catch {
    return null;
  }
};

/** The font in a file, or null if it isn't TrueType; cached per array */
const fromBytes = (bytes: Uint8Array) => {
  let font = parsedBytes.get(bytes);
  if (font === undefined) {
    font = tryParse(bytes);
    parsedBytes.set(bytes, font);
  }
  return font;
};

const fromData = (data: string) => {
  let font = parsedData.get(data);
  if (font === undefined) {
    const bytes = decodeObjectData(data);
    font = bytes ? tryParse(bytes) : null;
    // Keep the cache small: labels usually download the same few fonts
    if (parsedData.size > 16) parsedData.clear();
    parsedData.set(data, font);
  }
  return font;
};

const fileName = ({ name, extension }: FontPath) =>
  `${name}.${extension}`.toUpperCase();

class FontFiles {
  private readonly files = new Map<string, Font>();

  constructor(passed: Record<string, Uint8Array> = {}) {
    for (const [path, bytes] of Object.entries(passed)) {
      const font = fromBytes(bytes);
      if (font) this.files.set(path.toUpperCase(), font);
    }
  }

  /** Store a font from object data (hex, :B64: or :Z64:) */
  download(path: Required<FontPath>, data: string): void {
    const key = `${path.device}:${fileName(path)}`.toUpperCase();
    const font = fromData(data);
    if (font) this.files.set(key, font);
    else this.files.delete(key);
  }

  find(path: FontPath): Font | undefined {
    const name = fileName(path);
    const devices = path.device ? [path.device] : ["R", "E", "B", "A"];
    for (const device of devices) {
      const font = this.files.get(`${device}:${name}`);
      if (font) return font;
    }
    return this.files.get(name);
  }
}

export type { FontPath };
export { FontFiles, fromBytes as parseFontFile };
