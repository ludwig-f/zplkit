/**
 * <zpl-preview>: shows ZPL as images, rendered locally in the browser by
 * @zplkit/render. Importing this module registers the element.
 */

/** What a renderer is asked to render */
type RenderOptions = {
  /** Label width in millimeters */
  widthMm: number;
  /** Label height in millimeters */
  heightMm: number;
  /** Dots per millimeter: 6, 8, 12 or 24 */
  dpmm: number;
  /** Anti-aliased 8-bit output instead of the printer's 1-bit dots */
  grayscale: boolean;
  /** Fonts already on the printer, by path like "E:ARIAL.TTF" */
  fonts?: Record<string, Uint8Array>;
  /** A font file to draw font 0 with instead of the open-licensed stand-in */
  font0?: Uint8Array;
};

/** Renders ZPL to one base64-encoded PNG per label */
type Render = (zpl: string, options: RenderOptions) => Promise<string[]>;

/** Anything with a toZPL() method, such as a zplkit Label */
type ZplSource = string | { toZPL(): string };

let renderer: Promise<Render> | undefined;

/** Options for `configure()` */
type ConfigureOptions = {
  /**
   * Use your own renderer, for example one that calls an API
   * @defaultValue renderZpl from @zplkit/render, loaded on first use
   */
  render?: Render;
};

/** Change how previews are rendered */
const configure = (options: ConfigureOptions): void => {
  if (options.render) {
    renderer = Promise.resolve(options.render);
  }
};

// The renderer is only loaded once something is rendered
const loadRenderer = (): Promise<Render> =>
  (renderer ??= import("@zplkit/render").then((module) => module.renderZpl));

const DEFAULT_SMOOTHING = 0.4;

/** Default size when neither attributes nor ^PW/^LL give one: 4 × 6 inches */
const DEFAULT_SIZE_MM = { width: 101.6, height: 152.4 };

/** The last value of a command like ^PW800 in the ZPL, if any */
const lastValue = (zpl: string, command: string): number | undefined => {
  const matches = [...zpl.matchAll(new RegExp(`\\^${command}(\\d+)`, "g"))];
  const value = matches[matches.length - 1]?.[1];
  return value === undefined ? undefined : Number(value);
};

const template = `
<style>
  :host { display: inline-block; }
  [part="labels"] { display: flex; flex-direction: column; gap: 8px; }
  img { display: block; max-width: 100%; height: auto; background: #fff; }
  /* With fade, labels fade in when they first appear, not on every change */
  @keyframes zpl-fade { from { opacity: 0; } }
  :host([fade]) [data-entering] img {
    animation: zpl-fade var(--zpl-fade-duration, 200ms) ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    :host([fade]) [data-entering] img { animation: none; }
  }
  [part="error"] { color: #b3261e; font: 13px/1.4 ui-monospace, monospace; white-space: pre-wrap; }
</style>
<div part="labels"></div>
<div part="error" role="alert" hidden></div>
`;

import { smoothPng } from "./smooth.js";

// Lets the module load where there is no DOM, e.g. during server rendering
const Base = (
  typeof HTMLElement === "undefined" ? class {} : HTMLElement
) as typeof HTMLElement;

/**
 * Shows ZPL as images, one per label.
 *
 * Attributes: `zpl`, `width` and `height` (label size in millimeters, taken
 * from ^PW and ^LL when left out), `dpmm` (dots per millimeter, default 8)
 * `smoothing` (0 for the printer's exact dots to 1 for fully anti-aliased
 * edges, default 0.4) and `fade` (fade labels in when they first appear).
 * Properties `fonts` and `font0` take font files, as for @zplkit/render.
 *
 * Events: `zpl-render-start` when a render starts, `zpl-render` with
 * `detail.images` (PNG data URLs), the size and resolution used and how long
 * it took, and `zpl-error` with `detail.error`.
 */
class ZplPreview extends Base {
  static observedAttributes = ["zpl", "width", "height", "dpmm", "smoothing"];
  // fade only changes the styles, so it isn't observed

  #zpl: ZplSource = "";
  #fonts: Record<string, Uint8Array> | undefined;
  #font0: Uint8Array | undefined;
  #renderId = 0;
  #scheduled = false;
  #labels: HTMLElement;
  #error: HTMLElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = template;
    this.#labels = root.querySelector('[part="labels"]') as HTMLElement;
    this.#error = root.querySelector('[part="error"]') as HTMLElement;
  }

  /** The ZPL to show, or anything with a toZPL() method */
  get zpl(): ZplSource {
    return this.#zpl;
  }

  set zpl(value: ZplSource) {
    this.#zpl = value;
    this.#schedule();
  }

  /**
   * TrueType or OpenType fonts already stored on the printer, by path like
   * "E:ARIAL.TTF", for labels that call them with ^A@ or ^CW
   */
  get fonts(): Record<string, Uint8Array> | undefined {
    return this.#fonts;
  }

  set fonts(value: Record<string, Uint8Array> | undefined) {
    this.#fonts = value;
    this.#schedule();
  }

  /**
   * A TrueType or OpenType font to draw font 0 with, instead of the
   * open-licensed stand-in, like the printer's own if you have a license
   */
  get font0(): Uint8Array | undefined {
    return this.#font0;
  }

  set font0(value: Uint8Array | undefined) {
    this.#font0 = value;
    this.#schedule();
  }

  /**
   * Fade labels in when they first appear, over --zpl-fade-duration (200ms
   * by default). Later changes to the ZPL don't fade again.
   */
  get fade(): boolean {
    return this.hasAttribute("fade");
  }

  set fade(value: boolean) {
    this.toggleAttribute("fade", value);
  }

  /** Label width in millimeters */
  get width(): number | undefined {
    return this.#number("width");
  }

  set width(value: number | undefined) {
    this.#setNumber("width", value);
  }

  /** Label height in millimeters */
  get height(): number | undefined {
    return this.#number("height");
  }

  set height(value: number | undefined) {
    this.#setNumber("height", value);
  }

  /** Dots per millimeter: 6, 8, 12 or 24 for 152, 203, 300 or 600 dpi */
  get dpmm(): number | undefined {
    return this.#number("dpmm");
  }

  set dpmm(value: number | undefined) {
    this.#setNumber("dpmm", value);
  }

  /**
   * How much to smooth edges: 0 shows the printer's dots exactly, 1 is fully
   * anti-aliased. Defaults to 0.4, which takes off the roughest edges.
   */
  get smoothing(): number {
    const value = this.#number("smoothing");
    return value === undefined || Number.isNaN(value)
      ? DEFAULT_SMOOTHING
      : Math.min(1, Math.max(0, value));
  }

  set smoothing(value: number) {
    this.#setNumber("smoothing", value);
  }

  connectedCallback(): void {
    this.#schedule();
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    value: string | null
  ): void {
    if (name === "zpl") {
      this.#zpl = value ?? "";
    }
    this.#schedule();
  }

  #number(name: string): number | undefined {
    const value = this.getAttribute(name);
    return value === null || value === "" ? undefined : Number(value);
  }

  #setNumber(name: string, value: number | undefined): void {
    if (value === undefined) {
      this.removeAttribute(name);
    } else {
      this.setAttribute(name, String(value));
    }
  }

  /** Render once after the current batch of changes */
  #schedule(): void {
    // Rendered once added to the page: connectedCallback schedules it then
    if (this.#scheduled || !this.isConnected) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      void this.#render();
    });
  }

  async #render(): Promise<void> {
    const id = ++this.#renderId;
    const zpl = typeof this.#zpl === "string" ? this.#zpl : this.#zpl.toZPL();

    if (!zpl.trim()) {
      this.#show([], undefined);
      return;
    }

    const dpmm = this.dpmm ?? 8;
    const smoothing = this.smoothing;
    const width =
      this.width ??
      (lastValue(zpl, "PW") ?? DEFAULT_SIZE_MM.width * dpmm) / dpmm;
    const height =
      this.height ??
      (lastValue(zpl, "LL") ?? DEFAULT_SIZE_MM.height * dpmm) / dpmm;

    const started = performance.now();
    this.dispatchEvent(
      new CustomEvent("zpl-render-start", { detail: { zpl } })
    );

    try {
      const render = await loadRenderer();
      const pngs = await render(zpl, {
        widthMm: width,
        heightMm: height,
        dpmm,
        grayscale: smoothing > 0,
        ...(this.#fonts && { fonts: this.#fonts }),
        ...(this.#font0 && { font0: this.#font0 }),
      });
      if (!pngs.length) {
        throw new Error(
          "No labels parsed: labels start with ^XA and end with ^XZ"
        );
      }
      const images = await Promise.all(
        pngs.map((png) =>
          smoothing > 0 && smoothing < 1
            ? smoothPng(png, smoothing)
            : `data:image/png;base64,${png}`
        )
      );

      // A newer render started while this one was running
      if (id !== this.#renderId) return;

      this.#show(images, undefined);
      const duration = Math.round(performance.now() - started);
      this.dispatchEvent(
        new CustomEvent("zpl-render", {
          detail: { images, width, height, dpmm, duration },
        })
      );
    } catch (thrown) {
      if (id !== this.#renderId) return;

      const error =
        thrown instanceof Error ? thrown : new Error(String(thrown));
      this.#show([], error);
      this.dispatchEvent(new CustomEvent("zpl-error", { detail: { error } }));
    }
  }

  #show(images: string[], error: Error | undefined): void {
    // Only labels appearing where there were none fade in
    this.#labels.toggleAttribute(
      "data-entering",
      images.length > 0 && this.#labels.childElementCount === 0
    );
    this.#labels.replaceChildren(
      ...images.map((src, index) => {
        const image = document.createElement("img");
        image.src = src;
        image.setAttribute("part", "label");
        image.alt =
          images.length === 1
            ? "Label"
            : `Label ${index + 1} of ${images.length}`;
        return image;
      })
    );
    this.#error.textContent = error ? error.message : "";
    this.#error.hidden = !error;
  }
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("zpl-preview")
) {
  customElements.define("zpl-preview", ZplPreview);
}

/** `zpl-render-start`: a render started, for the ZPL in `zpl` */
type RenderStartDetail = { zpl: string };

/** `zpl-render`: the labels as PNG data URLs, and how they were rendered */
type RenderDetail = {
  images: string[];
  /** Label width and height in millimeters */
  width: number;
  height: number;
  dpmm: number;
  /** Milliseconds from the start of the render to the images */
  duration: number;
};

/** `zpl-error`: why the ZPL couldn't be shown */
type ErrorDetail = { error: Error };

declare global {
  interface HTMLElementTagNameMap {
    "zpl-preview": ZplPreview;
  }
  interface HTMLElementEventMap {
    "zpl-render-start": CustomEvent<RenderStartDetail>;
    "zpl-render": CustomEvent<RenderDetail>;
    "zpl-error": CustomEvent<ErrorDetail>;
  }
}

export type {
  ZplSource,
  Render,
  RenderOptions,
  ConfigureOptions,
  RenderStartDetail,
  RenderDetail,
  ErrorDetail,
};
export { ZplPreview, configure };
