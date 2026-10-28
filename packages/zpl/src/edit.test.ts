import { suite, test, expect } from "vitest";
import { parse } from "./parse.js";
import { editParameters } from "./edit.js";
import ZplError from "./ZplError.js";
import type { Command } from "./ast.js";

/** Edits the first command of a type and returns the new text */
const edit = (
  zpl: string,
  type: Command["type"],
  changes: Record<number, string | number>
): string => {
  const command = parse(zpl).commands.find((c) => c.type === type);
  if (!command) throw new Error(`no ${type} in ${zpl}`);
  const { from, to, insert } = editParameters(zpl, command, changes);
  return zpl.slice(0, from) + insert + zpl.slice(to);
};

suite("editParameters", () => {
  test("changes one parameter", () => {
    expect(edit("^XA^FO20,30^FS^XZ", "FieldOrigin", { 0: 25 })).toBe(
      "^XA^FO25,30^FS^XZ"
    );
  });

  test("keeps the rest as written", () => {
    expect(edit("^XA^FO 20 ,30,1^FS^XZ", "FieldOrigin", { 1: 35 })).toBe(
      "^XA^FO 20 ,35,1^FS^XZ"
    );
  });

  test("adds missing parameters", () => {
    expect(edit("^XA^FO20^FS^XZ", "FieldOrigin", { 1: 30 })).toBe(
      "^XA^FO20,30^FS^XZ"
    );
    expect(edit("^XA^GB100^FS^XZ", "GraphicBox", { 2: 4 })).toBe(
      "^XA^GB100,,4^FS^XZ"
    );
  });

  test("reads ^A's font as its first parameter", () => {
    expect(edit("^XA^A0N,40,30^FS^XZ", "Font", { 1: 50 })).toBe(
      "^XA^A0N,50,30^FS^XZ"
    );
    expect(
      edit("^XA^A@N,40,30,E:ARIAL.TTF^FS^XZ", "FontByName", { 1: 50 })
    ).toBe("^XA^A@N,50,30,E:ARIAL.TTF^FS^XZ");
  });

  test("keeps a changed prefix", () => {
    expect(edit("^XA^CC#\n#FO20,30#FS#XZ", "FieldOrigin", { 0: 25 })).toBe(
      "^XA^CC#\n#FO25,30#FS#XZ"
    );
  });

  test("writes numbers without trailing zeros", () => {
    expect(edit("^XA^FO20,30^FS^XZ", "FieldOrigin", { 0: 10.5 })).toBe(
      "^XA^FO10.5,30^FS^XZ"
    );
    expect(edit("^XA^FO20,30^FS^XZ", "FieldOrigin", { 0: 11.0 })).toBe(
      "^XA^FO11,30^FS^XZ"
    );
  });

  test("won't edit with a changed delimiter", () => {
    expect(() =>
      edit("^XA^CD;^FO20;30^FS^XZ", "FieldOrigin", { 0: 25 })
    ).toThrow(ZplError);
  });

  test("won't edit with a delimiter changed under a changed prefix", () => {
    expect(() =>
      edit("^XA^CC#\n#CD;#FO20;30#FS#XZ", "FieldOrigin", { 0: 25 })
    ).toThrow(ZplError);
  });

  test("sees a changed delimiter through line breaks", () => {
    expect(() =>
      edit("^XA^CC\n##CD;#FO20;30#FS#XZ", "FieldOrigin", { 0: 25 })
    ).toThrow(ZplError);
    expect(() =>
      edit("^XA^\nCD;^FO20;30^FS^XZ", "FieldOrigin", { 0: 25 })
    ).toThrow(ZplError);
  });
});
