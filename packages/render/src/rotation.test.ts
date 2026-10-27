// Rotated text, as measured from reference renders at 8 dpmm. A rotated field is its
// unrotated text block turned in whole dots: ^FO puts the turned block's
// top-left corner at the origin, ^FT turns it about the start of the baseline.
import { describe, test, expect } from "vitest";
import { renderLabels } from "./render.js";

const size = { widthMm: 101.6, heightMm: 101.6, dpmm: 8 };

/** Printed dots as [left, right, top, bottom], relative to (400, 400) */
const ink = (body: string) => {
  const [raster] = renderLabels(`^XA^PW812${body}^XZ`, size);
  let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let y = 0; y < raster.height; y++) {
    for (let x = 0; x < raster.width; x++) {
      if (raster.ink[y * raster.width + x] < 0.5) continue;
      left = Math.min(left, x - 400);
      right = Math.max(right, x - 400);
      top = Math.min(top, y - 400);
      bottom = Math.max(bottom, y - 400);
    }
  }
  return [left, right, top, bottom];
};

describe.each([
  // font, block height, block width of "HHg"
  // Font 0: H advances 60.89 and g 49.78, so the block is ceil(171.56) - 1 wide
  ["^A0{o},100,100", 100, 171],
  // Font D: 18-dot cells, 12 dots apart
  ["^AD{o}", 18, 35],
  // Font E doubled: 56-dot cells, 40 dots apart
  ["^AE{o},56", 56, 119],
])("%s", (font, height, width) => {
  const field = (position: string, orientation: string) =>
    ink(`${position}${font.replace("{o}", orientation)}^FDHHg^FS`);

  const [left, right, top, bottom] = field("^FO400,400", "N");
  const baseline = field("^FT400,400", "N");

  test("^FO R turns the block a quarter clockwise", () => {
    expect(field("^FO400,400", "R")).toStrictEqual([
      height - 1 - bottom,
      height - 1 - top,
      left,
      right,
    ]);
  });

  test("^FO I turns the block upside down", () => {
    expect(field("^FO400,400", "I")).toStrictEqual([
      width - 1 - right,
      width - 1 - left,
      height - 1 - bottom,
      height - 1 - top,
    ]);
  });

  test("^FO B turns the block a quarter counterclockwise", () => {
    expect(field("^FO400,400", "B")).toStrictEqual([
      top,
      bottom,
      width - 1 - right,
      width - 1 - left,
    ]);
  });

  test("^FT turns the text about the start of the baseline", () => {
    const [l, r, t, b] = baseline;
    expect(field("^FT400,400", "R")).toStrictEqual([-1 - b, -1 - t, l, r]);
    expect(field("^FT400,400", "I")).toStrictEqual([
      -1 - r,
      -1 - l,
      -1 - b,
      -1 - t,
    ]);
    expect(field("^FT400,400", "B")).toStrictEqual([t, b, -1 - r, -1 - l]);
  });
});

test("font 0 turned clockwise from ^FO matches reference renders", () => {
  // Reference: capitals span x 25..99 for ^A0R,100,100 at ^FO400,400
  expect(ink("^FO400,400^A0R,100,100^FDH^FS").slice(0, 2)).toStrictEqual([
    25, 99,
  ]);
});

describe("^FW", () => {
  const turned = ink("^FO400,400^A0R,100^FDHH^FS");

  test("sets the orientation of fonts that don't give one", () => {
    expect(ink("^FWR^FO400,400^A0,100^FDHH^FS")).toStrictEqual(turned);
    expect(ink("^FWR^CF0,100^FO400,400^FDHH^FS")).toStrictEqual(turned);
  });

  test("applies when the field data comes", () => {
    expect(ink("^FO400,400^A0,100^FWR^FDHH^FS")).toStrictEqual(turned);
  });

  test("lasts for the rest of the label", () => {
    expect(ink("^FWR^FS^FO400,400^A0,100^FDHH^FS")).toStrictEqual(turned);
  });

  test("doesn't override an orientation given in ^A", () => {
    expect(ink("^FWR^FO400,400^A0N,100^FDHH^FS")).toStrictEqual(
      ink("^FO400,400^A0N,100^FDHH^FS")
    );
  });
});
