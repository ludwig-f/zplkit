import { suite, describe, test, expect } from "vitest";
import { serialize, serializeCommand, escapeFieldData } from "./serialize.js";
import ZplError from "./ZplError.js";
import commandCases from "./__fixtures__/commands.js";

suite("serialize", () => {
  describe("serializeCommand", () => {
    test.each(commandCases)("%o -> %s", (command, expected) => {
      expect(serializeCommand(command)).toStrictEqual(expected);
    });

    test("throws when field data contains a command prefix", () => {
      expect(() =>
        serializeCommand({ type: "FieldData", data: "a^b" })
      ).toThrow(ZplError);
      expect(() =>
        serializeCommand({ type: "FieldData", data: "a~b" })
      ).toThrow(ZplError);
    });

    test("throws when a comment contains a command prefix", () => {
      expect(() => serializeCommand({ type: "Comment", text: "^XZ" })).toThrow(
        ZplError
      );
    });
  });

  describe("serialize", () => {
    test("joins commands without separators when minified", () => {
      expect(
        serialize([
          { type: "StartFormat" },
          { type: "FieldOrigin", x: 0, y: 0 },
          { type: "FieldSeparator" },
          { type: "EndFormat" },
        ])
      ).toStrictEqual("^XA^FO0,0^FS^XZ");
    });

    test("puts each command on its own line when not minified", () => {
      expect(
        serialize([{ type: "StartFormat" }, { type: "EndFormat" }], {
          minify: false,
        })
      ).toStrictEqual("^XA\n^XZ\n");
    });
  });

  describe("escapeFieldData", () => {
    test("leaves plain data untouched", () => {
      expect(escapeFieldData("Hello")).toStrictEqual({
        data: "Hello",
        needsHexIndicator: false,
      });
    });

    test("leaves underscores untouched when nothing needs escaping", () => {
      expect(escapeFieldData("a_b")).toStrictEqual({
        data: "a_b",
        needsHexIndicator: false,
      });
    });

    test("hex-escapes prefixes and the indicator itself", () => {
      expect(escapeFieldData("a^b~c_d")).toStrictEqual({
        data: "a_5Eb_7Ec_5Fd",
        needsHexIndicator: true,
      });
    });
  });
});
