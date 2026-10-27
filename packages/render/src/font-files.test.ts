// Fonts downloaded with ~DU or ~DY, or passed in, and called with ^A@ or
// ^CW, as measured from reference renders at 8 dpmm
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { parse } from "@zplkit/core";
import { layout } from "./layout.js";
import { renderLabels } from "./render.js";
import type { RenderOptions } from "./render.js";

const fontFile = (name: string) =>
  readFileSync(new URL(`../fonts/${name}`, import.meta.url));
const mono = fontFile("DejaVuSansMono.ttf");
const archivo = fontFile("font0.ttf");
const hex = (bytes: Buffer) => bytes.toString("hex").toUpperCase();
const downloadMono = `~DUR:MONO.TTF,${mono.length},${hex(mono)}`;
const downloadArchivo = `~DUR:ARCH.TTF,${archivo.length},${hex(archivo)}`;

const size: RenderOptions = { widthMm: 101.6, heightMm: 50.8, dpmm: 8 };

type Box = { left: number; right: number; top: number; bottom: number };

const bounds = (zpl: string, options: Partial<RenderOptions> = {}): Box => {
  const [raster] = renderLabels(zpl, { ...size, ...options });
  const box = { left: Infinity, right: -1, top: Infinity, bottom: -1 };
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (raster.ink[y * raster.width + x] < 0.5) continue;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  }
  return box;
};

const near = (actual: Box, [left, right, top, bottom]: number[], slack = 1) => {
  const expected = { left, right, top, bottom };
  for (const side of ["left", "right", "top", "bottom"] as const) {
    expect(
      Math.abs(actual[side] - expected[side]),
      `${side}: ${actual[side]} vs ${expected[side]}`
    ).toBeLessThanOrEqual(slack);
  }
};

/** The same text in font 0, the fallback for a font that isn't found */
const font0 = (body: string) =>
  bounds(
    `^XA${body.replace(/\^A@(\w?),?(\d*),?(\d*),[^^]*/, "^A0$1,$2,$3")}^XZ`
  );

describe("downloaded TrueType fonts", () => {
  test.each([
    // The em is the height, the width stretches it, the baseline is 3/4 down
    ["^FO100,100^A@N,100,100,R:MONO.TTF^FDH^FS", [107, 153, 102, 174]],
    ["^FO100,100^A@N,100,100,R:MONO.TTF^FDHHHHH^FS", [107, 394, 102, 174]],
    ["^FO100,100^A@N,100,50,R:MONO.TTF^FDHHHHH^FS", [103, 246, 102, 174]],
    ["^FO100,100^A@N,100,,R:MONO.TTF^FDHHHHH^FS", [107, 394, 102, 174]],
    ["^FO100,100^A@N,50,100,R:MONO.TTF^FDH^FS", [107, 153, 101, 136]],
    // Without a size, the default font's 9 by 5 dots
    ["^FO100,100^A@N,,,R:MONO.TTF^FDHHHH^FS", [100, 111, 100, 105]],
    // ^FT puts the baseline at y
    ["^FT100,200^A@N,100,100,R:MONO.TTF^FDH^FS", [107, 153, 127, 199]],
    ["^FO100,100^A@R,100,100,R:MONO.TTF^FDH^FS", [125, 197, 107, 153]],
    ["^FO100,100^A@I,100,100,R:MONO.TTF^FDH^FS", [106, 152, 125, 197]],
    ["^FO100,100^A@B,100,100,R:MONO.TTF^FDH^FS", [102, 174, 106, 152]],
    ["^FWR^FO100,100^A@,100,100,R:MONO.TTF^FDH^FS", [125, 197, 107, 153]],
    // A device can be left out
    ["^FO100,100^A@N,100,100,MONO.TTF^FDH^FS", [107, 153, 102, 174]],
    // Characters the font lacks print its missing glyph
    ["^CI28^FO100,100^A@N,100,100,R:MONO.TTF^FDH€H^FS", [107, 273, 101, 175]],
    // Lines in a block are the height apart
    [
      "^FO100,100^A@N,40,40,R:MONO.TTF^FB200,3^FDHHHH HHHH HHHH^FS",
      [103, 192, 101, 209],
    ],
  ])("%s", (body, expected) => {
    near(bounds(`${downloadMono}^XA${body}^XZ`), expected);
  });

  test("the baseline doesn't depend on the font", () => {
    near(
      bounds(
        `${downloadArchivo}^XA^FO100,100^A@N,100,100,R:ARCH.TTF^FDH^FS^XZ`
      ),
      [105, 146, 106, 174]
    );
  });

  test("^CW names a font file with a letter, for ^A and ^CF", () => {
    const direct = bounds(
      `${downloadMono}^XA^FO100,100^A@N,100,100,R:MONO.TTF^FDH^FS^XZ`
    );
    expect(
      bounds(
        `${downloadMono}^XA^CWX,R:MONO.TTF^FO100,100^AXN,100,100^FDH^FS^XZ`
      )
    ).toStrictEqual(direct);
    expect(
      bounds(`${downloadMono}^XA^CWX,R:MONO.TTF^CFX,100^FO100,100^FDH^FS^XZ`)
    ).toStrictEqual(direct);
  });

  test("^CW and downloaded fonts carry over to later labels", () => {
    const rasters = renderLabels(
      `${downloadMono}^XA^CWX,R:MONO.TTF^XZ^XA^FO100,100^AXN,100,100^FDH^FS^XZ`,
      size
    );
    const [direct] = renderLabels(
      `${downloadMono}^XA^FO100,100^A@N,100,100,R:MONO.TTF^FDH^FS^XZ`,
      size
    );
    expect(rasters[1].ink).toStrictEqual(direct.ink);
  });

  test.each([
    ["hex", `~DYR:MONO,A,T,${mono.length},,${hex(mono)}`],
    ["B64", `~DYR:MONO,A,T,${mono.length},,:B64:${mono.toString("base64")}:0`],
    [
      "Z64",
      `~DYR:MONO,A,T,${mono.length},,:Z64:${deflateSync(mono).toString(
        "base64"
      )}:0`,
    ],
  ])("~DY stores a TrueType font from %s", (_, download) => {
    near(
      bounds(`${download}^XA^FO100,100^A@N,100,100,R:MONO.TTF^FDH^FS^XZ`),
      [107, 153, 102, 174]
    );
  });

  describe("a font that isn't there", () => {
    test.each([
      // On another device
      "^FO100,100^A@N,100,100,E:MONO.TTF^FDH^FS",
      // Never downloaded
      "^FO100,100^A@N,100,100,R:NOPE.TTF^FDH^FS",
    ])("%s prints in font 0", (body) => {
      expect(bounds(`${downloadMono}^XA${body}^XZ`)).toStrictEqual(font0(body));
    });

    test("is reported as unsupported", () => {
      const [label] = layout(
        parse("^XA^FO10,10^A@N,30,30,E:ARIAL.TTF^FDHi^FS^XZ").commands
      );
      expect(label.unsupported).toStrictEqual([2]);
    });

    test("including one that isn't TrueType", () => {
      const body = "^FO100,100^A@N,100,100,R:BAD.TTF^FDH^FS";
      expect(bounds(`~DUR:BAD.TTF,4,DEADBEEF^XA${body}^XZ`)).toStrictEqual(
        font0(body)
      );
    });

    test("including bounded fonts from ~DT", () => {
      const body = "^FO100,100^A@N,100,100,R:MONO.DAT^FDH^FS";
      expect(
        bounds(`~DTR:MONO.DAT,${mono.length},${hex(mono)}^XA${body}^XZ`)
      ).toStrictEqual(font0(body));
    });
  });
});

describe("fonts passed in", () => {
  test("stand in for fonts already on the printer", () => {
    near(
      bounds("^XA^FO100,100^A@N,100,100,E:ARIAL.TTF^FDH^FS^XZ", {
        fonts: { "E:ARIAL.TTF": mono },
      }),
      [107, 153, 102, 174]
    );
  });

  test("without a device, match the font on any device", () => {
    near(
      bounds("^XA^FO100,100^A@N,100,100,E:ARIAL.TTF^FDH^FS^XZ", {
        fonts: { "arial.ttf": mono },
      }),
      [107, 153, 102, 174]
    );
  });
});

test("~DY stores graphics for ^XG too", () => {
  const graphic = (download: string) =>
    bounds(`${download}^XA^FO10,10^XGR:LOGO.GRF,2,2^FS^XZ`);
  expect(graphic("~DYR:LOGO,A,G,4,2,FF00FF00")).toStrictEqual(
    graphic("~DGR:LOGO.GRF,4,2,FF00FF00")
  );
});
