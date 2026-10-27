// Text blocks (^FB), as measured from reference renders at 8 dpmm. Font 0's letter
// shapes differ slightly from the references, so its lines may start a dot early.
import { describe, test, expect } from "vitest";
import { renderLabels } from "./render.js";

const size = { widthMm: 101.6, heightMm: 101.6, dpmm: 8 };

type Line = [top: number, bottom: number, left: number, right: number];

/** Each run of rows with ink, with its extent, relative to (400, 400) */
const lines = (body: string): Line[] => {
  const [raster] = renderLabels(`^XA^PW812${body}^XZ`, size);
  const found: Line[] = [];
  let line: Line | undefined;
  for (let y = 0; y < raster.height; y++) {
    let left = Infinity;
    let right = -Infinity;
    for (let x = 0; x < raster.width; x++) {
      if (raster.ink[y * raster.width + x] < 0.5) continue;
      left = Math.min(left, x - 400);
      right = Math.max(right, x - 400);
    }
    if (right < left) {
      line = undefined;
    } else if (line) {
      line[1] = y - 400;
      line[2] = Math.min(line[2], left);
      line[3] = Math.max(line[3], right);
    } else {
      line = [y - 400, y - 400, left, right];
      found.push(line);
    }
  }
  return found;
};

const expectLines = (body: string, expected: Line[], slack = 0) => {
  const actual = lines(body);
  expect(actual.map(([top, bottom]) => [top, bottom])).toStrictEqual(
    expected.map(([top, bottom]) => [top, bottom])
  );
  actual.forEach(([, , left, right], i) => {
    expect(Math.abs(left - expected[i][2])).toBeLessThanOrEqual(slack);
    expect(Math.abs(right - expected[i][3])).toBeLessThanOrEqual(slack);
  });
};

describe("font 0", () => {
  const font = "^FO400,400^A0N,40";
  const words = "^FDHHHH HHHH HHHH HHHH^FS";

  test.each<[string, Line[]]>([
    // Wrapping at spaces, one font height apart
    [
      `^FB300,5${words}`,
      [
        [0, 29, 3, 203],
        [40, 69, 3, 203],
      ],
    ],
    // Line spacing adds to the font height
    [
      `^FB300,5,10${words}`,
      [
        [0, 29, 3, 203],
        [50, 79, 3, 203],
      ],
    ],
    [`^FB300,5,-10${words}`, [[0, 59, 3, 203]]],
    // Centered and right-aligned lines count the space they wrapped at
    [
      `^FB300,5,,C${words}`,
      [
        [0, 29, 44, 244],
        [40, 69, 44, 244],
      ],
    ],
    [
      `^FB300,5,,R${words}`,
      [
        [0, 29, 85, 285],
        [40, 69, 97, 297],
      ],
    ],
    // Justified lines fill the width, except the last
    [
      "^FB300,5,,J^FDHHHH HH HHHH HHHH HH^FS",
      [
        [0, 29, 3, 297],
        [40, 69, 3, 154],
      ],
    ],
    [
      "^FB300,5,,J^FDHHHH HH HHHH\\&HH HH^FS",
      [
        [0, 29, 3, 297],
        [40, 69, 3, 106],
      ],
    ],
    // The hanging indent moves every line but the first
    [
      `^FB300,5,,L,30${words}`,
      [
        [0, 29, 3, 203],
        [40, 69, 33, 233],
      ],
    ],
    [
      "^FB300,5,,L,30^FDHH\\&HH HHHH HHHH HHHH HHHH^FS",
      [
        [0, 29, 3, 45],
        [40, 69, 33, 294],
        [80, 109, 33, 233],
      ],
    ],
    [
      "^FB300,5,,J,30^FDHHHH HH HHHH HH HH HHHH HH^FS",
      [
        [0, 29, 3, 297],
        [40, 69, 33, 297],
        [80, 109, 33, 75],
      ],
    ],
    // ...but not centered or right-aligned ones
    [
      `^FB300,5,,C,30${words}`,
      [
        [0, 29, 44, 244],
        [40, 69, 44, 244],
      ],
    ],
    [
      `^FB300,5,,R,30${words}`,
      [
        [0, 29, 85, 285],
        [40, 69, 97, 297],
      ],
    ],
    // Lines past the last one print over it
    [`^FB300${words}`, [[0, 29, 2, 203]]],
    [
      "^FB300,2^FDHHHH HHHH HHHH HHHH HHHH HHHH^FS",
      [
        [0, 29, 3, 203],
        [40, 69, 2, 203],
      ],
    ],
    // \& breaks the line
    [
      "^FB300,5^FDHH\\&HHH\\&\\&H^FS",
      [
        [0, 29, 3, 45],
        [40, 69, 3, 70],
        [120, 149, 3, 21],
      ],
    ],
    [
      "^FB300,5,,C^FDHHHH\\&HH^FS",
      [
        [0, 29, 104, 195],
        [40, 69, 123, 165],
      ],
    ],
    // Words wider than the block break between letters, on a line of their own
    [
      "^FB100,5^FDHHHHHHHHHH^FS",
      [
        [0, 29, 3, 94],
        [40, 69, 3, 94],
        [80, 109, 3, 45],
      ],
    ],
    [
      "^FB300,5^FDHH HHHHHHHHHHHHHHHH^FS",
      [
        [0, 29, 3, 45],
        [40, 69, 3, 289],
        [80, 109, 3, 94],
      ],
    ],
    [
      "^FB300,5,,L,30^FDHHHHHHHHHHHHHHHHHHHH^FS",
      [
        [0, 29, 3, 289],
        [40, 69, 33, 221],
      ],
    ],
    // Spaces where a line breaks, and at the start, don't print
    [
      "^FB300,5^FDHHHH HHHH  HHHH^FS",
      [
        [0, 29, 3, 203],
        [40, 69, 3, 94],
      ],
    ],
    [
      "^FB300,5^FDHHHH HHHH HHHH  HHHH^FS",
      [
        [0, 29, 3, 203],
        [40, 69, 3, 215],
      ],
    ],
    ["^FB300,3^FD HHHH^FS", [[0, 29, 3, 94]]],
    [
      "^FB300,5,,R^FDHHHH HHHH HHHH  ^FS",
      [
        [0, 29, 85, 285],
        [40, 69, 194, 285],
      ],
    ],
    // A line fits when its advance is no wider than the block (206.6 dots)
    [
      "^FB206,5^FDHHHH HHHH^FS",
      [
        [0, 29, 3, 94],
        [40, 69, 3, 94],
      ],
    ],
    ["^FB207,5^FDHHHH HHHH^FS", [[0, 29, 3, 203]]],
  ])("%s", (block, expected) => {
    expectLines(`${font}${block}`, expected, 1);
  });

  test("^FT puts the baseline of the last possible line at y", () => {
    expectLines(
      `^FT400,400^A0N,40^FB300,5${words}`,
      [
        [-190, -161, 3, 203],
        [-150, -121, 3, 203],
      ],
      1
    );
    expectLines(
      "^FT400,400^A0N,40^FB300,3,10^FDHHHH HHHH^FS",
      [[-130, -101, 3, 203]],
      1
    );
  });
});

describe("bitmap fonts", () => {
  test.each<[string, Line[]]>([
    [
      "^FO400,400^ADN^FB100,5^FDHHHH HHHH HHHH^FS",
      [
        [0, 13, 0, 44],
        [18, 31, 0, 44],
        [36, 49, 0, 44],
      ],
    ],
    [
      "^FO400,400^ADN,36^FB200,5,4^FDHHHH HHHH HHHH^FS",
      [
        [0, 27, 1, 90],
        [40, 67, 1, 90],
        [80, 107, 1, 90],
      ],
    ],
    ["^FO400,400^ADN^FB108,5^FDHHHH HHHH^FS", [[0, 13, 0, 104]]],
    [
      "^FO400,400^ADN^FB107,5^FDHHHH HHHH^FS",
      [
        [0, 13, 0, 44],
        [18, 31, 0, 44],
      ],
    ],
    // Centering rounds half a dot to the right
    ["^FO400,400^ADN^FB120,5,,C^FDH^FS", [[0, 13, 48, 56]]],
    ["^FO400,400^ADN^FB120,5,,C^FDHH^FS", [[0, 13, 42, 62]]],
    ["^FO400,400^ADN^FB121,5,,C^FDHH^FS", [[0, 13, 43, 63]]],
    ["^FO400,400^ADN^FB120,5,,R^FDHH^FS", [[0, 13, 96, 116]]],
    ["^FO400,400^ADN^FB120,5,,R^FDHHHH HHHH^FS", [[0, 13, 12, 116]]],
    [
      "^FT400,400^ADN^FB100,3^FDHHHH HHHH^FS",
      [
        [-50, -37, 0, 44],
        [-32, -19, 0, 44],
      ],
    ],
  ])("%s", (body, expected) => {
    expectLines(body, expected);
  });
});

describe("rotated blocks", () => {
  /** Bounds of all printed dots as [left, right, top, bottom] */
  const bounds = (body: string) => {
    const found = lines(body);
    return [
      Math.min(...found.map((l) => l[2])),
      Math.max(...found.map((l) => l[3])),
      found[0][0],
      found[found.length - 1][1],
    ];
  };
  const text = "^A0{o},40^FB300,3,10^FDHHHH HHHH HHHH HHHH^FS";
  const field = (position: string, orientation: string) =>
    bounds(`${position}${text.replace("{o}", orientation)}`);

  test("turn the whole block, as wide as ^FB and as tall as its lines", () => {
    // The block is 300 wide and 3 lines of 50 tall
    const [left, right, top, bottom] = field("^FO400,400", "N");
    expect(field("^FO400,400", "R")).toStrictEqual([
      149 - bottom,
      149 - top,
      left,
      right,
    ]);
    expect(field("^FO400,400", "I")).toStrictEqual([
      299 - right,
      299 - left,
      149 - bottom,
      149 - top,
    ]);
  });

  test("turn about the baseline of the last possible line with ^FT", () => {
    const [left, right, top, bottom] = field("^FT400,400", "N");
    expect(field("^FT400,400", "B")).toStrictEqual([
      top,
      bottom,
      -1 - right,
      -1 - left,
    ]);
  });

  test("match reference renders", () => {
    // Reference: upside down, lines at y 70..99 and 120..149
    expect(field("^FO400,400", "I").slice(2)).toStrictEqual([70, 149]);
    // Reference: bottom up, x 0..79 from ^FO and -130..-51 from ^FT
    expect(field("^FO400,400", "B").slice(0, 2)).toStrictEqual([0, 79]);
    expect(field("^FT400,400", "B").slice(0, 2)).toStrictEqual([-130, -51]);
    expect(bounds("^FO400,400^ADB^FB100,3^FDHHHH HHHH^FS")).toStrictEqual([
      0, 31, 55, 99,
    ]);
  });
});
