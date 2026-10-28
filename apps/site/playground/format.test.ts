import { test, expect } from "vitest";
import { parse } from "@zplkit/core";
import { formatZpl } from "./format";

/** The commands a printer reads, without where they are in the text */
const commands = (zpl: string) =>
  parse(zpl).commands.map((command) => ({ ...command, span: undefined }));

test("puts each field and each setting on its own line", () => {
  expect(
    formatZpl(
      "^XA^CI28^PW406^LL203^FO20,20^A0N,40^FDHi^FS^BY2^FO20,80^BCN,50^FD123^FS^XZ"
    )
  ).toBe(
    [
      "^XA",
      "^CI28",
      "^PW406",
      "^LL203",
      "^FO20,20^A0N,40^FDHi^FS",
      "^BY2",
      "^FO20,80^BCN,50^FD123^FS",
      "^XZ",
      "",
    ].join("\n")
  );
});

test("leaves a blank line between labels", () => {
  expect(formatZpl("^XA^FO0,0^FDa^FS^XZ^XA^FO0,0^FDb^FS^XZ")).toBe(
    "^XA\n^FO0,0^FDa^FS\n^XZ\n\n^XA\n^FO0,0^FDb^FS\n^XZ\n"
  );
});

test("keeps spaces in field data, and drops old line breaks", () => {
  expect(formatZpl("^XA\n  ^FO20,20^A0N,40^FD Two  words ^FS\n\n\n^XZ")).toBe(
    "^XA\n^FO20,20^A0N,40^FD Two  words ^FS\n^XZ\n"
  );
});

test("ends a field that's missing its ^FS at the next field", () => {
  expect(formatZpl("^XA^FO0,0^FDa^FO0,40^FDb^FS^XZ")).toBe(
    "^XA\n^FO0,0^FDa\n^FO0,40^FDb^FS\n^XZ\n"
  );
});

test("formats ZPL that's already formatted the same way", () => {
  const zpl = "^XA^FO20,20^A0N,40^FDHi^FS^XZ";
  expect(formatZpl(formatZpl(zpl))).toBe(formatZpl(zpl));
});

test("prints the same labels", () => {
  const zpl =
    "~DGR:LOGO.GRF,4,1,FF00FF00\n^XA^CC#\n#FO10,10#A0N,30#FDa ^ b#FS#XZ" +
    "^XA^FO0,0^GB100,2,2^FS^FX note  ^XZ";
  expect(commands(formatZpl(zpl))).toEqual(commands(zpl));
});

test("leaves text without commands alone", () => {
  expect(formatZpl("hello")).toBe("hello");
  expect(formatZpl("")).toBe("");
});
