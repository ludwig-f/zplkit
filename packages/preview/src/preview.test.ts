import { suite, describe, test, expect, beforeEach } from "vitest";
import { ZplPreview } from "./index.js";

/** Width and height of a PNG from a data URL, read from its IHDR chunk */
const pngSize = (dataUrl: string) => {
  const bytes = Buffer.from(
    dataUrl.replace(/^data:image\/png;base64,/, ""),
    "base64"
  );
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const nextRender = (element: HTMLElement) =>
  new Promise<CustomEvent>((resolve, reject) => {
    element.addEventListener("zpl-render", (e) => resolve(e as CustomEvent), {
      once: true,
    });
    element.addEventListener("zpl-error", (e) =>
      reject((e as CustomEvent).detail.error)
    );
  });

const nextError = (element: HTMLElement) =>
  new Promise<CustomEvent>((resolve) =>
    element.addEventListener("zpl-error", (e) => resolve(e as CustomEvent), {
      once: true,
    })
  );

const images = (element: HTMLElement) =>
  [...element.shadowRoot!.querySelectorAll("img")] as HTMLImageElement[];

const create = () => {
  const element = document.createElement("zpl-preview") as ZplPreview;
  document.body.append(element);
  return element;
};

suite("<zpl-preview>", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  test("is registered as a custom element", () => {
    expect(customElements.get("zpl-preview")).toBe(ZplPreview);
  });

  describe("rendering", () => {
    test("renders the zpl attribute as a PNG image", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.setAttribute("zpl", "^XA^PW400^LL200^FO20,20^A0,40^FDHi^FS^XZ");

      const event = await rendered;
      const [image] = images(element);

      expect(image.src).toMatch(/^data:image\/png;base64,/);
      expect(event.detail.images).toStrictEqual([image.src]);
    });

    test("sizes the image from ^PW, ^LL and dpmm", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.setAttribute("dpmm", "8");
      element.setAttribute("zpl", "^XA^PW400^LL200^FO20,20^A0,40^FDHi^FS^XZ");
      await rendered;

      expect(pngSize(images(element)[0].src)).toStrictEqual({
        width: 400,
        height: 200,
      });
    });

    test("labels without a size are 4 × 6 inches at the printer's dpi", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.setAttribute("dpmm", "12");
      element.setAttribute("zpl", "^XA^FO20,20^GB40,40,40^FS^XZ");
      await rendered;

      expect(pngSize(images(element)[0].src)).toStrictEqual({
        width: 1200,
        height: 1800,
      });
    });

    test("width and height attributes in millimeters override ^PW and ^LL", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.setAttribute("width", "25");
      element.setAttribute("height", "10");
      element.setAttribute("dpmm", "12");
      element.zpl = "^XA^PW400^LL200^FO20,20^A0,40^FDHi^FS^XZ";
      await rendered;

      expect(pngSize(images(element)[0].src)).toStrictEqual({
        width: 300,
        height: 120,
      });
    });

    test("accepts anything with toZPL(), like a zplkit Label", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.zpl = { toZPL: () => "^XA^PW100^LL100^FO0,0^GB50,50,50^FS^XZ" };
      await rendered;

      expect(pngSize(images(element)[0].src)).toStrictEqual({
        width: 100,
        height: 100,
      });
    });

    test("exposes each image as the label part for styling", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.zpl = "^XA^PW100^LL100^FDHi^FS^XZ";
      await rendered;

      expect(images(element)[0].getAttribute("part")).toBe("label");
    });

    test("renders one image per label", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.zpl =
        "^XA^PW100^LL100^FO0,0^FDOne^FS^XZ^XA^PW100^LL100^FO0,0^FDTwo^FS^XZ";
      await rendered;

      expect(images(element).map((image) => image.alt)).toStrictEqual([
        "Label 1 of 2",
        "Label 2 of 2",
      ]);
    });

    test("shows the latest ZPL after several changes in a row", async () => {
      const element = create();
      let renders = 0;
      element.addEventListener("zpl-render", () => renders++);
      const rendered = nextRender(element);

      element.setAttribute("dpmm", "8");
      element.zpl = "^XA^PW100^LL100^FDfirst^FS^XZ";
      element.zpl = "^XA^PW120^LL100^FDsecond^FS^XZ";
      await rendered;
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(renders).toBe(1);
      expect(pngSize(images(element)[0].src).width).toBe(120);
    });

    test("fires zpl-render-start before each render", async () => {
      const element = create();
      const events: string[] = [];
      element.addEventListener("zpl-render-start", () => events.push("start"));
      element.addEventListener("zpl-render", () => events.push("render"));
      const rendered = nextRender(element);
      element.setAttribute("zpl", "^XA^FO20,20^A0,40^FDHi^FS^XZ");

      await rendered;
      expect(events).toStrictEqual(["start", "render"]);
    });

    test("tells zpl-render the size, resolution and time it took", async () => {
      const element = create();
      const rendered = nextRender(element);
      element.setAttribute("dpmm", "12");
      element.setAttribute("zpl", "^XA^PW600^LL300^FO20,20^A0,40^FDHi^FS^XZ");

      const { detail } = await rendered;
      expect(detail).toMatchObject({ width: 50, height: 25, dpmm: 12 });
      expect(detail.duration).toBeGreaterThanOrEqual(0);
    });

    test("waits until it's in the page to render", async () => {
      // React creates custom elements and sets their properties before
      // adding them, and an early event would reach an unmounted component
      const element = document.createElement("zpl-preview") as ZplPreview;
      let renders = 0;
      element.addEventListener("zpl-render", () => renders++);
      element.zpl = "^XA^PW100^LL100^FDHi^FS^XZ";
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(renders).toBe(0);

      const rendered = nextRender(element);
      document.body.append(element);
      await rendered;
      expect(renders).toBe(1);
    });

    test("shows nothing for empty ZPL", async () => {
      const element = create();
      element.zpl = "";
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(images(element)).toStrictEqual([]);
    });
  });

  describe("fading in", () => {
    const labels = (element: HTMLElement) =>
      element.shadowRoot!.querySelector('[part="labels"]')!;

    test("marks labels that appear where there were none", async () => {
      const element = create();
      element.setAttribute("fade", "");
      let rendered = nextRender(element);
      element.setAttribute("zpl", "^XA^FO20,20^A0,40^FDHi^FS^XZ");
      await rendered;
      expect(labels(element).hasAttribute("data-entering")).toBe(true);

      // A new render of labels already shown doesn't fade again
      rendered = nextRender(element);
      element.setAttribute("zpl", "^XA^FO20,20^A0,40^FDHo^FS^XZ");
      await rendered;
      expect(labels(element).hasAttribute("data-entering")).toBe(false);
    });

    test("fade reflects as a boolean attribute", () => {
      const element = create();
      expect(element.fade).toBe(false);
      element.fade = true;
      expect(element.hasAttribute("fade")).toBe(true);
      element.fade = false;
      expect(element.hasAttribute("fade")).toBe(false);
    });
  });

  describe("errors", () => {
    test("shows the error and fires zpl-error for ZPL without labels", async () => {
      const element = create();
      const failed = nextError(element);
      element.zpl = "not zpl";

      const event = await failed;
      const message = element.shadowRoot!.querySelector("[part=error]")!;

      expect(event.detail.error).toBeInstanceOf(Error);
      expect(message.textContent).toMatch(/no labels parsed/i);
      expect(message.hasAttribute("hidden")).toBe(false);
      expect(images(element)).toStrictEqual([]);
    });

    test("clears the error once the ZPL renders", async () => {
      const element = create();
      const failed = nextError(element);
      element.zpl = "not zpl";
      await failed;

      const rendered = nextRender(element);
      element.zpl = "^XA^PW100^LL100^FDok^FS^XZ";
      await rendered;

      expect(
        element
          .shadowRoot!.querySelector("[part=error]")!
          .hasAttribute("hidden")
      ).toBe(true);
    });
  });

  describe("properties", () => {
    test("reflect numeric attributes", () => {
      const element = create();
      element.dpmm = 12;
      element.width = 50.8;

      expect(element.getAttribute("dpmm")).toBe("12");
      expect(element.getAttribute("width")).toBe("50.8");
      expect(element.height).toBeUndefined();
    });

    test("smoothing defaults to 0.4 and reflects", () => {
      const element = create();
      expect(element.smoothing).toBe(0.4);

      element.smoothing = 0;
      expect(element.getAttribute("smoothing")).toBe("0");
      expect(element.smoothing).toBe(0);
    });

    test("smoothing is kept between 0 and 1", () => {
      const element = create();
      element.setAttribute("smoothing", "3");
      expect(element.smoothing).toBe(1);
      element.setAttribute("smoothing", "-1");
      expect(element.smoothing).toBe(0);
    });

    test("the zpl property returns what was set", () => {
      const element = create();
      const label = { toZPL: () => "^XA^XZ" };
      element.zpl = label;

      expect(element.zpl).toBe(label);
    });
  });
});
