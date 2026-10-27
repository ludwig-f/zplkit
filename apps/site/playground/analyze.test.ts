import { describe, test, expect } from "vitest";
import { analyze } from "./analyze";

describe("analyze", () => {
  test("finds nothing wrong with a valid label", () => {
    expect(
      analyze("^XA^PW400^LL200^FO10,10^FDHi^FS^XZ", { dpmm: 8 })
    ).toStrictEqual([]);
  });

  test("reports lint problems with their position and line", () => {
    const zpl = "^XA\n^FO10,10^GB1,64,2^FS\n^XZ";
    const [problem] = analyze(zpl, { dpmm: 8 });

    expect(problem).toStrictEqual({
      from: 12,
      to: 21,
      line: 2,
      severity: "warning",
      rule: "box-smaller-than-line",
      message:
        "The box is 1 dot wide but its line is 2 dots thick, so the printer widens it to 2 dots.",
    });
    expect(zpl.slice(problem.from, problem.to)).toBe("^GB1,64,2");
  });

  test("reports parameters the parser couldn't read", () => {
    const [problem] = analyze("^XA^FOabc,10^FS^XZ", { dpmm: 8 });

    expect(problem).toMatchObject({
      rule: "invalid-parameter",
      severity: "warning",
      message: "^FO: x must be a number, got 'abc'",
      line: 1,
    });
  });

  test("checks fields against the label size from the settings", () => {
    const zpl = "^XA^FO10,500^FDlow^FS^XZ";

    expect(analyze(zpl, { dpmm: 8 })).toStrictEqual([]);
    expect(
      analyze(zpl, { dpmm: 8, widthMm: 50, heightMm: 25 }).map((p) => p.rule)
    ).toStrictEqual(["field-outside-label"]);
  });

  test("lists problems in the order they appear", () => {
    const problems = analyze("^FO10,10^FDa^FS^XA^GB1,64,2^FS", { dpmm: 8 });

    expect(problems.map((p) => p.from)).toStrictEqual(
      [...problems.map((p) => p.from)].sort((a, b) => a - b)
    );
  });
});
