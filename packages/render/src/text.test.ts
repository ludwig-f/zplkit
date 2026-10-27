// Expectations come from reference renders of font 0 at 8 dpmm
import { describe, test, expect } from "vitest";
import { renderLabels } from "./render.js";
import { layout } from "./layout.js";
import { parse } from "@zplkit/core";
import { readFileSync } from "node:fs";

const size = { widthMm: 101.6, heightMm: 101.6, dpmm: 8 };
const render = (body: string, font0?: Uint8Array) =>
  renderLabels(`^XA^CI28^PW812${body}^XZ`, { ...size, font0 })[0];

/** Bounds of the printed dots */
const inkBounds = (body: string, font0?: Uint8Array) => {
  const raster = render(body, font0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (raster.ink[y * raster.width + x] < 0.5) continue;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { x: [minX, maxX], y: [minY, maxY], width: maxX - minX + 1, count };
};

describe("font 0", () => {
  test("capitals are three quarters of the height, from the top of ^FO", () => {
    expect(inkBounds("^FO100,100^A0N,100,100^FDH^FS").y).toStrictEqual([
      100, 174,
    ]);
  });

  test("^FT puts the baseline at the given y", () => {
    expect(inkBounds("^FT100,300^A0N,100,100^FDH^FS").y).toStrictEqual([
      225, 299,
    ]);
  });

  test("letters advance as far as on a printer", () => {
    // Reference: H advances 60.9 dots at ^A0N,100,100
    const one = inkBounds("^FO100,100^A0N,100,100^FDH^FS").width;
    const ten = inkBounds("^FO100,100^A0N,100,100^FDHHHHHHHHHH^FS").width;
    expect(Math.abs(ten - one - 9 * 60.9)).toBeLessThanOrEqual(1);
  });

  test("the width parameter scales horizontally only", () => {
    const one = inkBounds("^FO100,100^A0N,100,50^FDH^FS");
    const ten = inkBounds("^FO100,100^A0N,100,50^FDHHHHHHHHHH^FS");
    expect(Math.abs(ten.width - one.width - 9 * 30.45)).toBeLessThanOrEqual(1);
    expect(ten.y).toStrictEqual([100, 174]);
  });

  test("without a width, the width equals the height", () => {
    expect(inkBounds("^FO100,100^A0N,100^FDHHH^FS")).toStrictEqual(
      inkBounds("^FO100,100^A0N,100,100^FDHHH^FS")
    );
  });

  test("^CF sets the font for fields without ^A", () => {
    expect(inkBounds("^CF0,50^FO100,100^FDHH^FS")).toStrictEqual(
      inkBounds("^FO100,100^A0N,50,50^FDHH^FS")
    );
  });

  test("marks print where a printer puts their ink, not across their advance", () => {
    // Reference: - and – take 90.33 dots but print from 17 to 74 after the
    // pen, and | is a thin stem from 23 to 28
    const ink = (char: string) =>
      inkBounds(`^FO100,100^A0N,100,100^FD${char}^FS`).x.map((x) => x - 100);
    expect(ink("-")).toStrictEqual([17, 73]);
    expect(ink("–")).toStrictEqual([17, 73]);
    expect(ink("|")).toStrictEqual([23, 27]);
  });

  describe("^FP", () => {
    const at = (body: string) => inkBounds(`^FO200,40${body}`);

    test("adds a gap after each character", () => {
      const plain = at("^A0N,40,40^FDABC^FS");
      expect(at("^FPH,10^A0N,40,40^FDABC^FS").x).toStrictEqual([
        plain.x[0],
        plain.x[1] + 20,
      ]);
    });

    test("stacks characters a line apart, ignoring the gap", () => {
      // Reference: V, E, R and T at 40, 80, 120 and 160, from x
      const vertical = at("^FPV,4^A0N,40,40^FDVERT^FS");
      expect(vertical.y).toStrictEqual([40, 189]);
      expect(vertical.x[0]).toBe(at("^A0N,40,40^FDV^FS").x[0]);
    });

    test("puts the first vertical character on the ^FT baseline", () => {
      expect(inkBounds("^FT200,100^FPV^A0N,40,40^FDAB^FS").y).toStrictEqual([
        70, 139,
      ]);
    });

    test("prints reverse text right to left from three quarters of a width", () => {
      // Reference: the first character ends 0.75 × the width right of x
      const plain = at("^A0N,40,40^FDA^FS").x;
      expect(at("^FPR^A0N,40,40^FDA^FS").x).toStrictEqual(
        plain.map((x) => x + 8)
      );
      expect(at("^FPR^A0N,40,40^FDABC^FS").x).toStrictEqual([166, 229]);
      expect(at("^FPR,10^A0N,40,40^FDABC^FS").x).toStrictEqual([136, 219]);
    });

    test("reverse text in a bitmap font starts where it would", () => {
      expect(at("^FPR^ADN,36,20^FDA^FS")).toStrictEqual(
        at("^ADN,36,20^FDA^FS")
      );
    });
  });

  test("characters font 0 doesn't have advance like a space", () => {
    // Reference: a missing glyph prints nothing and advances 29.5
    const single = inkBounds("^FO100,100^A0N,100,100^FDH^FS").width;
    const spaced = inkBounds("^FO100,100^A0N,100,100^FDHĀH^FS").width;
    expect(Math.abs(spaced - single - (60.9 + 29.5))).toBeLessThanOrEqual(1);
  });

  test("decodes ^FH hex escapes", () => {
    expect(render("^FO100,100^A0N,60^FH^FD_48i_5F^FS").ink).toStrictEqual(
      render("^FO100,100^A0N,60^FDHi^FS^FO100,100^A0N,60^FH^FD_48i_5F^FS").ink
    );
  });

  test("decodes UTF-8 text", () => {
    // Å reaches above the capital height
    expect(inkBounds("^FO100,100^A0N,100^FDÅ^FS").y[0]).toBeLessThan(100);
  });

  test("^FR prints white text on black", () => {
    const raster = render(
      "^FO100,100^GB300,100,100^FS^FO110,110^FR^A0N,80^FDHi^FS"
    );
    const white = Array.from(
      raster.ink.subarray(130 * 812 + 100, 130 * 812 + 400)
    ).filter((ink) => ink < 0.5).length;
    expect(white).toBeGreaterThan(10);
  });
});

describe("text layout", () => {
  test("text elements remember the commands of their field", () => {
    const { commands } = parse("^XA^FO10,10^A0N,30^FDHi^FS^XZ");
    const [element] = layout(commands)[0].elements;
    expect(element).toMatchObject({
      kind: "text",
      text: "Hi",
      commands: [1, 2, 3, 4],
    });
  });
});

describe("font 0 from a font file", () => {
  // A monospaced font, so every character advances the same
  const mono = new Uint8Array(
    readFileSync(new URL("../fonts/DejaVuSansMono.ttf", import.meta.url))
  );

  test("capitals are still three quarters of the height", () => {
    expect(inkBounds("^FO100,100^A0N,100,100^FDH^FS", mono).y).toStrictEqual([
      100, 174,
    ]);
  });

  test("characters advance by the font's own widths", () => {
    // "i" is narrow in font 0, so this fails with the stand-in
    const one = inkBounds("^FO100,100^A0N,100,100^FDi^FS", mono);
    const two = inkBounds("^FO100,100^A0N,100,100^FDii^FS", mono);
    // DejaVu Sans Mono advances 1233 of 2048 units, and its capitals are
    // 1493 units tall, so at 100 dots high a character advances 61.9 dots
    expect(two.x[1] - one.x[1]).toBeGreaterThanOrEqual(61);
    expect(two.x[1] - one.x[1]).toBeLessThanOrEqual(63);
  });

  test("fonts that aren't on the printer print in it, like font 0", () => {
    const zero = render("^FO100,100^A0N,60,60^FDHello^FS", mono);
    const missing = render(
      "^FO100,100^A@N,60,60,E:MISSING.TTF^FDHello^FS",
      mono
    );
    expect(missing.ink).toStrictEqual(zero.ink);
  });

  test("changes how font 0 looks", () => {
    expect(
      render("^FO100,100^A0N,60,60^FDHello^FS", mono).ink
    ).not.toStrictEqual(render("^FO100,100^A0N,60,60^FDHello^FS").ink);
  });

  test("a file that isn't a font is an error", () => {
    expect(() =>
      render("^FO100,100^A0N,60^FDHi^FS", new Uint8Array(8))
    ).toThrow(/font0/);
  });
});
