import { suite, describe, test, expect } from "vitest";
import { lint } from "./lint.js";
import { parse } from "./parse.js";
import Label from "./Label.js";
import { dots, mm } from "./units.js";
import type { Command } from "./ast.js";

const header: Command[] = [
  { type: "StartFormat" },
  { type: "PrintWidth", width: 800 },
  { type: "LabelLength", length: 400 },
];
const end: Command = { type: "EndFormat" };

/** Lint a label made of the header, the given commands and ^XZ */
const lintLabel = (...commands: Command[]) =>
  lint([...header, ...commands, end]);

const rules = (commands: Command[]) => lint(commands).map((d) => d.rule);

suite("lint", () => {
  test("reports nothing for a well-formed label", () => {
    expect(
      lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "FieldData", data: "Hello" },
        { type: "FieldSeparator" },
        { type: "FieldOrigin", x: 10, y: 50 },
        { type: "GraphicBox", width: 100, height: 3, thickness: 3 },
        { type: "FieldSeparator" }
      )
    ).toStrictEqual([]);
  });

  describe("label structure", () => {
    test("missing ^XA", () => {
      expect(rules([{ type: "PrintWidth", width: 800 }, end])).toStrictEqual([
        "missing-start-format",
      ]);
    });

    test("missing ^XZ", () => {
      const diagnostics = lint([...header]);

      expect(diagnostics).toStrictEqual([
        {
          rule: "missing-end-format",
          severity: "error",
          message:
            "The label is never ended with ^XZ, so the printer keeps waiting and nothing prints.",
          index: 0,
        },
      ]);
    });

    test("format commands after ^XZ", () => {
      expect(
        rules([...header, end, { type: "FieldOrigin", x: 0, y: 0 }])
      ).toContain("command-outside-format");
    });

    test("printer commands inside a label", () => {
      const diagnostics = lintLabel(
        { type: "SetDarkness", darkness: 10 },
        { type: "Raw", zpl: "~JA" }
      );
      expect(diagnostics.map((d) => d.rule)).toStrictEqual([
        "printer-command-in-label",
        "printer-command-in-label",
      ]);
      expect(diagnostics[0].message).toBe(
        "~SD acts on the printer as soon as it's read, not when this label prints. Send it before ^XA, for example with PrinterSetup."
      );
    });

    test("downloads are fine inside a label", () => {
      expect(
        lintLabel({ type: "Raw", zpl: "~DGR:LOGO.GRF,2,1,FFFF" })
      ).toStrictEqual([]);
    });

    test("control commands are fine outside a format", () => {
      expect(
        rules([{ type: "SetDarkness", darkness: 10 }, ...header, end])
      ).toStrictEqual([]);
    });
  });

  describe("fields", () => {
    test("a field that is never closed", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "FieldData", data: "a" },
        { type: "FieldOrigin", x: 10, y: 50 },
        { type: "FieldData", data: "b" },
        { type: "FieldSeparator" }
      );

      expect(diagnostics).toStrictEqual([
        {
          rule: "unclosed-field",
          severity: "error",
          message:
            "This field is never closed with ^FS, so it merges with the next field.",
          index: 3,
        },
      ]);
    });

    test("a field still open at ^XZ", () => {
      expect(
        rules([
          ...header,
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "FieldData", data: "a" },
          end,
        ])
      ).toStrictEqual(["unclosed-field"]);
    });

    test("^FS without a field", () => {
      expect(rules([...header, { type: "FieldSeparator" }, end])).toStrictEqual(
        ["separator-without-field"]
      );
    });

    test("a field that starts outside the label", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 900, y: 10 },
        { type: "FieldData", data: "a" },
        { type: "FieldSeparator" }
      );

      expect(diagnostics[0]).toMatchObject({
        rule: "field-outside-label",
        severity: "warning",
        message:
          "This field starts at (900, 10), outside the 800 × 400 dot label, so it may not print.",
      });
    });

    test("uses the media size when the label doesn't set one", () => {
      const commands: Command[] = [
        { type: "StartFormat" },
        { type: "FieldOrigin", x: 10, y: 500 },
        { type: "FieldData", data: "a" },
        { type: "FieldSeparator" },
        end,
      ];

      expect(rules(commands)).toStrictEqual([]);
      expect(
        lint(commands, { width: 812, length: 406 }).map((d) => d.message)
      ).toStrictEqual([
        "This field starts at (10, 500), outside the 812 × 406 dot label, so it may not print.",
      ]);
    });

    test("^PW and ^LL override the media size", () => {
      expect(
        lint(
          [
            ...header,
            { type: "FieldOrigin", x: 10, y: 500 },
            { type: "FieldData", data: "a" },
            { type: "FieldSeparator" },
            end,
          ],
          { width: 812, length: 1218 }
        ).map((d) => d.rule)
      ).toStrictEqual(["field-outside-label"]);
    });

    test("the label home moves fields", () => {
      expect(
        rules([
          ...header,
          { type: "LabelHome", x: 700, y: 0 },
          { type: "FieldOrigin", x: 150, y: 10 },
          { type: "FieldData", data: "a" },
          { type: "FieldSeparator" },
          end,
        ])
      ).toStrictEqual(["field-outside-label"]);
    });
  });

  describe("graphics", () => {
    test("a box narrower than its line", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "GraphicBox", width: 1, height: 64, thickness: 2 },
        { type: "FieldSeparator" }
      );

      expect(diagnostics).toStrictEqual([
        {
          rule: "box-smaller-than-line",
          severity: "warning",
          message:
            "The box is 1 dot wide but its line is 2 dots thick, so the printer widens it to 2 dots.",
          index: 4,
        },
      ]);
    });

    test("a box shorter than its line", () => {
      expect(
        rules([
          ...header,
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "GraphicBox", width: 100, height: 2, thickness: 5 },
          { type: "FieldSeparator" },
          end,
        ])
      ).toStrictEqual(["box-smaller-than-line"]);
    });

    test("values outside the printer's range", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "GraphicCircle", diameter: 5000, thickness: 4 },
        { type: "FieldSeparator" },
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "GraphicEllipse", width: 5000, height: 2 },
        { type: "FieldSeparator" },
        { type: "BarcodeDefaults", moduleWidth: 12, ratio: 3.5 }
      );

      expect(diagnostics.map((d) => d.message)).toStrictEqual([
        "^GC diameter is 5000, but the printer only accepts 3 to 4095.",
        "^GE width is 5000, but the printer only accepts 3 to 4095.",
        "^GE height is 2, but the printer only accepts 3 to 4095.",
        "^BY module width is 12, but the printer only accepts 1 to 10.",
        "^BY ratio is 3.5, but the printer only accepts 2 to 3.",
      ]);
    });

    test("ranges in dots don't apply to millimeters or inches", () => {
      expect(
        lintLabel(
          { type: "MeasurementUnits", unit: "M" },
          { type: "FieldOrigin", x: 5, y: 5 },
          { type: "GraphicBox", width: 10, height: 5, thickness: 0.5 },
          { type: "FieldSeparator" }
        )
      ).toStrictEqual([]);
    });

    test("label shift and top outside the printer's range", () => {
      const diagnostics = lintLabel(
        { type: "LabelShift", shift: 10000 },
        { type: "LabelTop", offset: 121 }
      );

      expect(diagnostics.map((d) => d.message)).toStrictEqual([
        "^LS shift is 10000, but the printer only accepts -9999 to 9999.",
        "^LT offset is 121, but the printer only accepts -120 to 120.",
      ]);
    });

    test("print settings outside the printer's range", () => {
      const diagnostics = lintLabel(
        { type: "MediaDarkness", darkness: 40 },
        { type: "PrintRate", speed: 20 },
        { type: "PrintQuantity", quantity: 0 }
      );
      expect(diagnostics.map((d) => d.message)).toStrictEqual([
        "^MD darkness is 40, but the printer only accepts -30 to 30.",
        "^PR speed is 20, but the printer only accepts 1 to 14.",
        "^PQ quantity is 0, but the printer only accepts 1 to 99999999.",
      ]);
    });
  });

  describe("barcodes", () => {
    test("EAN-13 data that isn't 12 digits", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "Ean13" },
        { type: "FieldData", data: "5901234123457" },
        { type: "FieldSeparator" }
      );

      expect(diagnostics).toStrictEqual([
        {
          rule: "ean13-data",
          severity: "warning",
          message:
            "EAN-13 data must be exactly 12 digits (the printer adds the check digit), got '5901234123457'. The printer pads or cuts it to 12.",
          index: 5,
        },
      ]);
    });

    test("a serial number is a barcode's data", () => {
      expect(
        lintLabel(
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "Code128" },
          { type: "SerialNumber", start: "001" },
          { type: "FieldSeparator" }
        )
      ).toStrictEqual([]);
    });

    test("GS1 DataBar Expanded data with parentheses", () => {
      const diagnostics = lintLabel(
        { type: "FieldOrigin", x: 10, y: 10 },
        { type: "Gs1DataBar", symbology: 6 },
        { type: "FieldData", data: "(01)98898765432106(15)991231" },
        { type: "FieldSeparator" }
      );

      expect(diagnostics).toStrictEqual([
        {
          rule: "databar-parentheses",
          severity: "warning",
          message:
            "The printer encodes these parentheses as data, so scanners can't read the AIs. Leave them out: 019889876543210615991231.",
          index: 5,
        },
      ]);
    });

    test("a QR code magnification outside the printer's range", () => {
      expect(
        lintLabel(
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "QrCode", orientation: "N", model: 2, magnification: 150 },
          { type: "FieldData", data: "MA,hi" },
          { type: "FieldSeparator" }
        ).map((d) => d.message)
      ).toStrictEqual([
        "^BQ magnification is 150, but the printer only accepts 1 to 100.",
      ]);
    });

    test("a QR code without data", () => {
      expect(
        rules([
          ...header,
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "QrCode", orientation: "N" },
          { type: "FieldSeparator" },
          end,
        ])
      ).toStrictEqual(["barcode-without-data"]);
    });

    test("a barcode without data", () => {
      expect(
        rules([
          ...header,
          { type: "FieldOrigin", x: 10, y: 10 },
          { type: "Code128" },
          { type: "FieldSeparator" },
          end,
        ])
      ).toStrictEqual(["barcode-without-data"]);
    });
  });

  describe("raw commands", () => {
    test("unknown commands", () => {
      expect(lintLabel({ type: "Raw", zpl: "^ZQ5" })).toMatchObject([
        {
          rule: "unknown-command",
          severity: "warning",
          message: "^ZQ is not a ZPL command.",
        },
      ]);
    });

    test("known commands without a typed node are fine", () => {
      expect(lintLabel({ type: "Raw", zpl: "^PQ2" })).toStrictEqual([]);
    });
  });

  describe("with parsed ZPL", () => {
    test("includes where in the text the problem is", () => {
      const { commands } = parse("^XA^FO10,10^GB1,64,2^FS^XZ");

      expect(lint(commands)[0]).toMatchObject({
        rule: "box-smaller-than-line",
        span: { start: 11, end: 20 },
      });
    });
  });

  describe("Label.lint", () => {
    test("lints the label as toZPL() would print it", () => {
      const label = new Label({ width: mm(50), height: mm(25), dpmm: 8 })
        .box({
          position: { x: dots(10), y: dots(10) },
          width: dots(1),
          height: mm(8),
          thickness: dots(2),
        })
        .ean13({ position: { x: dots(10), y: dots(100) }, data: "123" });

      expect(label.lint().map((d) => d.rule)).toStrictEqual([
        "box-smaller-than-line",
        "ean13-data",
      ]);
    });
  });
});
