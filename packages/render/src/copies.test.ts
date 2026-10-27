// Copies with ^PQ, and serialized data with ^SN and ^SF
import { describe, test, expect } from "vitest";
import { countLabels, renderLabels } from "./index.js";

const size = { widthMm: 50, heightMm: 25, dpmm: 8 };
const render = (zpl: string, limit?: number) =>
  renderLabels(zpl, { ...size, limit });
const text = "^FO20,20^A0N,40";

describe("copies", () => {
  test("identical copies render once, with their count", () => {
    const labels = render(`^XA${text}^FDSame^FS^PQ3^XZ`);
    expect(labels.map((label) => label.copies)).toEqual([3]);
  });

  test("serial numbers render each copy", () => {
    const labels = render(`^XA${text}^SN001,1,Y^FS^PQ3^XZ`);
    expect(labels.map((label) => label.copies)).toEqual([1, 1, 1]);
    expect(labels[1].ink).toEqual(render(`^XA${text}^FD002^FS^XZ`)[0].ink);
  });

  test("replicates repeat each number", () => {
    const labels = render(`^XA${text}^SN001,1,Y^FS^PQ5,0,2^XZ`);
    expect(labels.map((label) => label.copies)).toEqual([2, 2, 1]);
    expect(labels[2].ink).toEqual(render(`^XA${text}^FD003^FS^XZ`)[0].ink);
  });

  test("^SF counts up the field data", () => {
    const labels = render(`^XA${text}^FDAB0099^SF%%dddd,1^FS^PQ2^XZ`);
    expect(labels[1].ink).toEqual(render(`^XA${text}^FDAB0100^FS^XZ`)[0].ink);
  });

  test("serial numbers go into barcodes", () => {
    const barcode = "^FO20,20^BY2^BCN,60";
    const labels = render(`^XA${barcode}^SN0001,1,Y^FS^PQ2^XZ`);
    expect(labels[1].ink).toEqual(render(`^XA${barcode}^FD0002^FS^XZ`)[0].ink);
  });

  test("limit renders only the first labels", () => {
    expect(render(`^XA${text}^SN001,1,Y^FS^PQ500^XZ`, 5)).toHaveLength(5);
  });

  test("too many different labels need a limit", () => {
    expect(() => render(`^XA${text}^SN1^FS^PQ20000^XZ`)).toThrow(RangeError);
    expect(render(`^XA${text}^SN1^FS^PQ20000^XZ`, 2)).toHaveLength(2);
  });

  test("countLabels counts without rendering", () => {
    expect(
      countLabels(
        `^XA${text}^SN001,1,Y^FS^PQ5,0,2^XZ^XA${text}^FDSame^FS^PQ4^XZ`
      )
    ).toEqual({ labels: 4, printed: 9 });
    expect(countLabels(`^XA${text}^FDOne^FS^XZ`)).toEqual({
      labels: 1,
      printed: 1,
    });
  });
});
