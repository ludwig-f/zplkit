import { suite, test, expect, beforeEach } from "vitest";
import { configure } from "./index.js";
import type { RenderOptions } from "./index.js";

type Call = {
  zpl: string;
  options: RenderOptions;
  resolve: (images: string[]) => void;
};

// A renderer the tests control: each call waits until the test resolves it
const calls: Call[] = [];
configure({
  render: (zpl, options) =>
    new Promise((resolve) => calls.push({ zpl, options, resolve })),
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const create = () => {
  const element = document.createElement("zpl-preview");
  document.body.append(element);
  return element;
};

const shownImages = (element: HTMLElement) =>
  [...element.shadowRoot!.querySelectorAll("img")].map((image) => image.src);

suite("configure({ render })", () => {
  beforeEach(() => {
    calls.length = 0;
    document.body.replaceChildren();
  });

  test("renders once for several changes in a row", async () => {
    const element = create();
    element.dpmm = 12;
    element.zpl = "^XA^PW120^LL100^XZ";
    element.zpl = "^XA^PW240^LL100^XZ";
    await tick();

    expect(calls.map((call) => call.zpl)).toStrictEqual(["^XA^PW240^LL100^XZ"]);
  });

  test("passes the label size and resolution", async () => {
    const element = create();
    element.dpmm = 12;
    element.zpl = "^XA^PW240^LL120^XZ";
    await tick();

    expect(calls[0].options).toMatchObject({
      widthMm: 20,
      heightMm: 10,
      dpmm: 12,
    });
  });

  test("asks for one label more than it shows", async () => {
    const element = create();
    element.maxLabels = 3;
    element.zpl = "^XA^XZ";
    await tick();

    expect(calls[0].options.limit).toBe(4);
  });

  test("says there are more labels when a renderer returns too many", async () => {
    const element = create();
    element.maxLabels = 1;
    element.smoothing = 0;
    element.zpl = "^XA^XZ^XA^XZ";
    await tick();
    calls[0].resolve(["bmV3", "bmV3"]);
    await tick();

    expect(shownImages(element)).toHaveLength(1);
    expect(
      element.shadowRoot!.querySelector('[part="more"]')!.textContent
    ).toBe("More labels");
  });

  test("asks for grayscale output unless smoothing is 0", async () => {
    const smoothed = create();
    smoothed.zpl = "^XA^XZ";
    const crisp = create();
    crisp.smoothing = 0;
    crisp.zpl = "^XA^XZ";
    await tick();

    expect(calls.map((call) => call.options.grayscale)).toStrictEqual([
      true,
      false,
    ]);
  });

  test("passes fonts to the renderer", async () => {
    const element = create();
    const arial = new Uint8Array([1]);
    const font0 = new Uint8Array([2]);
    element.fonts = { "E:ARIAL.TTF": arial };
    element.font0 = font0;
    element.zpl = "^XA^XZ";
    await tick();

    expect(calls[0].options.fonts).toStrictEqual({ "E:ARIAL.TTF": arial });
    expect(calls[0].options.font0).toBe(font0);
  });

  test("renders again when fonts change", async () => {
    const element = create();
    element.zpl = "^XA^XZ";
    await tick();
    element.font0 = new Uint8Array([2]);
    await tick();
    element.fonts = undefined;
    await tick();

    expect(calls).toHaveLength(3);
  });

  test("ignores a result that arrives after a newer render started", async () => {
    const element = create();
    element.zpl = "^XA^FDold^FS^XZ";
    await tick();
    element.zpl = "^XA^FDnew^FS^XZ";
    await tick();

    const [old, current] = calls;
    current.resolve(["bmV3"]);
    await tick();
    old.resolve(["b2xk"]);
    await tick();

    expect(shownImages(element)).toStrictEqual(["data:image/png;base64,bmV3"]);
  });
});
