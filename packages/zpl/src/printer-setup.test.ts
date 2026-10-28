import { describe, expect, suite, test } from "vitest";
import PrinterSetup from "./PrinterSetup.js";
import ZplError from "./ZplError.js";

suite("PrinterSetup", () => {
  describe("setDarkness", () => {
    test("should set the darkness of the printer", () => {
      const setup = new PrinterSetup().setDarkness(20);
      expect(setup.toZPL()).toStrictEqual("~SD20");
    });

    test("should throw if darkness is not between 0 and 30", () => {
      expect(() => new PrinterSetup().setDarkness(31)).toThrow(ZplError);
    });
  });

  describe("label position and mirroring", () => {
    test("should shift and move every label, and mirror it", () => {
      const setup = new PrinterSetup()
        .setLabelShift(20)
        .setLabelTop(-6)
        .setMirror(true);
      expect(setup.toZPL()).toStrictEqual("^XA^LS20^XZ^XA^LT-6^XZ^XA^PMY^XZ");
    });

    test("should turn mirroring off", () => {
      expect(new PrinterSetup().setMirror(false).toZPL()).toStrictEqual(
        "^XA^PMN^XZ"
      );
    });

    test("should throw if the label moves more than 120 dots", () => {
      expect(() => new PrinterSetup().setLabelTop(121)).toThrow(ZplError);
      expect(() => new PrinterSetup().setLabelShift(1.5)).toThrow(ZplError);
    });
  });

  describe("storeGraphic", () => {
    test("should download a graphic to the printer", () => {
      const setup = new PrinterSetup().storeGraphic({
        name: "LOGO",
        graphic: { totalBytes: 4, bytesPerRow: 2, data: "FF00FF00" },
      });
      expect(setup.toZPL()).toStrictEqual("~DGR:LOGO.GRF,4,2,FF00FF00");
    });

    test("should throw if name is not between 1 and 8 characters long", () => {
      expect(() =>
        new PrinterSetup().storeGraphic({
          name: "123456789",
          graphic: { totalBytes: 0, bytesPerRow: 0, data: "" },
        })
      ).toThrow(ZplError);
    });
  });

  describe("storeFont", () => {
    test("should download a TrueType font to the printer", () => {
      const setup = new PrinterSetup().storeFont({
        name: "ARIAL",
        data: new Uint8Array([0, 1, 255]),
      });
      expect(setup.toZPL()).toStrictEqual("~DUR:ARIAL.TTF,3,0001FF");
    });

    test("should store it on another device", () => {
      const setup = new PrinterSetup().storeFont({
        name: "ARIAL",
        device: "E",
        data: new Uint8Array([10]),
      });
      expect(setup.toZPL()).toStrictEqual("~DUE:ARIAL.TTF,1,0A");
    });

    test("should throw if name is not between 1 and 8 characters long", () => {
      expect(() =>
        new PrinterSetup().storeFont({ name: "", data: new Uint8Array() })
      ).toThrow(ZplError);
    });
  });

  describe("deleteGraphic", () => {
    test("should delete a stored graphic", () => {
      const setup = new PrinterSetup().deleteGraphic("LOGO", "E");
      expect(setup.toZPL()).toStrictEqual("^IDE:LOGO.GRF");
    });
  });

  describe("validate", () => {
    test("should throw if ZPL is empty", () => {
      expect(() => new PrinterSetup().validate()).toThrow(
        "ZPL content is empty"
      );
    });
  });

  describe("minify", () => {
    test("should put each command on its own line when disabled", () => {
      const setup = new PrinterSetup({ minify: false })
        .setDarkness(5)
        .deleteGraphic("LOGO");
      expect(setup.toZPL()).toStrictEqual("~SD05\n^IDR:LOGO.GRF\n");
    });
  });
});
