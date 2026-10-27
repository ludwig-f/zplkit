import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { convert } from "./convert.js";
import { parse } from "./parse.js";
import { serialize } from "./serialize.js";
import Label from "./Label.js";
import PrinterSetup from "./PrinterSetup.js";
import PrintJob from "./PrintJob.js";
import { Orientation } from "./types.js";
import { dots, mm } from "./units.js";
import type { Command } from "./ast.js";
import * as zplJsx from "./jsx.js";
import { jsx } from "./jsx-runtime.js";
import { transformWithEsbuild } from "vite";

// The playground's examples, loaded at run time since they're outside src
const examplesPath = "../../../apps/site/playground/examples.js";
const { default: examples } = (await import(
  /* @vite-ignore */ examplesPath
)) as {
  default: { name: string; zpl: string }[];
};

const details = JSON.parse(
  readFileSync(
    new URL("../../../apps/site/content/command-details.json", import.meta.url),
    "utf8"
  )
) as Record<string, { example?: string }>;

/** Run builder code from convert() and return what it built */
const run = (code: string): { toZPL(): string } => {
  const body = code.replace(/^import .*$/gm, "");
  const names = [...body.matchAll(/^const (\w+) =/gm)].map((m) => m[1]);
  return new Function(
    "Label",
    "PrinterSetup",
    "PrintJob",
    "Orientation",
    "dots",
    "mm",
    `${body}\nreturn ${names[names.length - 1]};`
  )(Label, PrinterSetup, PrintJob, Orientation, dots, mm);
};

/** Compile JSX code from convert(), run it and return what it built */
const runJsx = async (code: string): Promise<{ toZPL(): string }> => {
  const { code: js } = await transformWithEsbuild(
    code.replace(/^import .*$/gm, ""),
    "label.jsx",
    { jsx: "transform", jsxFactory: "h" }
  );
  const names = [...js.matchAll(/^const (\w+) =/gm)].map((m) => m[1]);
  const h = (type: never, props: object | null, ...children: unknown[]) =>
    jsx(type, {
      ...props,
      ...(children.length && {
        children: children.length === 1 ? children[0] : children,
      }),
    });
  const scope = { ...zplJsx, PrinterSetup, PrintJob, h };
  return new Function(
    ...Object.keys(scope),
    `${js}\nreturn ${names[names.length - 1]};`
  )(...Object.values(scope));
};

const decode = (data: string, indicator: string) =>
  new TextDecoder().decode(
    new Uint8Array(
      data
        .split(new RegExp(`(\\${indicator}[0-9A-Fa-f]{2})`))
        .flatMap((part) =>
          part.length === 3 && part[0] === indicator
            ? [parseInt(part.slice(1), 16)]
            : [...new TextEncoder().encode(part)]
        )
    )
  );

/** Values printers use for parameters left out, which the builder writes */
const defaults: Record<string, Record<string, unknown>> = {
  GraphicBox: { color: "B", rounding: 0 },
  RecallGraphic: { magnificationX: 1, magnificationY: 1 },
  QrCode: { orientation: "N", model: 2 },
};

/** Label settings the builder writes for every label */
const isLabelSetting = (command: Command) =>
  [
    "PrintWidth",
    "LabelLength",
    "ChangeEncoding",
    "LabelHome",
    "PrintQuantity",
    "PrintRate",
    "MediaDarkness",
  ].includes(command.type) ||
  (command.type === "LabelReverse" && !command.reverse);

/**
 * What ZPL prints, comparably: field data decoded, comments left out, and
 * each label's settings before its first field compared as a set
 */
const meaning = (zpl: string) => {
  const commands = parse(serialize(parse(zpl).commands)).commands;
  const out: string[] = [];
  let settings: string[] = [];
  let beforeFields = false;
  let indicator: string | undefined;
  for (const command of commands) {
    const { span: _span, ...rest } = command as Command & { span?: unknown };
    void _span;
    if (rest.type === "Comment") continue;
    if (rest.type === "StartFormat") {
      beforeFields = true;
      settings = [];
    }
    if (
      rest.type === "FieldOrigin" ||
      rest.type === "FieldTypeset" ||
      rest.type === "EndFormat"
    ) {
      if (beforeFields) out.push(JSON.stringify(settings.sort()));
      beforeFields = false;
    }
    if (rest.type === "FieldHexIndicator") {
      indicator = rest.indicator ?? "_";
      continue;
    }
    let value: unknown = { ...defaults[rest.type], ...rest };
    if (rest.type === "FieldData") {
      value = {
        ...rest,
        data: indicator ? decode(rest.data, indicator) : rest.data,
      };
      indicator = undefined;
    }
    // The builder writes ^PW and ^LL for every label; compare only the
    // ones the original has
    if (beforeFields && isLabelSetting(rest as Command)) {
      const defaults =
        rest.type === "PrintWidth" ||
        rest.type === "LabelLength" ||
        rest.type === "LabelReverse" ||
        (rest.type === "ChangeEncoding" && rest.charset === 28) ||
        (rest.type === "LabelHome" && rest.x === 0 && rest.y === 0);
      if (!defaults) settings.push(JSON.stringify(value));
      continue;
    }
    out.push(JSON.stringify(value));
  }
  return out;
};

/** The ^PW and ^LL values in ZPL, which the converted labels must keep */
const sizes = (zpl: string) =>
  parse(zpl)
    .commands.filter((c) => c.type === "PrintWidth" || c.type === "LabelLength")
    .map((c) => serialize([c]));

const expectSame = async (zpl: string, dpmm: 6 | 8 | 12 | 24 = 8) => {
  for (const units of ["mm", "dots"] as const) {
    for (const style of ["builder", "jsx"] as const) {
      const code = convert(zpl, { style, dpmm, units });
      const built = style === "jsx" ? await runJsx(code) : run(code);
      const result = built.toZPL();
      expect(meaning(result), code).toStrictEqual(meaning(zpl));
      for (const size of sizes(zpl)) {
        expect(sizes(result), code).toContain(size);
      }
    }
  }
};

describe("convert", () => {
  test("writes JSX", () => {
    expect(convert("^XA^PW400^LL200^FO40,40^A0N,32^FDHello^FS^XZ")).toBe(
      `import { Label, Text, build, Orientation, mm } from "@zplkit/core/jsx";

const label = build(
  <Label width={mm(50)} height={mm(25)} dpmm={8}>
    <Text x={mm(5)} y={mm(5)} font="0" height={mm(4)} orientation={Orientation.Normal}>Hello</Text>
  </Label>
);
`
    );
  });

  test("writes method calls", () => {
    expect(
      convert("^XA^PW400^LL200^FO40,40^GB100,3,3^FS^XZ", { style: "builder" })
    ).toBe(
      `import { Label, dots, mm } from "@zplkit/core";

const label = new Label({ width: mm(50), height: mm(25), dpmm: 8 })
  .box({
    position: { x: mm(5), y: mm(5) },
    width: mm(12.5),
    height: dots(3),
    thickness: dots(3),
  });
`
    );
  });

  test("keeps lengths in dots when millimeters wouldn't round trip", () => {
    const code = convert("^XA^FO7,7^GB101,3,3^FS^XZ", { style: "builder" });
    expect(code).toContain("x: dots(7)");
    expect(code).toContain("width: dots(101)");
  });

  test("warns about the character set for non-ASCII text without ^CI", () => {
    expect(convert("^XA^FO10,10^A0N,30^FDSmörgåsbord^FS^XZ")).toContain(
      "didn't set a character set (^CI)"
    );
    expect(
      convert("^XA^CI28^FO10,10^A0N,30^FDSmörgåsbord^FS^XZ")
    ).not.toContain("character set");
    expect(convert("^XA^FO10,10^A0N,30^FDPlain^FS^XZ")).not.toContain(
      "character set"
    );
  });

  test("uses dots when asked", () => {
    expect(
      convert("^XA^PW400^FO40,40^GB100,3,3^FS^XZ", { units: "dots" })
    ).toContain("x={dots(40)}");
  });

  test("decodes ^FH escapes, and the builder escapes again", () => {
    const code = convert("^XA^FO10,10^A0N,30^FH^FD50_25 off _5E today^FS^XZ");
    expect(code).toContain(">50% off ^ today</Text>");
    expect(
      convert("^XA^FO10,10^A0N,30^FH^FD50_25 off _5E today^FS^XZ", {
        style: "builder",
      })
    ).toContain('text: "50% off ^ today"');
  });

  test("writes barcodes as their elements", () => {
    const code = convert(
      "^XA^BY2^FO20,20^BCN,100,Y,N,N^FD12345678^FS^FO20,200^BQN,2,5^FDQA,https://example.com^FS^XZ"
    );
    expect(code).toContain('<Raw zpl="^BY2" />');
    expect(code).toContain("<Code128 ");
    expect(code).toContain(">12345678</Code128>");
    expect(code).toContain('errorCorrection="Q"');
    expect(code).toContain(">https://example.com</QrCode>");
  });

  test("falls back to field() for commands without an element", () => {
    const code = convert("^XA^FO10,10^GC80,4^FS^XZ", { style: "builder" });
    expect(code).toContain(
      '.field({ position: { x: mm(1.25), y: mm(1.25) }, command: "^GC80,4" })'
    );
  });

  test("falls back to raw ZPL for fields field() can't write", () => {
    const code = convert("^XA^FT10,40^A0N,30^FDHi^FS^XZ", { style: "builder" });
    expect(code).toContain('.raw("^FT10,40^A0N,30^FDHi^FS")');
  });

  test("turns comments into code comments", () => {
    expect(convert("^XA^FXTop section^FO10,10^GB50,50,50^FS^XZ")).toContain(
      "{/* Top section */}"
    );
  });

  test("puts printer setup and several labels in a print job", () => {
    const code = convert(
      "~SD20^XA^FO10,10^GB50,50,50^FS^XZ^XA^FO10,10^GB60,60,60^FS^XZ",
      {
        style: "builder",
      }
    );
    expect(code).toContain(
      "const setup = new PrinterSetup()\n  .setDarkness(20);"
    );
    expect(code).toContain("const job = new PrintJob(setup, label, label2);");
  });

  test("takes copies, speed and darkness from the label", () => {
    const code = convert("^XA^PR4^MD5^PQ3^FO10,10^GB50,50,50^FS^XZ", {
      style: "builder",
    });
    expect(code).toContain("copies: 3");
    expect(code).toContain("speed: 4");
    expect(code).toContain("darkness: 5");
  });

  describe("makes the same labels", () => {
    test.each([
      "^XA^PW400^LL200^FO40,40^A0N,32^FDHello^FS^XZ",
      "^XA^CF0,30^FO10,10^FDDefault font^FS^FWR^FO100,10^A0,20^FDTurned^FS^XZ",
      "^XA^FO10,10^A0N,30^FH^FD50_25 off _5E today^FS^XZ",
      "^XA^FO10,10^A0N,30^FB300,3,0,C^FDA long text in a block^FS^XZ",
      "^XA^FO10,10^A@N,40,40,E:ARIAL.TTF^FDTrueType^FS^XZ",
      "^XA^FO10,10^GC80,4^FS^FO100,10^GD50,50,3,B,L^FS^XZ",
      "^XA^FT10,40^A0N,30^FDTypeset^FS^XZ",
      "^XA^LH20,20^CI28^FO10,10^GB50,50,50,B,2^FS^XZ",
      "^XA^LRY^FO10,10^GB50,50,50^FS^XZ",
      "^XA^FO10,10^GFA,8,8,2,FFFF0000FFFF0000^FS^FO50,50^XGR:LOGO.GRF,2,2^FS^XZ",
      "~SD20^XA^PQ2^FO10,10^GB50,50,50^FS^XZ^XA^FO10,10^GB60,60,60^FS^XZ",
      "^XA^BY3^FO20,20^BEN,80,Y,N^FD590123412345^FS^FO20,200^BXN,4,200^FDdata^FS^XZ",
      "^XA^FO20,20^BQN,2,4^FDMM,Bmanual^FS^XZ",
    ])("%s", (zpl) => expectSame(zpl));

    test.each(examples.map((example) => [example.name, example.zpl]))(
      "playground example: %s",
      (_name, zpl) => expectSame(zpl)
    );

    test.each(
      Object.entries(details)
        .filter(([, entry]) => entry.example)
        .map(([code, entry]) => [code, entry.example!])
    )("reference example for %s", (_code, zpl) => expectSame(zpl));

    test("at 300 dpi", () =>
      expectSame(
        "^XA^PW600^LL400^FO30,30^A0N,48^FDHello^FS^FO30,90^GB540,4,4^FS^XZ",
        12
      ));
  });
});
