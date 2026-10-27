import { test } from "vitest";
import Label from "./Label.js";
import { dots, mm } from "./units.js";

test("lengths require an explicit unit", () => {
  // @ts-expect-error - bare numbers are ambiguous
  new Label({ width: 57, height: mm(19), dpmm: 12 });

  const label = new Label({ width: mm(57), height: mm(19), dpmm: 12 });

  label.box({
    // @ts-expect-error - bare numbers are ambiguous
    position: { x: 10, y: dots(10) },
    width: mm(10),
    height: mm(10),
    thickness: dots(2),
  });

  label.code128({
    position: { x: dots(10), y: dots(10) },
    data: "ABC",
    // @ts-expect-error - bare numbers are ambiguous
    height: 9,
  });
});

test("dpmm must be a real printer resolution", () => {
  // @ts-expect-error - no 10 dpmm printers
  new Label({ width: mm(57), height: mm(19), dpmm: 10 });
});
