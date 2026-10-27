// Expected dots were measured from reference renders at 8 dpmm, which match
// Zebra printers closely
import { describe, test, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { renderLabels } from "./render.js";
import type { Raster } from "./raster.js";

const size = { widthMm: 203 / 8, heightMm: 15, dpmm: 8 };

/** Render one label, with ^PW set to the full raster width unless given */
const render = (body: string, printWidth = 203) =>
  renderLabels(`^XA^PW${printWidth}^LL120${body}^XZ`, size)[0];

/** Dots the printer would print: ink of at least half a dot */
const isDot = (raster: Raster, x: number, y: number) =>
  raster.ink[y * raster.width + x] >= 0.5;

const dots = (raster: Raster) => {
  let count = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (!isDot(raster, x, y)) continue;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { count, x: [minX, maxX], y: [minY, maxY] };
};

/** The dots in a region as text, # for a dot */
const art = (raster: Raster, x0: number, y0: number, x1: number, y1: number) =>
  Array.from({ length: y1 - y0 + 1 }, (_, row) =>
    Array.from({ length: x1 - x0 + 1 }, (_, col) =>
      isDot(raster, x0 + col, y0 + row) ? "#" : "."
    ).join("")
  );

describe("renderLabels", () => {
  test("sizes the raster from the label size and resolution", () => {
    const [raster] = renderLabels("^XA^XZ", {
      widthMm: 50.8,
      heightMm: 25.4,
      dpmm: 8,
    });
    expect([raster.width, raster.height]).toStrictEqual([407, 204]);
  });

  test("renders one raster per label", () => {
    expect(renderLabels("^XA^XZ^XA^XZ", size)).toHaveLength(2);
  });

  describe("boxes", () => {
    test("draw the line inside the box", () => {
      expect(dots(render("^FO10,10^GB20,10,2^FS"))).toStrictEqual({
        count: 104,
        x: [10, 29],
        y: [10, 19],
      });
    });

    test("^FT places the bottom-left corner", () => {
      expect(dots(render("^FT10,30^GB20,10,2^FS")).y).toStrictEqual([20, 29]);
    });

    test("are at least as wide as their line", () => {
      expect(dots(render("^FO10,10^GB1,10,3^FS"))).toStrictEqual({
        count: 30,
        x: [10, 12],
        y: [10, 19],
      });
    });

    test("^LH moves them", () => {
      expect(dots(render("^LH5,7^FO10,10^GB20,10,2^FS"))).toMatchObject({
        x: [15, 34],
        y: [17, 26],
      });
    });

    test("are centered when ^PW is narrower than the label", () => {
      expect(dots(render("^FO10,10^GB20,10,2^FS", 200)).x).toStrictEqual([
        11, 30,
      ]);
    });

    test("can have rounded corners", () => {
      expect(
        art(render("^FO10,10^GB30,20,3,B,4^FS"), 10, 10, 39, 29)
      ).toStrictEqual([
        "...########################...",
        ".############################.",
        ".############################.",
        "#####....................#####",
        "####......................####",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "###........................###",
        "####......................####",
        "#####....................#####",
        ".############################.",
        ".############################.",
        "...########################...",
      ]);
    });

    test("can be white", () => {
      const raster = render("^FO10,10^GB20,10,10^FS^FO12,12^GB4,4,4,W^FS");
      expect(dots(raster).count).toBe(200 - 16);
    });
  });

  describe("circles", () => {
    test("draw the line inside the diameter", () => {
      expect(art(render("^FO10,10^GC20,3^FS"), 10, 10, 29, 29)).toStrictEqual([
        ".......######.......",
        ".....##########.....",
        "...##############...",
        "..#####......#####..",
        "..####........####..",
        ".####..........####.",
        ".###............###.",
        "###..............###",
        "###..............###",
        "###..............###",
        "###..............###",
        "###..............###",
        "###..............###",
        ".###............###.",
        ".####..........####.",
        "..####........####..",
        "..#####......#####..",
        "...##############...",
        ".....##########.....",
        ".......######.......",
      ]);
    });

    test("^FT places the bottom-left corner", () => {
      expect(dots(render("^FT10,40^GC20,3^FS")).y).toStrictEqual([20, 39]);
    });
  });

  describe("label shift and top", () => {
    /** Where the dots of each label are, for a job of labels 406 dots square */
    const boxes = (zpl: string) =>
      renderLabels(zpl, { widthMm: 406 / 8, heightMm: 406 / 8, dpmm: 8 }).map(
        (raster) => {
          const { x, y } = dots(raster);
          return { x, y };
        }
      );
    const box = "^FO100,100^GB50,50,50^FS";

    test("^LS shifts the fields after it to the left", () => {
      expect(boxes(`^XA^LS40${box}^XZ`)).toStrictEqual([
        { x: [60, 109], y: [100, 149] },
      ]);
      expect(boxes(`^XA^LS-40${box}^XZ`)).toStrictEqual([
        { x: [140, 189], y: [100, 149] },
      ]);
      expect(boxes(`^XA${box}^LS40^XZ`)).toStrictEqual([
        { x: [100, 149], y: [100, 149] },
      ]);
    });

    test("^LS adds to ^LH and stops at the label's left edge", () => {
      expect(boxes(`^XA^LH50,0^LS40${box}^XZ`)).toStrictEqual([
        { x: [110, 159], y: [100, 149] },
      ]);
      expect(boxes(`^XA^LS120${box}^XZ`)).toStrictEqual([
        { x: [0, 49], y: [100, 149] },
      ]);
    });

    test("^LS stays for the next label, and an empty one keeps it", () => {
      expect(
        boxes(`^XA^LS40^XZ^XA${box}^XZ^XA^LS${box}^XZ`).slice(1)
      ).toStrictEqual([
        { x: [60, 109], y: [100, 149] },
        { x: [60, 109], y: [100, 149] },
      ]);
    });

    test("^LT moves the whole label down or up, wherever it is", () => {
      expect(boxes(`^XA^LT40${box}^XZ`)).toStrictEqual([
        { x: [100, 149], y: [140, 189] },
      ]);
      expect(boxes(`^XA^LT-120${box}^XZ`)).toStrictEqual([
        { x: [100, 149], y: [0, 49] },
      ]);
      expect(boxes(`^XA${box}^LT40^XZ`)).toStrictEqual([
        { x: [100, 149], y: [140, 189] },
      ]);
      expect(boxes(`^XA^LT40${box}^LT0^XZ`)).toStrictEqual([
        { x: [100, 149], y: [100, 149] },
      ]);
    });

    test("^LT ignores offsets beyond 120 dots", () => {
      expect(boxes(`^XA^LT121${box}^XZ`)).toStrictEqual([
        { x: [100, 149], y: [100, 149] },
      ]);
    });

    test("^LT stays for the next label", () => {
      expect(boxes(`^XA^LT40^XZ^XA${box}^XZ`)[1]).toStrictEqual({
        x: [100, 149],
        y: [140, 189],
      });
    });

    test("^LS and ^LT apply before ^PO turns the label", () => {
      expect(boxes(`^XA^POI^LS40${box}^XZ`)).toStrictEqual([
        { x: [296, 345], y: [256, 305] },
      ]);
      expect(boxes(`^XA^POI^LT40${box}^XZ`)).toStrictEqual([
        { x: [256, 305], y: [216, 265] },
      ]);
    });
  });

  describe("ellipses", () => {
    test("draw the line inside the width and height", () => {
      expect(
        art(render("^FO10,10^GE30,16,3^FS"), 10, 10, 39, 25)
      ).toStrictEqual([
        "..........##########..........",
        "......##################......",
        "....######################....",
        "...#######..........#######...",
        "..####..................####..",
        ".####....................####.",
        "####......................####",
        "###........................###",
        "###........................###",
        "####......................####",
        ".####....................####.",
        "..####..................####..",
        "...#######..........#######...",
        "....######################....",
        "......##################......",
        "..........##########..........",
      ]);
    });

    test("fill when the line is as thick as the ellipse", () => {
      expect(
        art(render("^FO10,10^GE20,12,12^FS"), 10, 10, 29, 21)
      ).toStrictEqual([
        "......########......",
        "...##############...",
        "..################..",
        ".##################.",
        "####################",
        "####################",
        "####################",
        "####################",
        ".##################.",
        "..################..",
        "...##############...",
        "......########......",
      ]);
    });

    test("are as wide as they are tall like ^GC", () => {
      expect(render("^FO10,10^GE20,20,3^FS").ink).toStrictEqual(
        render("^FO10,10^GC20,3^FS").ink
      );
    });

    test("default to a 3 dot ring", () => {
      expect(art(render("^FO10,10^GE^FS"), 10, 10, 12, 12)).toStrictEqual([
        "###",
        "#.#",
        "###",
      ]);
    });

    test("^FT places the bottom-left corner", () => {
      expect(dots(render("^FT10,40^GE30,16,3^FS")).y).toStrictEqual([24, 39]);
    });

    test("can be white", () => {
      // A white ellipse clears the dots a black one would print
      const white = render("^FO10,10^GB30,30,30^FS^FO12,12^GE20,10,10,W^FS");
      const black = render("^FO12,12^GE20,10,10^FS");
      expect(dots(white).count).toBe(900 - dots(black).count);
    });
  });

  describe("diagonal lines", () => {
    test("lean right by default", () => {
      expect(
        art(render("^FO10,10^GD20,10,2,B,R^FS"), 11, 10, 30, 19)
      ).toStrictEqual([
        "..................##",
        "................##..",
        "..............##....",
        "............##......",
        "..........##........",
        "........##..........",
        "......##............",
        "....##..............",
        "..##................",
        "##..................",
      ]);
    });

    test("can lean left", () => {
      expect(
        art(render("^FO10,10^GD20,10,2,B,L^FS"), 11, 10, 30, 19)
      ).toStrictEqual([
        "##..................",
        "..##................",
        "....##..............",
        "......##............",
        "........##..........",
        "..........##........",
        "............##......",
        "..............##....",
        "................##..",
        "..................##",
      ]);
    });

    test("are as thick as their line horizontally", () => {
      expect(dots(render("^FO10,10^GD20,10,5,B,R^FS")).count).toBe(50);
    });
  });

  describe("images", () => {
    test("draw the bits of a graphic field", () => {
      expect(
        art(render("^FO10,10^GFA,4,4,2,F00F0FF0^FS"), 10, 10, 25, 11)
      ).toStrictEqual(["####........####", "....########...."]);
    });

    test("decode Zebra's compression", () => {
      // H = repeat twice, : = repeat the previous row, , = fill the row with 0
      const compressed = render("^FO10,10^GFA,8,8,2,HFH0:,^FS");
      expect(art(compressed, 10, 10, 25, 13)).toStrictEqual([
        "########........",
        "########........",
        "................",
        "................",
      ]);
    });

    describe("base64 data, as design tools export it", () => {
      const bits = Buffer.from("F00F0FF0", "hex");
      const b64 = `:B64:${bits.toString("base64")}:1234`;
      const z64 = `:Z64:${deflateSync(bits).toString("base64")}:1234`;
      const expected = ["####........####", "....########...."];

      test.each([b64, z64])("^GF with %s", (data) => {
        expect(
          art(render(`^FO10,10^GFA,4,4,2,${data}^FS`), 10, 10, 25, 11)
        ).toStrictEqual(expected);
      });

      test.each([b64, z64])("~DG with %s", (data) => {
        const raster = renderLabels(
          `~DGR:LOGO.GRF,4,2,${data}^XA^PW203^FO10,10^XGR:LOGO.GRF^FS^XZ`,
          size
        )[0];
        expect(art(raster, 10, 10, 25, 11)).toStrictEqual(expected);
      });

      test("pads data shorter than the graphic with blank rows", () => {
        const short = `:Z64:${deflateSync(bits.subarray(0, 2)).toString(
          "base64"
        )}:0`;
        expect(
          art(render(`^FO10,10^GFA,4,4,2,${short}^FS`), 10, 10, 25, 11)
        ).toStrictEqual(["####........####", "................"]);
      });
    });

    test("graphics stored with ~DG can be recalled with ^XG", () => {
      const raster = renderLabels(
        "~DGR:LOGO.GRF,4,2,F00F0FF0^XA^PW203^FO10,10^XGR:LOGO.GRF,1,1^FS^XZ",
        size
      )[0];
      expect(art(raster, 10, 10, 25, 11)).toStrictEqual([
        "####........####",
        "....########....",
      ]);
    });

    test("magnify recalled graphics", () => {
      const raster = renderLabels(
        "~DGR:DOT.GRF,1,1,80^XA^PW203^FO10,10^XGR:DOT.GRF,3,2^FS^XZ",
        size
      )[0];
      expect(dots(raster)).toStrictEqual({
        count: 6,
        x: [10, 12],
        y: [10, 11],
      });
    });
  });

  describe("reverse printing", () => {
    test("^FR inverts what is under the field", () => {
      const raster = render("^FO10,10^GB20,10,10^FS^FO20,10^FR^GB20,10,10^FS");
      expect(art(raster, 10, 10, 39, 10)).toStrictEqual([
        "##########..........##########",
      ]);
    });

    test("^LR reverses every field", () => {
      const raster = render("^LRY^FO10,10^GB20,10,10^FS^FO20,10^GB20,10,10^FS");
      expect(art(raster, 10, 10, 39, 10)).toStrictEqual([
        "##########..........##########",
      ]);
    });
  });
});

describe("label size", () => {
  test("refuses labels too large to render, instead of running out of memory", () => {
    expect(() =>
      renderLabels("^XA^XZ", { widthMm: 50.8, heightMm: 25.4, dpmm: 1300 })
    ).toThrow("66040 × 33020 dots");
  });

  test("renders the largest real labels", () => {
    // 8.5 by 39 inches at 300 dpi
    const [raster] = renderLabels("^XA^XZ", {
      widthMm: 215.9,
      heightMm: 990.6,
      dpmm: 12,
    });
    expect(raster.width * raster.height).toBeGreaterThan(30_000_000);
  });
});
