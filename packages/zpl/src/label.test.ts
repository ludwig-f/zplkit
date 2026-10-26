import { suite, describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Label from "./Label.js";
import ZplError from "./ZplError.js";
import ImageConverter from "./ImageConverter.js";
import { Orientation, ZebraFontFamily } from "./types.js";
import { dots, mm } from "./units.js";
import type { Length } from "./units.js";
import type { LabelOptions } from "./options.js";

suite("Label", () => {
  const header = "^XA^PW120^LL120^LRN^CI28^LH0,0";
  const wideHeader = header.replace("^PW120^LL120", "^PW684^LL228");
  const smallLabel = () =>
    new Label({ width: mm(10), height: mm(10), dpmm: 12 });
  const wideLabel = () =>
    new Label({ width: mm(57), height: mm(19), dpmm: 12 });
  const at20 = { x: dots(20), y: dots(20) };

  describe("constructor", () => {
    test("should create a label with the given width and height", () => {
      expect(smallLabel().toZPL()).toStrictEqual(header + "^XZ");
    });

    test("should accept the size in dots", () => {
      const label = new Label({
        width: dots(120),
        height: dots(120),
        dpmm: 12,
      });
      expect(label.toZPL()).toStrictEqual(header + "^XZ");
    });

    test("should set the character set", () => {
      const label = new Label({
        width: mm(10),
        height: mm(10),
        dpmm: 12,
        characterSet: 26,
      });
      expect(label.toZPL()).toStrictEqual(
        header.replace("^CI28", "^CI26") + "^XZ"
      );
    });

    test("should set copies, print speed and darkness", () => {
      const label = new Label({
        width: mm(10),
        height: mm(10),
        dpmm: 12,
        copies: 3,
        speed: 4,
        darkness: -5,
      });
      expect(label.toZPL()).toStrictEqual(header + "^PR4^MD-5^PQ3^XZ");
    });

    test("should set the home position", () => {
      const label = new Label({
        width: mm(10),
        height: mm(10),
        dpmm: 12,
        home: { x: dots(5), y: mm(1) },
      });
      expect(label.toZPL()).toStrictEqual(
        header.replace("^LH0,0", "^LH5,12") + "^XZ"
      );
    });

    test("should fill a reversed label with a solid black box", () => {
      const label = new Label({
        width: mm(57),
        height: mm(19),
        dpmm: 12,
        reverse: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader.replace("^LRN", "^LRY") + "^FO0,0^GB684,228,228,B,0^FS^XZ"
      );
    });
  });

  describe("toZPL", () => {
    test("should only close the label once when not minified", () => {
      const label = new Label({
        width: mm(10),
        height: mm(10),
        dpmm: 12,
        minify: false,
      });
      const zpl = label.toZPL();
      expect(zpl.match(/\^XZ/g)).toHaveLength(1);
      expect(zpl.endsWith("^XZ\n")).toBe(true);
    });

    test("should not add another ^XZ when called twice", () => {
      const label = smallLabel();
      label.toZPL();
      expect(label.toZPL()).toStrictEqual(header + "^XZ");
    });

    test("should not modify the label", () => {
      const label = smallLabel();
      label.toZPL();
      label.raw("^PQ2");
      expect(label.toZPL()).toStrictEqual(header + "^PQ2^XZ");
    });

    test("should not close a label that was closed explicitly", () => {
      expect(smallLabel().close().toZPL()).toStrictEqual(header + "^XZ");
    });
  });

  describe("validate", () => {
    test("should throw if fields are opened but not closed", () => {
      const label = smallLabel().add({ type: "FieldOrigin", x: 0, y: 0 });
      expect(() => label.validate()).toThrow(ZplError);
    });

    test("should count ^FT as opening a field", () => {
      const label = smallLabel().add({ type: "FieldTypeset", x: 0, y: 0 });
      expect(() => label.validate()).toThrow(ZplError);
    });

    test("should count fields opened and closed in raw ZPL", () => {
      const label = smallLabel()
        .raw("^FO10,10")
        .add({ type: "FieldSeparator" });
      expect(() => label.validate()).not.toThrow();
    });

    test("should throw if using an unknown command in strict mode", () => {
      const label = smallLabel().raw("^ZA");
      expect(() => label.validate()).toThrow(ZplError);
    });

    test("should not throw for an unknown command in non-strict mode", () => {
      const label = smallLabel().raw("^ZA");
      expect(() => label.validate(false)).not.toThrow();
    });

    test("should accept known raw commands", () => {
      const label = smallLabel().raw("^PQ2^A0N,30,30");
      expect(() => label.validate()).not.toThrow();
    });
  });

  describe("raw", () => {
    test("should append the ZPL verbatim", () => {
      expect(smallLabel().raw("^PQ2").toZPL()).toStrictEqual(
        header + "^PQ2^XZ"
      );
    });
  });

  describe("setDefaultFont", () => {
    test("should set the default font of the label", () => {
      const label = smallLabel().setDefaultFont({
        font: ZebraFontFamily.C,
        height: dots(20),
        width: dots(20),
      });
      expect(label.toZPL()).toStrictEqual(header + "^CFC,20,20^XZ");
    });
  });

  describe("setFieldOrientation", () => {
    test("should set the orientation of the fields that follow", () => {
      const label = smallLabel().setFieldOrientation(
        Orientation.Rotated90Degrees
      );
      expect(label.toZPL()).toStrictEqual(header + "^FWR^XZ");
    });
  });

  describe("box", () => {
    test("should draw a black box on a normal label", () => {
      const label = wideLabel().box({
        position: at20,
        width: mm(10),
        height: mm(5),
        thickness: dots(3),
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^GB120,60,3,B,0^FS^XZ"
      );
    });

    test("should draw a white box when asked to", () => {
      const label = wideLabel().box({
        position: at20,
        width: dots(100),
        height: dots(50),
        thickness: dots(3),
        color: "W",
        rounding: 2,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^GB100,50,3,W,2^FS^XZ"
      );
    });
  });

  describe("text", () => {
    test("should draw text with the given font", () => {
      const label = wideLabel().text({
        position: at20,
        text: "Hello",
        font: {
          name: ZebraFontFamily.ZERO,
          height: dots(30),
          width: dots(25),
          orientation: Orientation.Normal,
        },
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^A0N,30,25^FDHello^FS^XZ"
      );
    });

    test("should use the default font when no font is given", () => {
      const label = wideLabel().text({ position: at20, text: "Hello" });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^FDHello^FS^XZ"
      );
    });

    test("should use a font file by name", () => {
      const label = wideLabel().text({
        position: at20,
        text: "Hello",
        font: { file: "E:ARIAL.TTF", height: dots(30) },
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^A@,30,,E:ARIAL.TTF^FDHello^FS^XZ"
      );
    });

    test("should throw on a font file that isn't a name with an extension", () => {
      expect(() =>
        wideLabel().text({
          position: at20,
          text: "Hello",
          font: { file: "E:ARIAL" },
        })
      ).toThrow(ZplError);
    });

    test("should default to font 0 when only a size is given", () => {
      const label = wideLabel().text({
        position: at20,
        text: "Hello",
        font: { height: mm(3) },
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^A0,36^FDHello^FS^XZ"
      );
    });

    test("should escape characters that would break the label", () => {
      const label = wideLabel().text({
        position: at20,
        text: "50% off ^ 2~3_4",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^FH^FD50% off _5E 2_7E3_5F4^FS^XZ"
      );
    });
  });

  describe("ean13", () => {
    test("should draw an EAN13 barcode on the label", () => {
      const label = wideLabel().ean13({
        position: at20,
        height: mm(9),
        data: "123456789012",
        printHri: true,
        printHriAbove: false,
        orientation: Orientation.Normal,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BEN,108,Y,N^FD123456789012^FS^XZ"
      );
    });
  });

  describe("retail and Code 93 barcodes", () => {
    test("ean8", () => {
      const label = wideLabel().ean8({
        position: at20,
        data: "1234567",
        height: dots(100),
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B8,100^FD1234567^FS^XZ"
      );
    });

    test("upcA", () => {
      const label = wideLabel().upcA({
        position: at20,
        data: "07000002198",
        printCheckDigit: false,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BU,,,,N^FD07000002198^FS^XZ"
      );
    });

    test("upcE", () => {
      const label = wideLabel().upcE({
        position: at20,
        data: "1230000045",
        orientation: Orientation.Normal,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B9N^FD1230000045^FS^XZ"
      );
    });

    test("upcEanExtension", () => {
      const label = wideLabel().upcEanExtension({
        position: at20,
        data: "04414",
        height: dots(117),
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BS,117^FD04414^FS^XZ"
      );
    });

    test("code93", () => {
      const label = wideLabel().code93({
        position: at20,
        data: "12345ABCDE",
        printCheckDigit: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BA,,,,Y^FD12345ABCDE^FS^XZ"
      );
    });

    test("codabar", () => {
      const label = wideLabel().codabar({
        position: at20,
        data: "123456",
        start: "B",
        stop: "D",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BK,,,,,B,D^FD123456^FS^XZ"
      );
    });
  });

  describe("postal, GS1 DataBar and MicroPDF417", () => {
    test("postnet", () => {
      const label = wideLabel().postnet({
        position: at20,
        data: "12345",
        height: dots(40),
        printHri: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BZ,40,Y^FD12345^FS^XZ"
      );
    });

    test("planet", () => {
      const label = wideLabel().planet({ position: at20, data: "12345678901" });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B5^FD12345678901^FS^XZ"
      );
    });

    test("intelligentMail", () => {
      const label = wideLabel().intelligentMail({
        position: at20,
        data: "00123123456123456789",
        height: dots(40),
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BZ,40,,,3^FD00123123456123456789^FS^XZ"
      );
    });

    test("gs1DataBar", () => {
      const label = wideLabel().gs1DataBar({
        position: at20,
        data: "12345678901",
        type: "stacked",
        moduleSize: dots(3),
        orientation: Orientation.Normal,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BRN,3,3^FD12345678901^FS^XZ"
      );
    });

    test("gs1DataBar expanded with segments", () => {
      const label = wideLabel().gs1DataBar({
        position: at20,
        data: "(01)00012345678905",
        type: "expanded",
        segments: 4,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BR,6,,,,4^FD(01)00012345678905^FS^XZ"
      );
    });

    test("microPdf417", () => {
      const label = wideLabel().microPdf417({
        position: at20,
        data: "ABC",
        rowHeight: dots(8),
        mode: 3,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BF,8,3^FDABC^FS^XZ"
      );
    });
  });

  describe("2 of 5, LOGMARS, MSI and Plessey", () => {
    test("industrial2of5", () => {
      const label = wideLabel().industrial2of5({
        position: at20,
        data: "123456",
        height: dots(100),
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BI,100^FD123456^FS^XZ"
      );
    });

    test("standard2of5", () => {
      const label = wideLabel().standard2of5({
        position: at20,
        data: "123456",
        printHri: false,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BJ,,N^FD123456^FS^XZ"
      );
    });

    test("logmars", () => {
      const label = wideLabel().logmars({
        position: at20,
        data: "12AB",
        printHriAbove: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BL,,Y^FD12AB^FS^XZ"
      );
    });

    test("msi", () => {
      const label = wideLabel().msi({
        position: at20,
        data: "123456",
        checkDigits: "D",
        printCheckDigit: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BM,D,,,,Y^FD123456^FS^XZ"
      );
    });

    test("plessey", () => {
      const label = wideLabel().plessey({
        position: at20,
        data: "12345",
        printCheckDigit: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BP,Y^FD12345^FS^XZ"
      );
    });
  });

  describe("code11", () => {
    test("should draw a Code 11 barcode on the label", () => {
      const label = wideLabel().code11({
        position: at20,
        data: "1234567890",
        height: mm(9),
        checkDigits: 1,
        orientation: Orientation.Normal,
        printHri: true,
        printHriAbove: false,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B1N,Y,108,Y,N^FD1234567890^FS^XZ"
      );
    });
  });

  describe("code39", () => {
    test("should draw a Code 39 barcode on the label", () => {
      const label = wideLabel().code39({
        position: at20,
        data: "ABC-123",
        height: mm(9),
        checkDigit: true,
        orientation: Orientation.Normal,
        printHri: true,
        printHriAbove: false,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B3N,Y,108,Y,N^FDABC-123^FS^XZ"
      );
    });
  });

  describe("interleaved2of5", () => {
    test("should draw an Interleaved 2 of 5 barcode on the label", () => {
      const label = wideLabel().interleaved2of5({
        position: at20,
        data: "123456",
        height: mm(9),
        orientation: Orientation.Normal,
        printHri: false,
        checkDigit: true,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B2N,108,N,,Y^FD123456^FS^XZ"
      );
    });
  });

  describe("pdf417", () => {
    test("should draw a PDF417 barcode on the label", () => {
      const label = wideLabel().pdf417({
        position: at20,
        data: "hello",
        rowHeight: dots(8),
        securityLevel: 3,
        columns: 4,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B7,8,3,4^FDhello^FS^XZ"
      );
    });
  });

  describe("aztec", () => {
    test("should draw an Aztec code on the label", () => {
      const label = wideLabel().aztec({
        position: at20,
        data: "hello",
        moduleSize: dots(4),
        errorControl: 50,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BO,4,,50^FDhello^FS^XZ"
      );
    });
  });

  describe("maxiCode", () => {
    test("should draw a MaxiCode on the label", () => {
      const label = wideLabel().maxiCode({
        position: at20,
        data: "hello",
        mode: 4,
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BD4^FDhello^FS^XZ"
      );
    });
  });

  describe("code128", () => {
    test("should draw a Code 128 barcode on the label", () => {
      const label = wideLabel().code128({
        position: at20,
        data: "1234567890",
        height: mm(9),
        orientation: Orientation.Normal,
        printHri: true,
        printHriAbove: false,
        useUcc: false,
        mode: "N",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BCN,108,Y,N,N,N^FD1234567890^FS^XZ"
      );
    });

    test("should leave unset parameters to the printer defaults", () => {
      const label = wideLabel().code128({ position: at20, data: "ABC" });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BC^FDABC^FS^XZ"
      );
    });
  });

  describe("dataMatrix", () => {
    test("should draw a DataMatrix code on the label", () => {
      const label = wideLabel().dataMatrix({
        position: at20,
        moduleSize: dots(9),
        data: "1234567890",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BXN,9,200^FD1234567890^FS^XZ"
      );
    });
  });

  describe("qrCode", () => {
    test("should draw a QR code with standard error correction", () => {
      const label = wideLabel().qrCode({
        position: at20,
        data: "https://example.com",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BQN,2^FDMA,https://example.com^FS^XZ"
      );
    });

    test("should set the module size and error correction", () => {
      const label = wideLabel().qrCode({
        position: at20,
        data: "ABC",
        moduleSize: mm(0.5),
        errorCorrection: "H",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BQN,2,6^FDHA,ABC^FS^XZ"
      );
    });

    test("should escape the data", () => {
      const label = wideLabel().qrCode({ position: at20, data: "a^b" });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^BQN,2^FH^FDMA,a_5Eb^FS^XZ"
      );
    });
  });

  describe("field", () => {
    test("should wrap any command in a field with escaped data", () => {
      const label = wideLabel().field({
        position: at20,
        command: "^B3N,N,100,Y,N",
        data: "ABC^1",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^B3N,N,100,Y,N^FH^FDABC_5E1^FS^XZ"
      );
    });

    test("should work without data", () => {
      const label = wideLabel().field({
        position: at20,
        command: "^GE100,50,3",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^GE100,50,3^FS^XZ"
      );
    });

    test("should reject a command that doesn't start with ^ or ~", () => {
      expect(() =>
        wideLabel().field({
          position: at20,
          // @ts-expect-error - commands start with ^ or ~
          command: "B3N",
        })
      ).toThrow(ZplError);
    });
  });

  describe("storedGraphic", () => {
    test("should recall a stored graphic", () => {
      const label = wideLabel().storedGraphic({
        position: at20,
        name: "LOGO",
      });
      expect(label.toZPL()).toStrictEqual(
        wideHeader + "^FO20,20^XGR:LOGO.GRF,1,1^FS^XZ"
      );
    });
  });

  describe("graphic", () => {
    test("should draw a converted image on the label", async () => {
      const converter = new ImageConverter();
      const buffer = readFileSync(
        join(import.meta.dirname, "../assets/test-image.png")
      );
      const graphic = await converter.toZPL(buffer);

      const zpl = wideLabel().graphic({ position: at20, graphic }).toZPL();

      expect(zpl).toContain(
        `^FO20,20^GFA,${graphic.totalBytes},${graphic.totalBytes},${graphic.bytesPerRow},`
      );
      expect(zpl.endsWith("^FS^XZ")).toBe(true);
    });
  });

  describe("commands", () => {
    test("should expose the label as AST nodes", () => {
      expect(smallLabel().commands.slice(0, 2)).toStrictEqual([
        { type: "StartFormat" },
        { type: "PrintWidth", width: 120 },
      ]);
    });
  });
});

describe("resolution", () => {
  test.each([6, 8, 12, 24] as const)(
    "accepts %i dots per millimeter",
    (dpmm) => {
      expect(
        () => new Label({ width: mm(50), height: mm(25), dpmm })
      ).not.toThrow();
    }
  );

  test("says when dpmm is missing, like after a typo", () => {
    expect(
      () =>
        new Label({ width: mm(50), height: mm(25) } as unknown as LabelOptions)
    ).toThrow("Label needs dpmm");
  });

  test("says when a length is missing", () => {
    const label = new Label({ width: mm(50), height: mm(25), dpmm: 8 });
    expect(() =>
      label.box({
        position: { x: mm(1), y: mm(1) },
        width: undefined as unknown as Length,
        height: mm(5),
        thickness: dots(2),
      })
    ).toThrow("Expected a length like mm(5) or dots(40), got undefined");
  });

  test.each([0, 10, 1300])("rejects %i dots per millimeter", (dpmm) => {
    expect(
      () => new Label({ width: mm(50), height: mm(25), dpmm: dpmm as 8 })
    ).toThrow("dpmm must be 6, 8, 12 or 24");
  });
});
