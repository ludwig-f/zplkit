import { suite, describe, test, expect } from "vitest";
import {
  Label,
  Text,
  Box,
  Code11,
  Code128,
  Code39,
  Interleaved2of5,
  PDF417,
  Aztec,
  MaxiCode,
  EAN13,
  EAN8,
  UpcA,
  UpcE,
  UpcEanExtension,
  Code93,
  Codabar,
  Postnet,
  Planet,
  IntelligentMail,
  GS1DataBar,
  MicroPDF417,
  Industrial2of5,
  Standard2of5,
  LOGMARS,
  MSI,
  Plessey,
  DataMatrix,
  Graphic,
  StoredGraphic,
  DefaultFont,
  FieldOrientation,
  Raw,
  QrCode,
  Field,
  build,
} from "./jsx.js";
import LabelBuilder from "./Label.js";
import ZplError from "./ZplError.js";
import { Orientation } from "./types.js";
import { dots, mm } from "./units.js";
import type { Length } from "./units.js";

const at = (x: number, y: number) => ({ x: dots(x), y: dots(y) });
const builder = () =>
  new LabelBuilder({ width: mm(57), height: mm(19), dpmm: 12 });

suite("jsx", () => {
  describe("build", () => {
    test("produces the same ZPL as the builder", () => {
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          <DefaultFont font="0" height={dots(30)} />
          <FieldOrientation orientation={Orientation.BottomUp270Degrees} />
          <Text x={dots(20)} y={dots(20)} font="0" height={mm(4)}>
            Hello
          </Text>
          <Text x={dots(20)} y={dots(60)} file="E:ARIAL.TTF" height={mm(3)}>
            Arial
          </Text>
          <Box
            x={dots(0)}
            y={dots(0)}
            width={mm(57)}
            height={mm(19)}
            thickness={dots(3)}
            rounding={2}
          />
          <Code128 x={dots(20)} y={dots(80)} height={mm(8)} mode="A">
            ABC
          </Code128>
          <Code11 x={dots(300)} y={dots(80)} checkDigits={1}>
            123
          </Code11>
          <Code39 x={dots(20)} y={dots(150)} checkDigit>
            ABC
          </Code39>
          <Interleaved2of5 x={dots(300)} y={dots(150)} printHri={false}>
            1234
          </Interleaved2of5>
          <PDF417 x={dots(500)} y={dots(150)} rowHeight={dots(6)} columns={3}>
            pdf
          </PDF417>
          <Aztec x={dots(20)} y={dots(200)} moduleSize={dots(3)}>
            az
          </Aztec>
          <MaxiCode x={dots(300)} y={dots(200)} mode={4}>
            mc
          </MaxiCode>
          <EAN13 x={dots(400)} y={dots(80)} height={mm(5)}>
            590123412345
          </EAN13>
          <DataMatrix x={dots(600)} y={dots(20)} moduleSize={dots(4)}>
            data
          </DataMatrix>
          <StoredGraphic x={dots(10)} y={dots(10)} name="LOGO" />
          <Graphic
            x={dots(10)}
            y={dots(10)}
            graphic={{ totalBytes: 2, bytesPerRow: 1, data: "FF00" }}
          />
          <Raw zpl="^PQ2" />
        </Label>
      );

      const expected = builder()
        .setDefaultFont({ font: "0", height: dots(30) })
        .setFieldOrientation(Orientation.BottomUp270Degrees)
        .text({
          position: at(20, 20),
          text: "Hello",
          font: { name: "0", height: mm(4) },
        })
        .text({
          position: at(20, 60),
          text: "Arial",
          font: { file: "E:ARIAL.TTF", height: mm(3) },
        })
        .box({
          position: at(0, 0),
          width: mm(57),
          height: mm(19),
          thickness: dots(3),
          rounding: 2,
        })
        .code128({
          position: at(20, 80),
          data: "ABC",
          height: mm(8),
          mode: "A",
        })
        .code11({ position: at(300, 80), data: "123", checkDigits: 1 })
        .code39({ position: at(20, 150), data: "ABC", checkDigit: true })
        .interleaved2of5({
          position: at(300, 150),
          data: "1234",
          printHri: false,
        })
        .pdf417({
          position: at(500, 150),
          data: "pdf",
          rowHeight: dots(6),
          columns: 3,
        })
        .aztec({ position: at(20, 200), data: "az", moduleSize: dots(3) })
        .maxiCode({ position: at(300, 200), data: "mc", mode: 4 })
        .ean13({
          position: at(400, 80),
          data: "590123412345",
          height: mm(5),
        })
        .dataMatrix({
          position: at(600, 20),
          data: "data",
          moduleSize: dots(4),
        })
        .storedGraphic({ position: at(10, 10), name: "LOGO" })
        .graphic({
          position: at(10, 10),
          graphic: { totalBytes: 2, bytesPerRow: 1, data: "FF00" },
        })
        .raw("^PQ2");

      expect(label.toZPL()).toStrictEqual(expected.toZPL());
    });

    test("passes label options through", () => {
      const label = build(
        <Label
          width={mm(10)}
          height={mm(10)}
          dpmm={12}
          reverse
          minify={false}
        />
      );

      expect(label.toZPL()).toStrictEqual(
        new LabelBuilder({
          width: mm(10),
          height: mm(10),
          dpmm: 12,
          reverse: true,
          minify: false,
        }).toZPL()
      );
    });

    test("accepts a component that returns a <Label>", () => {
      const ShippingLabel = (props: { id: number }) => (
        <Label width={mm(10)} height={mm(10)} dpmm={12}>
          <Text x={dots(0)} y={dots(0)}>
            Order {props.id}
          </Text>
        </Label>
      );

      expect(build(<ShippingLabel id={42} />).toZPL()).toContain(
        "^FO0,0^FDOrder 42^FS"
      );
    });

    test("throws when the root is not a <Label>", () => {
      expect(() =>
        build(
          <Text x={dots(0)} y={dots(0)}>
            Hi
          </Text>
        )
      ).toThrow(ZplError);
    });

    test("throws for a <Label> inside a <Label>", () => {
      expect(() =>
        build(
          <Label width={mm(10)} height={mm(10)} dpmm={12}>
            <Label width={mm(10)} height={mm(10)} dpmm={12} />
          </Label>
        )
      ).toThrow(ZplError);
    });
  });

  describe("QR codes and custom fields", () => {
    test("produce the same ZPL as the builder", () => {
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          <QrCode
            x={dots(20)}
            y={dots(20)}
            moduleSize={dots(4)}
            errorCorrection="Q"
          >
            https://example.com/{42}
          </QrCode>
          <Field x={dots(300)} y={dots(20)} command="^B3N,N,100,Y,N">
            ABC^1
          </Field>
        </Label>
      );

      const expected = builder()
        .qrCode({
          position: at(20, 20),
          data: "https://example.com/42",
          moduleSize: dots(4),
          errorCorrection: "Q",
        })
        .field({
          position: at(300, 20),
          command: "^B3N,N,100,Y,N",
          data: "ABC^1",
        });

      expect(label.toZPL()).toStrictEqual(expected.toZPL());
    });
  });

  describe("text", () => {
    test("joins text and numbers and escapes the result", () => {
      const order = { id: 10442, shelf: "B_3" };
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          <Text x={dots(0)} y={dots(0)}>
            Order #{order.id} ^ Shelf {order.shelf}
          </Text>
        </Label>
      );

      expect(label.toZPL()).toContain(
        "^FO0,0^FH^FDOrder #10442 _5E Shelf B_5F3^FS"
      );
    });

    test("maps font props to ^A", () => {
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={8}>
          <Text
            x={dots(0)}
            y={dots(0)}
            height={mm(5)}
            width={dots(30)}
            orientation={Orientation.Rotated90Degrees}
          >
            Hi
          </Text>
        </Label>
      );

      expect(label.toZPL()).toContain("^FO0,0^A0R,40,30^FDHi^FS");
    });
  });

  describe("composition", () => {
    test("skips false, null and undefined children", () => {
      const express = false;
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          {express && (
            <Text x={dots(0)} y={dots(0)}>
              EXPRESS
            </Text>
          )}
          {null}
          {undefined}
        </Label>
      );

      expect(label.toZPL()).toStrictEqual(builder().toZPL());
    });

    test("renders arrays from map in order", () => {
      const lines = ["One", "Two"];
      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          {lines.map((line, i) => (
            <Text key={line} x={dots(0)} y={dots(i * 40)}>
              {line}
            </Text>
          ))}
        </Label>
      );

      expect(label.toZPL()).toContain("^FO0,0^FDOne^FS^FO0,40^FDTwo^FS");
    });

    test("supports fragments and custom components", () => {
      const Address = (props: { x: Length; y: Length; lines: string[] }) => (
        <>
          {props.lines.map((line, i) => (
            <Text x={props.x} y={props.y} key={i}>
              {line}
            </Text>
          ))}
        </>
      );

      const label = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          <Address x={dots(5)} y={dots(0)} lines={["A", "B"]} />
        </Label>
      );

      expect(label.toZPL()).toContain("^FO5,0^FDA^FS^FO5,0^FDB^FS");
    });

    test("resolves millimeters with the dpmm of the label it ends up in", () => {
      const box = (
        <Box
          x={mm(1)}
          y={mm(1)}
          width={mm(10)}
          height={mm(5)}
          thickness={dots(2)}
        />
      );
      const at8 = build(
        <Label width={mm(57)} height={mm(19)} dpmm={8}>
          {box}
        </Label>
      );
      const at12 = build(
        <Label width={mm(57)} height={mm(19)} dpmm={12}>
          {box}
        </Label>
      );

      expect(at8.toZPL()).toContain("^FO8,8^GB80,40,2,B,0^FS");
      expect(at12.toZPL()).toContain("^FO12,12^GB120,60,2,B,0^FS");
    });
  });
});

test("retail and Code 93 elements match the builder", () => {
  const label = build(
    <Label width={mm(57)} height={mm(19)} dpmm={12}>
      <EAN8 x={dots(10)} y={dots(10)} height={dots(100)}>
        1234567
      </EAN8>
      <UpcA x={dots(10)} y={dots(10)} printCheckDigit={false}>
        07000002198
      </UpcA>
      <UpcE x={dots(10)} y={dots(10)}>
        1230000045
      </UpcE>
      <UpcEanExtension x={dots(10)} y={dots(10)}>
        04414
      </UpcEanExtension>
      <Code93 x={dots(10)} y={dots(10)} printHri={false}>
        ABC
      </Code93>
      <Codabar x={dots(10)} y={dots(10)} start="B" stop="C">
        123
      </Codabar>
    </Label>
  );
  const at = { x: dots(10), y: dots(10) };
  const expected = new LabelBuilder({ width: mm(57), height: mm(19), dpmm: 12 })
    .ean8({ position: at, data: "1234567", height: dots(100) })
    .upcA({ position: at, data: "07000002198", printCheckDigit: false })
    .upcE({ position: at, data: "1230000045" })
    .upcEanExtension({ position: at, data: "04414" })
    .code93({ position: at, data: "ABC", printHri: false })
    .codabar({ position: at, data: "123", start: "B", stop: "C" });

  expect(label.toZPL()).toStrictEqual(expected.toZPL());
});

test("postal, GS1 DataBar and MicroPDF417 elements match the builder", () => {
  const label = build(
    <Label width={mm(57)} height={mm(19)} dpmm={12}>
      <Postnet x={dots(10)} y={dots(10)}>
        12345
      </Postnet>
      <Planet x={dots(10)} y={dots(10)}>
        12345678901
      </Planet>
      <IntelligentMail x={dots(10)} y={dots(10)}>
        00123123456123456789
      </IntelligentMail>
      <GS1DataBar x={dots(10)} y={dots(10)} type="limited">
        12345678901
      </GS1DataBar>
      <MicroPDF417 x={dots(10)} y={dots(10)} mode={5}>
        ABC
      </MicroPDF417>
    </Label>
  );
  const at = { x: dots(10), y: dots(10) };
  const expected = new LabelBuilder({ width: mm(57), height: mm(19), dpmm: 12 })
    .postnet({ position: at, data: "12345" })
    .planet({ position: at, data: "12345678901" })
    .intelligentMail({ position: at, data: "00123123456123456789" })
    .gs1DataBar({ position: at, data: "12345678901", type: "limited" })
    .microPdf417({ position: at, data: "ABC", mode: 5 });

  expect(label.toZPL()).toStrictEqual(expected.toZPL());
});

test("2 of 5, LOGMARS, MSI and Plessey elements match the builder", () => {
  const label = build(
    <Label width={mm(57)} height={mm(19)} dpmm={12}>
      <Industrial2of5 x={dots(10)} y={dots(10)}>
        123456
      </Industrial2of5>
      <Standard2of5 x={dots(10)} y={dots(10)}>
        123456
      </Standard2of5>
      <LOGMARS x={dots(10)} y={dots(10)}>
        12AB
      </LOGMARS>
      <MSI x={dots(10)} y={dots(10)} checkDigits="C">
        123456
      </MSI>
      <Plessey x={dots(10)} y={dots(10)}>
        12345
      </Plessey>
    </Label>
  );
  const at = { x: dots(10), y: dots(10) };
  const expected = new LabelBuilder({ width: mm(57), height: mm(19), dpmm: 12 })
    .industrial2of5({ position: at, data: "123456" })
    .standard2of5({ position: at, data: "123456" })
    .logmars({ position: at, data: "12AB" })
    .msi({ position: at, data: "123456", checkDigits: "C" })
    .plessey({ position: at, data: "12345" });

  expect(label.toZPL()).toStrictEqual(expected.toZPL());
});
