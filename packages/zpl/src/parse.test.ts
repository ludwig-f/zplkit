import { suite, describe, test, expect } from "vitest";
import { parse } from "./parse.js";
import { serialize } from "./serialize.js";
import Label from "./Label.js";
import { dots, mm } from "./units.js";
import commandCases from "./__fixtures__/commands.js";
import type { Command } from "./ast.js";

const withoutSpans = (commands: Command[]): Command[] =>
  commands.map((command) => {
    const copy = { ...command };
    delete copy.span;
    return copy;
  });

const parseCommands = (zpl: string): Command[] =>
  withoutSpans(parse(zpl).commands);

suite("parse", () => {
  describe("single commands", () => {
    test.each(commandCases)("%o <- %s", (command, zpl) => {
      expect(parseCommands(zpl)).toStrictEqual([command]);
    });
  });

  describe("field data", () => {
    test("keeps commas and spaces in field data", () => {
      expect(parseCommands("^FDHello, big world ^FS")).toStrictEqual([
        { type: "FieldData", data: "Hello, big world " },
        { type: "FieldSeparator" },
      ]);
    });

    test("keeps commas in comments", () => {
      expect(parseCommands("^FXa, b")).toStrictEqual([
        { type: "Comment", text: "a, b" },
      ]);
    });

    test("keeps commas in graphic field data", () => {
      expect(parseCommands("^GFA,4,4,2,FF,FF")).toStrictEqual([
        {
          type: "GraphicField",
          byteCount: 4,
          fieldCount: 4,
          bytesPerRow: 2,
          data: "FF,FF",
        },
      ]);
    });
  });

  describe("whitespace", () => {
    test("ignores line breaks between and inside commands", () => {
      expect(parseCommands("^XA\r\n^FO10,\n20\n^FS\n^XZ\n")).toStrictEqual([
        { type: "StartFormat" },
        { type: "FieldOrigin", x: 10, y: 20 },
        { type: "FieldSeparator" },
        { type: "EndFormat" },
      ]);
    });

    test("ignores text before the first command", () => {
      expect(parseCommands("garbage\n^XA")).toStrictEqual([
        { type: "StartFormat" },
      ]);
    });
  });

  describe("spans", () => {
    test("records where each command starts and ends", () => {
      expect(parse("^XA\n^FO10,20^XZ").commands.map((c) => c.span)).toEqual([
        { start: 0, end: 3 },
        { start: 4, end: 12 },
        { start: 12, end: 15 },
      ]);
    });
  });

  describe("unsupported commands", () => {
    test("keeps unknown commands verbatim", () => {
      expect(parseCommands("^MMT,N^XZ")).toStrictEqual([
        { type: "Raw", zpl: "^MMT,N" },
        { type: "EndFormat" },
      ]);
    });

    test("reads ^A@ as a font file, not as font @", () => {
      expect(parseCommands("^A@N,50,50,E:ARIAL.TTF")).toStrictEqual([
        {
          type: "FontByName",
          orientation: "N",
          height: 50,
          width: 50,
          device: "E",
          name: "ARIAL",
          extension: "TTF",
        },
      ]);
    });

    test("keeps a font file without an extension verbatim", () => {
      const { commands, diagnostics } = parse("^A@N,50,50,E:ARIAL");
      expect(commands[0]).toMatchObject({ type: "Raw" });
      expect(diagnostics[0].message).toMatch(/\^A@/);
    });

    test("keeps non-ASCII graphic fields verbatim", () => {
      expect(parseCommands("^GFB,2,2,1,ab^FS")).toStrictEqual([
        { type: "Raw", zpl: "^GFB,2,2,1,ab" },
        { type: "FieldSeparator" },
      ]);
    });
  });

  describe("invalid parameters", () => {
    test("keeps the command verbatim and reports a diagnostic", () => {
      const result = parse("^FOabc,10^FS");

      expect(withoutSpans(result.commands)).toStrictEqual([
        { type: "Raw", zpl: "^FOabc,10" },
        { type: "FieldSeparator" },
      ]);
      expect(result.diagnostics).toStrictEqual([
        {
          severity: "warning",
          rule: "invalid-parameter",
          message: "^FO: x must be a number, got 'abc'",
          span: { start: 0, end: 9 },
        },
      ]);
    });

    test("rejects values outside the allowed set", () => {
      const result = parse("^A0X,30");

      expect(withoutSpans(result.commands)).toStrictEqual([
        { type: "Raw", zpl: "^A0X,30" },
      ]);
      expect(result.diagnostics[0]?.message).toStrictEqual(
        "^A: orientation must be one of N, R, I, B, got 'X'"
      );
    });

    test("reports nothing for valid input", () => {
      expect(parse("^XA^FO10,10^FDok^FS^XZ").diagnostics).toStrictEqual([]);
    });
  });

  test("reads ^B0 as Aztec, like ^BO", () => {
    expect(withoutSpans(parse("^B0N,5").commands)).toStrictEqual([
      { type: "Aztec", orientation: "N", magnification: 5 },
    ]);
  });

  describe("ignored text", () => {
    test("reports text after a command without parameters", () => {
      const result = parse("^FDHi^FSG^XZ");

      expect(withoutSpans(result.commands)).toStrictEqual([
        { type: "FieldData", data: "Hi" },
        { type: "FieldSeparator" },
        { type: "EndFormat" },
      ]);
      expect(result.diagnostics).toStrictEqual([
        {
          severity: "warning",
          rule: "ignored-text",
          message: "^FS takes no parameters, so the printer ignores 'G'",
          span: { start: 8, end: 9 },
        },
      ]);
    });

    test("allows spaces and line breaks between commands", () => {
      expect(
        parse("^XA \n^FO10,10^FDok^FS  \n^XZ\n").diagnostics
      ).toStrictEqual([]);
    });
  });

  describe("prefix changes", () => {
    test("applies ^CC and normalizes the output to ^", () => {
      const result = parse("^XA^CC+\n+FO10,10+FDhi+FS+XZ");

      expect(withoutSpans(result.commands)).toStrictEqual([
        { type: "StartFormat" },
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "FieldData", data: "hi" },
        { type: "FieldSeparator" },
        { type: "EndFormat" },
      ]);
      expect(serialize(result.commands)).toStrictEqual(
        "^XA^FO10,10^FDhi^FS^XZ"
      );
    });

    test("applies ~CT to the control prefix", () => {
      expect(parseCommands("~CT#\n#SD10")).toStrictEqual([
        { type: "SetDarkness", darkness: 10 },
      ]);
    });

    test("applies ^CD to the parameter delimiter", () => {
      expect(parseCommands("^CD;^FO10;20")).toStrictEqual([
        { type: "FieldOrigin", x: 10, y: 20 },
      ]);
    });
  });

  describe("round trip", () => {
    test("parses labels built with Label back into the same commands", () => {
      const label = new Label({ width: mm(57), height: mm(19), dpmm: 12 })
        .text({
          position: { x: dots(20), y: dots(20) },
          text: "Price ^ 5_6",
          font: { height: mm(4) },
        })
        .code128({
          position: { x: dots(20), y: dots(80) },
          data: "ABC",
          height: mm(8),
        })
        .box({
          position: { x: dots(0), y: dots(0) },
          width: mm(57),
          height: mm(19),
          thickness: dots(3),
          rounding: 2,
        })
        .close();

      expect(parseCommands(label.toZPL())).toStrictEqual(label.commands);
    });

    test("serializes parsed real-world ZPL back to the same text", () => {
      const zpl = [
        "^XA",
        "^FX Shipping label",
        "^CF0,60",
        "^FO50,50^GB100,100,100^FS",
        "^FO220,50^FDIntershipping, Inc.^FS",
        "^CF0,30",
        "^FO220,115^FD1000 Shipping Lane^FS",
        "^FO50,250^GB700,3,3^FS",
        "^BY5,2,270",
        "^FO100,550^BC^FD12345678^FS",
        "^FO75,75^FR^GB100,100,100^FS",
        "^PQ1,0,1,Y",
        "^XZ",
      ].join("");

      expect(serialize(parse(zpl).commands)).toStrictEqual(zpl);
      expect(parse(zpl).diagnostics).toStrictEqual([]);
    });
  });
});
