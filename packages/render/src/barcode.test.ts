// Barcode placement, as measured from reference renders at 8 dpmm
import { describe, test, expect } from "vitest";
import { parse } from "@zplkit/core";
import { layout } from "./layout.js";
import { renderLabels } from "./render.js";

const size = { widthMm: 101.6, heightMm: 101.6, dpmm: 8 };
const render = (body: string) => renderLabels(`^XA${body}^XZ`, size)[0];

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * Bounds of the bars and of the interpretation line of a horizontal barcode,
 * telling them apart by how many bars a row crosses
 */
const parts = (body: string) => {
  const raster = render(body);
  const bars: number[] = [];
  const text: number[] = [];
  const box = (rows: number[]): Box | undefined => {
    if (!rows.length) return undefined;
    let left = Infinity;
    let right = -Infinity;
    for (const y of rows) {
      for (let x = 0; x < raster.width; x++) {
        if (raster.ink[y * raster.width + x] < 0.5) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return { left, right, top: rows[0], bottom: rows[rows.length - 1] };
  };
  for (let y = 0; y < raster.height; y++) {
    let runs = 0;
    let previous = false;
    for (let x = 0; x < raster.width; x++) {
      const dot = raster.ink[y * raster.width + x] >= 0.5;
      if (dot && !previous) runs++;
      previous = dot;
    }
    if (runs >= 15) bars.push(y);
    else if (runs > 0) text.push(y);
  }
  return { bars: box(bars), text: box(text) };
};

/** Bounds of everything printed */
const bounds = (body: string): Box => {
  const raster = render(body);
  const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -1 };
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

const near = (actual: Box | undefined, expected: Box, slack = 1) => {
  expect(actual).toBeDefined();
  for (const side of ["left", "right", "top", "bottom"] as const) {
    expect(
      Math.abs(actual![side] - expected[side]),
      `${side}: ${actual![side]} vs ${expected[side]}`
    ).toBeLessThanOrEqual(slack);
  }
};

describe("Code 128", () => {
  test("draws the bars dot for dot", () => {
    const raster = render("^FO100,100^BY1^BCN,50,N^FD12345678^FS");
    const runs: number[] = [];
    let previous = true;
    for (let x = 100; x <= 222; x++) {
      const dot = raster.ink[110 * raster.width + x] >= 0.5;
      if (dot === previous && runs.length) runs[runs.length - 1]++;
      else runs.push(1);
      previous = dot;
    }
    expect(runs.join(",")).toBe(
      "2,1,1,2,1,4,1,2,3,2,2,1,2,2,3,2,1,1,2,2,1,1,3,2,2,2,1,2,3,1,2,1,3,2,1,2,2,2,3,1,1,2,3,1,2,1,3,1,3,1,1,2,2,2,3,1,4,1,1,1,2,3,3,1,1,1,2"
    );
    expect(bounds("^FO100,100^BY1^BCN,50,N^FD12345678^FS")).toStrictEqual({
      left: 100,
      right: 222,
      top: 100,
      bottom: 149,
    });
  });

  test.each([
    // ^BY sets the module width and, unless ^BC gives one, the height
    ["^FO100,100^BY2^BCN,100,Y,N^FD12345678^FS", 100, 345, 100, 199],
    ["^FO100,100^BC^FD12345678^FS", 100, 345, 100, 109],
    ["^FO100,100^BY3^BC^FD12345678^FS", 100, 468, 100, 109],
    ["^FO100,100^BY3,2,50^BC^FD12345678^FS", 100, 468, 100, 149],
    // ^FT places the bottom of the bars
    ["^FT100,300^BY2^BCN,100,Y,N^FD12345678^FS", 100, 345, 200, 299],
  ])("%s", (body, left, right, top, bottom) => {
    expect(parts(body).bars).toStrictEqual({ left, right, top, bottom });
  });

  describe("interpretation line", () => {
    test.each([
      // Font D scaled by half the module width, 6 dots below the bars
      ["^FO100,100^BY2^BCN,100,Y,N^FD12345678^FS", 176, 267, 206, 219],
      ["^FO100,100^BY1^BCN,100,Y,N^FDHHHH^FS", 128, 149, 206, 212],
      ["^FO100,100^BY3^BCN,100,Y,N^FDHHHH^FS", 184, 249, 206, 226],
      ["^FO100,100^BY5^BCN,100,Y,N^FDHHHH^FS", 239, 350, 206, 240],
      ["^FT100,300^BY2^BCN,100,Y,N^FD12345678^FS", 176, 267, 306, 319],
      // ...or above, its cell 8 dots clear of the bars
      ["^FO100,200^BY1^BCN,100,Y,Y^FD12345678^FS", 139, 183, 183, 189],
      ["^FO100,200^BY2^BCN,100,Y,Y^FD12345678^FS", 176, 267, 174, 187],
      ["^FO100,200^BY4^BCN,100,Y,Y^FD12345678^FS", 252, 436, 156, 184],
    ])("%s", (body, left, right, top, bottom) => {
      near(parts(body).text, { left, right, top, bottom });
    });

    test("is left out with N", () => {
      expect(parts("^FO100,100^BY2^BCN,100,N^FD12345678^FS").text).toBe(
        undefined
      );
    });
  });

  describe("rotation", () => {
    test.each([
      ["^FT300,300^BY2^BCR,100,N^FD1234^FS", 300, 399, 300, 457],
      ["^FT300,300^BY2^BCI,100,N^FD1234^FS", 142, 299, 300, 399],
      ["^FT300,300^BY2^BCB,100,N^FD1234^FS", 200, 299, 142, 299],
      ["^FO300,300^BY2^BCR,100,N^FD1234^FS", 300, 399, 300, 457],
      ["^FO300,300^BY2^BCI,100,N^FD1234^FS", 300, 457, 300, 399],
      ["^FO300,300^BY2^BCB,100,N^FD1234^FS", 300, 399, 300, 457],
      ["^FWR^FO300,300^BY2^BC,100,N^FD1234^FS", 300, 399, 300, 457],
    ])("%s", (body, left, right, top, bottom) => {
      expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
    });

    test("keeps the interpretation line below the bars", () => {
      // Reference: turned clockwise, the line is left of the bars
      near(
        bounds("^FO100,100^BY2^BCR,100,Y,N^FD12345678^FS"),
        { left: 80, right: 199, top: 100, bottom: 345 },
        1
      );
      // ...and upside down, above them
      near(
        bounds("^FO100,100^BY2^BCI,100,Y,N^FD12345678^FS"),
        { left: 100, right: 345, top: 80, bottom: 199 },
        1
      );
    });
  });
});

describe("EAN-13", () => {
  test.each([
    // The guard bars reach 13 dots below the others
    ["^FO100,100^BY2^BEN,100,N,N^FD590123412345^FS", 100, 289, 100, 212],
    ["^FO100,100^BY2^BEN,50,N,N^FD590123412345^FS", 100, 289, 100, 162],
    ["^FO100,100^BY4^BEN,100,N,N^FD590123412345^FS", 100, 479, 100, 212],
    // The first digit prints left of the bars
    ["^FT100,300^BY2^BEN,100,Y,N^FD590123412345^FS", 79, 289, 200, 317],
    ["^FO100,100^BY2^BEN,100,Y,Y^FD590123412345^FS", 100, 289, 74, 212],
  ])("%s", (body, left, right, top, bottom) => {
    near(bounds(body), { left, right, top, bottom }, 1);
  });

  test("prints the digits under the two halves", () => {
    // Reference: digits from x 79 to 276, rows 204 to 217
    const raster = render("^FO100,100^BY2^BEN,100,Y,N^FD590123412345^FS");
    // Columns 70..99 left of the bars only hold the first digit
    let top = Infinity;
    let bottom = -1;
    for (let y = 0; y < raster.height; y++) {
      for (let x = 70; x < 100; x++) {
        if (raster.ink[y * raster.width + x] < 0.5) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    expect(Math.abs(top - 204)).toBeLessThanOrEqual(1);
    expect(Math.abs(bottom - 217)).toBeLessThanOrEqual(1);
  });
});

describe("EAN-8, UPC and add-ons", () => {
  test.each([
    // Bars as wide as the symbol's modules, guards 13 dots longer
    ["^FO100,100^BY2^B8N,100,N,N^FD1234567^FS", 100, 233, 100, 212],
    ["^FO100,100^BY2^BUN,100,N,N^FD07000002198^FS", 100, 289, 100, 212],
    ["^FO100,100^BY2^B9N,100,N,N^FD1230000045^FS", 100, 201, 100, 212],
    // The add-on has no guards
    ["^FO100,100^BY2^BSN,100,N,N^FD04414^FS", 100, 193, 100, 199],
    ["^FO100,100^BY2^BSN,100,N,N^FD12^FS", 100, 139, 100, 199],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });

  test("UPC-A prints its first and last digits outside the bars", () => {
    const box = bounds("^FO100,100^BY2^BUN,100,Y,N^FD07000002198^FS");
    expect(box.left).toBeLessThan(100);
    expect(box.right).toBeGreaterThan(289);
  });

  test("UPC-A can leave out the check digit", () => {
    const box = bounds("^FO100,100^BY2^BUN,100,Y,N,N^FD07000002198^FS");
    expect(box.right).toBe(289);
  });

  test("the add-on prints its digits above the bars by default", () => {
    const { bars, text } = parts("^FO100,100^BY2^BSN,100^FD04414^FS");
    expect(text!.bottom).toBeLessThan(bars!.top);
  });
});

describe("Code 93", () => {
  test("is 9 modules per character with the check characters", () => {
    // Start, 10 characters, 2 check characters, stop and the final bar
    const box = bounds("^FO100,100^BY2^BAN,100,N,N^FD12345ABCDE^FS");
    expect(box).toStrictEqual({
      left: 100,
      right: 100 + 127 * 2 - 1,
      top: 100,
      bottom: 199,
    });
  });

  test("prints the data below the bars", () => {
    // The bars end at 199
    const box = bounds("^FO100,100^BY2^BAN,100,Y,N^FD12345ABCDE^FS");
    expect(box.bottom).toBeGreaterThan(205);
  });
});

describe("Codabar", () => {
  test("uses ^BY's ratio for wide elements", () => {
    const narrow = bounds("^FO100,100^BY2,2^BKN,N,100,N,N^FD123456^FS");
    const wide = bounds("^FO100,100^BY2,3^BKN,N,100,N,N^FD123456^FS");
    expect(narrow.left).toBe(100);
    expect(wide.right).toBeGreaterThan(narrow.right);
  });

  test("prints the start and stop characters", () => {
    const withText = parts("^FO100,100^BY2^BKN,N,100,Y,N,A,D^FD1^FS");
    expect(withText.text).toBeDefined();
  });
});

describe("^B0", () => {
  test("draws the same as ^BO", () => {
    expect(bounds("^FO100,100^B0N,4^FDhello^FS")).toStrictEqual(
      bounds("^FO100,100^BON,4^FDhello^FS")
    );
  });
});

describe("Code 11", () => {
  test.each([
    // Two check digits unless asked for one; wide bars are ^BY's ratio wide
    ["^FO100,100^BY2^B1N,N,100,N,N^FD12345^FS", 100, 277],
    ["^FO100,100^BY2,2^B1N,N,100,N,N^FD12345^FS", 100, 241],
    ["^FO100,100^BY2^B1N,Y,100,N,N^FD12345^FS", 100, 257],
  ])("%s", (body, left, right) => {
    expect(bounds(body)).toStrictEqual({ left, right, top: 100, bottom: 199 });
  });

  test("prints the check digits in the interpretation line", () => {
    // Reference: digits from x 149 to 229, between start and stop marks
    near(
      parts("^FO100,100^BY2^B1N,N,100,Y,N^FD12345^FS").text,
      {
        left: 149,
        right: 229,
        top: 206,
        bottom: 219,
      },
      2
    );
  });
});

describe("Code 39", () => {
  test.each([
    // Wide bars are ^BY's ratio wide, with a narrow gap between characters
    ["^FO100,100^BY1^B3N,N,50,N,N^FDAB1^FS", 100, 178],
    ["^FO100,100^BY2^B3N,N,50,N,N^FDAB1^FS", 100, 257],
    ["^FO100,100^BY2,2.5^B3N,N,50,N,N^FDAB1^FS", 100, 242],
    // The Mod-43 check digit adds a character
    ["^FO100,100^BY2^B3N,Y,50,N,N^FDAB1^FS", 100, 289],
    // Lowercase letters are encoded as capitals
    ["^FO100,100^BY1^B3N,N,50,N,N^FDab-1^FS", 100, 194],
  ])("%s", (body, left, right) => {
    expect(bounds(body)).toStrictEqual({ left, right, top: 100, bottom: 149 });
  });

  test("draws the bars dot for dot", () => {
    const raster = render("^FO100,100^BY1^B3N,N,50,N,N^FDAB1^FS");
    const runs: number[] = [];
    let previous = true;
    for (let x = 100; x <= 178; x++) {
      const dot = raster.ink[110 * raster.width + x] >= 0.5;
      if (dot === previous && runs.length) runs[runs.length - 1]++;
      else runs.push(1);
      previous = dot;
    }
    expect(runs.join(",")).toBe(
      "1,3,1,1,3,1,3,1,1,1,3,1,1,1,1,3,1,1,3,1,1,1,3,1,1,3,1,1,3,1,3,1,1,3,1,1,1,1,3,1,1,3,1,1,3,1,3,1,1"
    );
  });

  test.each([
    // The interpretation line shows the start and stop characters as *
    ["^FO100,100^BY2^B3N,N,50,Y,N^FDAB1^FS", 149, 206, 156, 169],
    ["^FO100,200^BY2^B3N,N,50,Y,Y^FDAB1^FS", 149, 206, 174, 187],
    ["^FO100,100^BY2^B3N,N,50,Y,N^FDab-1^FS", 159, 228, 156, 169],
    // ...and the check digit
    ["^FO100,100^BY2^B3N,Y,50,Y,N^FDAB1^FS", 161, 227, 156, 169],
  ])("interpretation line of %s", (body, left, right, top, bottom) => {
    near(parts(body).text, { left, right, top, bottom });
  });
});

describe("Interleaved 2 of 5", () => {
  test.each([
    ["^FO100,100^BY1^B2N,50,N,N,N^FD1234^FS", 100, 144],
    ["^FO100,100^BY2^B2N,50,N,N,N^FD1234^FS", 100, 189],
    // An odd number of digits gets a leading zero
    ["^FO100,100^BY2,2^B2N,50,N,N,N^FD123^FS", 100, 171],
    // The check digit comes before padding: 1234 becomes 012342
    ["^FO100,100^BY2^B2N,50,N,N,Y^FD1234^FS", 100, 225],
    // Anything but digits is left out
    ["^FO100,100^BY2^B2N,50,N,N,N^FD12A34^FS", 100, 189],
  ])("%s", (body, left, right) => {
    expect(bounds(body)).toStrictEqual({ left, right, top: 100, bottom: 149 });
  });

  test("draws the bars dot for dot", () => {
    const raster = render("^FO100,100^BY2^B2N,50,N,N,Y^FD1234^FS");
    const runs: number[] = [];
    let previous = true;
    for (let x = 100; x <= 225; x++) {
      const dot = raster.ink[110 * raster.width + x] >= 0.5;
      if (dot === previous && runs.length) runs[runs.length - 1]++;
      else runs.push(1);
      previous = dot;
    }
    expect(runs.join(",")).toBe(
      "2,2,2,2,2,6,2,2,6,2,6,2,2,6,2,6,6,6,2,2,2,2,6,2,2,2,2,6,6,2,2,2,6,6,6,2,2"
    );
  });

  test.each([
    ["^FO100,100^BY2^B2N,50,Y,N,N^FD123456^FS", 128, 195, 156, 169],
    ["^FO100,200^BY2^B2N,50,Y,Y,N^FD123456^FS", 128, 195, 174, 187],
  ])("interpretation line of %s", (body, left, right, top, bottom) => {
    near(parts(body).text, { left, right, top, bottom });
  });
});

describe("PDF417", () => {
  test.each([
    // Columns of 17 modules, between start, stop and row indicators
    ["^FO100,100^BY2^B7N,10,0,3^FDhello^FS", 100, 339, 100, 129],
    ["^FO100,100^BY3^B7N,10,0,3^FDhello^FS", 100, 459, 100, 129],
    ["^FO100,100^BY2^B7N,10,0,3,10^FDhello^FS", 100, 339, 100, 199],
    // Truncated: no right row indicators, and a one-module stop
    ["^FO100,100^BY2^B7N,10,0,3,,Y^FDhello^FS", 100, 271, 100, 129],
    // Without a row height, ^BY's height is shared between the rows
    ["^FO100,100^BY2^B7N,,0,3^FDhello^FS", 100, 339, 100, 108],
    ["^FO100,100^BY2,3,30^B7N,,0,3^FDhello^FS", 100, 339, 100, 129],
    // ^FT places the bottom row
    ["^FT100,300^BY2^B7N,10,0,3^FDhello^FS", 100, 339, 270, 299],
    ["^FO100,100^BY2^B7R,10,0,3^FDhello^FS", 100, 129, 100, 339],
    ["^FT300,300^BY2^B7R,10,0,3^FDhello^FS", 300, 329, 300, 539],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });

  test.each([
    // Without columns, the symbol is about twice as wide as it's tall,
    // counting rows as 3 modules
    ["^B7N,10,0^FDhello", 1, 6],
    ["^B7N,10^FDhello", 1, 6],
    ["^B7N,10,5^FDhello", 3, 23],
    [
      "^B7N,10,0^FDThe quick brown fox jumps over the lazy dog 1234567890",
      2,
      16,
    ],
    // Reference renders pack some runs of digits into a few more codewords than
    // bwip-js does (45 digits take 21 or 22, not 20), so those can differ
    [`^B7N,10,0^FD${"1234567890".repeat(25).slice(0, 10)}`, 1, 8],
    [`^B7N,10,0^FD${"1234567890".repeat(25).slice(0, 130)}`, 3, 17],
  ])("%s has %i columns and %i rows", (field, columns, rows) => {
    expect(bounds(`^FO10,10^BY1${field}^FS`)).toStrictEqual({
      left: 10,
      right: 10 + 69 + 17 * columns - 1,
      top: 10,
      bottom: 10 + 10 * rows - 1,
    });
  });
});

describe("Aztec", () => {
  test.each([
    // Magnification is the module size, 2 by default at 8 dpmm
    ["^FO100,100^BON,4^FDhello^FS", 100, 159, 100, 159],
    ["^FO100,100^BO^FDhello^FS", 100, 129, 100, 129],
    ["^FO100,100^BON,2^FDhello^FS", 100, 129, 100, 129],
    // The smallest symbol that fits, unless error control asks otherwise
    [
      "^FO100,100^BON,4,N,0^FDhello world hello world hello world^FS",
      100,
      191,
      100,
      191,
    ],
    ["^FO100,100^BON,4,N,50^FDhello^FS", 100, 159, 100, 159],
    ["^FO100,100^BON,4,N,102^FDhello^FS", 100, 175, 100, 175],
    ["^FO100,100^BON,4,N,203^FDhello^FS", 100, 207, 100, 207],
    ["^FT100,300^BON,4^FDhello^FS", 100, 159, 240, 299],
    ["^FO100,100^BOR,4^FDhello^FS", 100, 159, 100, 159],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });

  test("prefers a compact symbol to a full one of the same size", () => {
    // Reference: 23 modules of compact, not full, Aztec; its first row
    const raster = render(
      "^FO10,10^BON,1^FDhello world hello world hello world^FS"
    );
    const row = Array.from({ length: 23 }, (_, x) =>
      raster.ink[10 * raster.width + 10 + x] >= 0.5 ? "1" : "0"
    ).join("");
    expect(row).toBe("11000101100001100101001");
  });

  test("draws the modules dot for dot", () => {
    const raster = render("^FO10,10^BON,1^FDhello^FS");
    const rows = Array.from({ length: 15 }, (_, y) =>
      Array.from({ length: 15 }, (_, x) =>
        raster.ink[(10 + y) * raster.width + 10 + x] >= 0.5 ? "#" : "."
      ).join("")
    );
    expect(rows).toStrictEqual([
      "..#...#..######",
      "##..#..#.#...##",
      "#.##.....#..###",
      "..###########..",
      "#..#.......#.##",
      ".#.#.#####.####",
      "..##.#...#.#.##",
      "##.#.#.#.#.####",
      "...#.#...#.#.##",
      "##.#.#####.#...",
      ".#.#.......#...",
      ".#.##########.#",
      "#...###.###....",
      "#..###.###.#.##",
      "#...#..#..#..#.",
    ]);
  });
});

describe("MaxiCode", () => {
  // A UPS-style carrier message: class of service 002, country 840, postal
  // code 100450000, then the rest after [)>
  const ups =
    "002840100450000[)>\x1e01\x1d961Z00004951\x1dUPSN\x1d06X610\x1d159\x1d1234567\x1d1/1\x1d\x1dY\x1d634 ALPHA DR\x1dPITTSBURGH\x1dPA\x1e\x04";

  test.each([
    // Always the same size: about 25 by 24 mm
    ["^FO100,100^BD4^FDHello MaxiCode^FS", 100, 299, 100, 292],
    [`^FO100,100^BD2^FD${ups}^FS`, 100, 299, 100, 292],
    ["^FT100,300^BD4^FDHello MaxiCode^FS", 100, 299, 105, 297],
  ])("%s", (body, left, right, top, bottom) => {
    near(bounds(body), { left, right, top, bottom }, 1);
  });

  test("has a bullseye in the middle", () => {
    const raster = render("^FO100,100^BD4^FDHello MaxiCode^FS");
    const dot = (x: number, y: number) =>
      raster.ink[y * raster.width + x] >= 0.5;
    // From the center outward: white, then dark and white rings
    const row = Array.from({ length: 30 }, (_, i) => dot(199 + i, 196));
    expect(row[0]).toBe(false);
    expect(row.filter((d, i) => i > 0 && d !== row[i - 1]).length).toBe(6);
  });
});

describe("QR code", () => {
  test.each([
    // ^FO places it 10 dots lower; version 1 is 21 modules
    ["^FO100,100^BQN,2,4^FDQA,hello^FS", 100, 183, 110, 193],
    ["^FO100,100^BQN,2,1^FDQA,hello^FS", 100, 120, 110, 130],
    ["^FO100,100^BQ^FDQA,hello^FS", 100, 141, 110, 151],
    ["^FO100,100^BQN,2,4^FDQA,hello world hello world^FS", 100, 215, 110, 225],
    // ^FT puts its bottom 3 modules above y
    ["^FT100,300^BQN,2,1^FDQA,hello^FS", 100, 120, 276, 296],
    ["^FT100,300^BQN,2,8^FDQA,hello^FS", 100, 267, 108, 275],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });
});

describe("Data Matrix", () => {
  test.each([
    ["^FO100,100^BXN,6,200^FDhello^FS", 100, 171, 100, 171],
    [
      "^FO100,100^BXN,6,200^FDhttps://github.com/ludwig-f/node-zpl^FS",
      100,
      243,
      100,
      243,
    ],
    ["^FT100,300^BXN,6,200^FDhello^FS", 100, 171, 228, 299],
    ["^FO100,100^BXN,,200^FDhello^FS", 100, 111, 100, 111],
    ["^FO100,100^BXR,6,200^FDhello^FS", 100, 171, 100, 171],
    ["^FO100,100^BXN,6,200,20,20^FDhello^FS", 100, 219, 100, 219],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });
});

describe("2 of 5, LOGMARS, MSI and Plessey", () => {
  test.each([
    // Wide elements are the module width times ^BY's ratio, rounded down
    ["^FO100,100^BY2,2^BIN,100,N,N^FD123456^FS", 273],
    ["^FO100,100^BY3,2.5^BIN,100,N,N^FD123456^FS", 376],
    ["^FO100,100^BY2,2^BJN,100,N,N^FD123456^FS", 259],
    ["^FO100,100^BY2,2^BMN,A,100,N,N^FD123456^FS", 257],
    ["^FO100,100^BY2^BMN,D,100,N,N,N^FD12345678901^FS", 533],
    ["^FO100,100^BY2,2^BPN,N,100,N,N^FD12345^FS", 321],
    ["^FO100,100^BY3^BPN,N,100,N,N^FD12345^FS", 543],
    ["^FO100,100^BY3,2.5^B3N,N,100,N,N^FD12AB^FS", 348],
    ["^FO100,100^BY3,2.5^B2N,100,N,N^FD123456^FS", 262],
    ["^FO100,100^BY3,2.5^B1N,N,100,N,N^FD123456^FS", 356],
  ])("%s", (body, right) => {
    expect(bounds(body)).toStrictEqual({
      left: 100,
      right,
      top: 100,
      bottom: 199,
    });
  });

  test("LOGMARS prints its text without Code 39's asterisks", () => {
    // 12AB and the check digit 0, centered under bars 100 to 321
    const { text } = parts("^FO100,100^BY2^BLN,100,N^FD12AB^FS");
    expect(text!.left).toBeGreaterThan(170);
    expect(text!.right).toBeLessThan(250);
  });
});

describe("postal codes, GS1 DataBar and MicroPDF417", () => {
  test.each([
    // Bars a module wide, two and a half modules apart, short ones 0.4 high
    ["^FO100,100^BY2^BZN,40,N,N^FD12345^FS", 100, 256, 100, 139],
    ["^FO100,100^BY3^BZN,40,N,N^FD123456789^FS", 100, 458, 100, 139],
    ["^FO100,100^BY2^BZN,40,,,3^FD00123123456123456789^FS", 100, 421, 100, 139],
    // GS1 DataBar takes the field's orientation, like other barcodes
    ["^FO100,100^BRN,1,2^FD12345678901^FS", 102, 291, 100, 165],
    ["^FO300,100^BR^FD12345678901^FS", 302, 491, 100, 165],
    ["^FO100,30^BY3^BFN,8,3^FDABCDEFGHIJKLMNOPQRSTUV^FS", 100, 213, 30, 189],
  ])("%s", (body, left, right, top, bottom) => {
    expect(bounds(body)).toStrictEqual({ left, right, top, bottom });
  });

  test("GS1 DataBar Expanded reads AIs from the digits", () => {
    // AI 01 with a GTIN, then AI 21 with a serial number
    expect(
      bounds("^FO50,100^BRN,6,2^FD010001234567890521ABC^FS")
    ).toStrictEqual({
      left: 52,
      right: 449,
      top: 100,
      bottom: 167,
    });
  });

  test("GS1 DataBar Expanded keeps its leading space when segments fit one row", () => {
    // Up to 22 segments a row fits the whole symbol on one row, which starts
    // a module in, as without segments
    expect(
      bounds("^FO50,100^BRN,6,2,1,60,22^FD010001234567890521ABC^FS")
    ).toStrictEqual(
      bounds("^FO50,100^BRN,6,2,1,60^FD010001234567890521ABC^FS")
    );
  });

  test("GS1 DataBar Expanded with parentheses draws a placeholder", () => {
    // Printers encode the parentheses as data, which we can't. The symbol
    // would be 34 modules (68 dots) tall; the placeholder is 40.
    const box = bounds("^FO50,100^BRN,6,2^FD(01)00012345678905^FS");
    expect(box.top).toBe(100);
    expect(box.bottom - box.top + 1).toBe(40);
  });

  test("data a barcode can't encode draws a placeholder", () => {
    // Intelligent Mail needs 20, 25, 29 or 31 digits
    const raster = render("^FO100,100^BZN,40,,,3^FD123^FS");
    expect(raster.ink.some((ink) => ink > 0)).toBe(true);
  });
});

describe("barcodes we can't draw yet", () => {
  // GS1 DataBar composites, with a 2D part after the |
  const body = "^FO100,100^BY2,3,60^BRN,7^FD12345678901|ABC^FS";

  test("don't print their data as text", () => {
    const [label] = layout(parse(`^XA${body}^XZ`).commands);
    expect(label.elements.map((element) => element.kind)).toStrictEqual([
      "placeholder",
    ]);
    expect(label.elements[0]).toMatchObject({
      code: "^BR",
      x: 100,
      y: 100,
      height: 60,
    });
    expect(label.unsupported).toStrictEqual([3, 4]);
  });

  test("draw a placeholder as tall as ^BY's height", () => {
    const { left, top, bottom } = bounds(body);
    expect({ left, top, bottom }).toStrictEqual({
      left: 100,
      top: 100,
      bottom: 159,
    });
  });

  test("placeholders are at least 40 dots tall", () => {
    expect(bounds("^FT100,300^BRN,7^FD12345^FS")).toMatchObject({
      top: 260,
      bottom: 299,
    });
  });

  test("placeholders fit their text at higher resolutions", () => {
    // Font D at 24 dpmm is 54 dots tall, between 6-dot lines
    const [raster] = renderLabels("^XA^FO100,100^BRN,7^FDx^FS^XZ", {
      widthMm: 101.6,
      heightMm: 101.6,
      dpmm: 24,
    });
    let top = Infinity;
    let bottom = -1;
    for (let y = 0; y < raster.height; y++) {
      if (raster.ink[y * raster.width + 101] < 0.5) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    expect(bottom - top + 1).toBeGreaterThanOrEqual(54 + 2 * 6 + 4);
  });

  test("a barcode we draw, with parameters we can't read, says so", () => {
    const [label] = layout(parse("^XA^FO10,10^BCQ,100^FD12^FS^XZ").commands);
    expect(label.elements).toMatchObject([
      { kind: "placeholder", code: "^BC", reason: "invalid" },
    ]);
    const [other] = layout(parse("^XA^FO10,10^BR,1^FD1|2^FS^XZ").commands);
    expect(other.elements).toMatchObject([
      { kind: "placeholder", code: "^BR", reason: "unsupported" },
    ]);
  });

  test("^BY isn't a barcode", () => {
    const [label] = layout(parse("^XA^BY3^FO10,10^FDHI^FS^XZ").commands);
    expect(label.elements[0].kind).toBe("text");
  });
});
