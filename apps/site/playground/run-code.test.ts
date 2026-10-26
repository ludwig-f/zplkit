import { describe, test, expect } from "vitest";
import { run } from "./run-code-core";
import { analyze } from "./analyze";
import codeExamples from "./code-examples";

describe("examples", () => {
  test.each(codeExamples.map((example) => [example.name, example.code]))(
    "%s runs and prints without problems",
    (_name, code) => {
      const outcome = run(code);
      if (!outcome.ok) throw new Error(outcome.message);
      expect(analyze(outcome.zpl, { dpmm: outcome.dpmm })).toStrictEqual([]);
    }
  );

  test("a print job shows every label", () => {
    const outcome = run(codeExamples[1].code);
    expect(outcome.ok && outcome.zpl.match(/\^XA/g)).toHaveLength(3);
  });
});

describe("run", () => {
  const imports = `import { Label, Text, build, mm } from "@zplkit/core/jsx";\n`;

  test("builds an exported <Label> element", () => {
    const outcome = run(
      `${imports}export default <Label width={mm(10)} height={mm(10)} dpmm={12} />;`
    );
    expect(outcome).toMatchObject({ ok: true, dpmm: 12 });
  });

  test("points syntax errors at their line", () => {
    expect(run(`${imports}\nconst a = <Label>;`)).toMatchObject({
      ok: false,
      line: 3,
    });
  });

  test("points errors thrown while running at their line", () => {
    const outcome = run(`${imports}\nconst x = 1;\nnull.boom;`);
    expect(outcome).toMatchObject({ ok: false, line: 4 });
  });

  test("explains resolutions printers don't have", () => {
    const outcome = run(
      `${imports}\nexport default build(<Label width={mm(50)} height={mm(25)} dpmm={1300} />);`
    );
    expect(outcome).toMatchObject({
      ok: false,
      message: expect.stringContaining("dpmm must be 6, 8, 12 or 24"),
      line: 3,
    });
  });

  test("only allows zplkit imports", () => {
    expect(
      run(`import fs from "node:fs";\nfs.readFileSync("secret");`)
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('not "node:fs"'),
    });
  });

  test("asks for an export when there's none", () => {
    expect(run(`${imports}const label = 1;`)).toMatchObject({
      ok: false,
      message: expect.stringContaining("export default label"),
    });
  });
});
