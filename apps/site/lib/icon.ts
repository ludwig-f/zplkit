import { crc32, deflateSync } from "node:zlib";
import { renderLabels } from "@zplkit/render";
import { encodeShare } from "../playground/share";
import { siteUrl } from "./shared";

/**
 * The site's icons are Data Matrix codes, printed by zplkit's own renderer.
 * Each says as much as fits: "zplkit" in a tab, the site's address where
 * there's room for it, and on the Apple icon a link that opens the tab
 * icon's code in the viewer.
 */

const dark = [0x19, 0x18, 0x13];
const light = [0xf4, 0xf2, 0xec];

/** Pixels per square a handheld scanner reads off a screen */
const READABLE = 2;

/** The tab icon's code as a label, for the viewer link to open */
const viewerLabel = {
  zpl: "^XA^FO8,8^BXN,8,200,12,12^FDzplkit^FS^XZ",
  mm: 14,
};

/** What the icons can say, from least to most */
const iconTexts = async (): Promise<string[]> => {
  const hash = await encodeShare({
    zpl: viewerLabel.zpl,
    width: { mm: viewerLabel.mm },
    height: { mm: viewerLabel.mm },
    dpmm: 8,
    smoothing: 0,
  });
  return ["zplkit", siteUrl, `${siteUrl}/viewer#${hash}`];
};

/** Render ZPL on a square label of `size` dots, one dot per pixel */
const render = (zpl: string, size: number, antialias = false) =>
  renderLabels(zpl, {
    widthMm: size / 8,
    heightMm: size / 8,
    dpmm: 8,
    antialias,
  })[0];

/** How many squares a side the code for a text has */
const symbolSize = (text: string): number => {
  const room = 160;
  const { ink } = render(`^XA^FO0,0^BXN,1,200^FD${text}^FS^XZ`, room);
  // The bottom row is solid, so the last row with ink is the code's height
  let rows = 0;
  for (let y = 0; y < room; y++) if (ink[y * room] > 0.5) rows = y + 1;
  return rows;
};

/**
 * The most an icon of `size` pixels can say. A code needs a square of
 * space around it, and squares of READABLE pixels to scan; when nothing
 * fits at that, the first text is drawn as large as it fits.
 */
const iconFor = (size: number, texts: string[]) => {
  const fits = texts.map((text) => {
    const symbol = symbolSize(text);
    return { text, symbol, module: Math.floor(size / (symbol + 2)) };
  });
  const icon = fits.findLast((fit) => fit.module >= READABLE) ?? fits[0];
  return {
    ...icon,
    offset: Math.floor((size - icon.symbol * icon.module) / 2),
  };
};

/** Tab icons are rounded tiles, as browsers show them as they are */
const rounded = (size: number) => size < 180;

/**
 * An icon as ZPL: a black tile, rounded for tabs, with the code reversed
 * out of it. Printed on a label, it's the icon.
 */
const iconZpl = (size: number, texts: string[]) => {
  const { text, module, offset } = iconFor(size, texts);
  return [
    "^XA",
    `^FO0,0^GB${size},${size},${size},B,${rounded(size) ? 3 : 0}^FS`,
    `^FO${offset},${offset}^BXN,${module},200^FR^FD${text}^FS`,
    "^XZ",
  ].join("");
};

/** An icon's pixels, as RGBA */
const iconPixels = async (size: number, texts: string[]) => {
  const tile = render(
    `^XA^FO0,0^GB${size},${size},${size},B,${rounded(size) ? 3 : 0}^FS^XZ`,
    size,
    true
  );
  const icon = render(iconZpl(size, texts), size, true);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const alpha = tile.ink[i];
    // Inside the tile, ink is dark and the reversed code is light
    const darkness = alpha > 0 ? icon.ink[i] / alpha : 0;
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] = light[c] + (dark[c] - light[c]) * darkness;
    }
    data[i * 4 + 3] = alpha * 255;
  }
  return { size, data };
};

const chunk = (type: string, body: Uint8Array) => {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  out.set(body, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
};

/** An icon as a PNG */
const iconPng = async (size: number, texts?: string[]): Promise<Buffer> => {
  const { data } = await iconPixels(size, texts ?? (await iconTexts()));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6], 8); // 8 bits per channel, RGBA
  // Each row starts with its filter type, 0 for none
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows.set(
      data.subarray(y * size * 4, (y + 1) * size * 4),
      y * (size * 4 + 1) + 1
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** Sizes browsers pick from favicon.ico */
const icoSizes = [16, 32, 48];

/** favicon.ico, with a PNG for each size */
const faviconIco = async (): Promise<Buffer> => {
  const texts = await iconTexts();
  const pngs = await Promise.all(icoSizes.map((size) => iconPng(size, texts)));
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const entry = 6 + 16 * i;
    header[entry] = icoSizes[i];
    header[entry + 1] = icoSizes[i];
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs]);
};

export {
  iconTexts,
  iconFor,
  iconZpl,
  iconPixels,
  iconPng,
  faviconIco,
  viewerLabel,
};
