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
  /** Render only the first labels; a renderer may render all of them */
  limit?: number;
};

/** A rendered label, and how many times it prints in a row */
type PrintedLabel = { png: string; copies: number };

/**
 * Renders ZPL to one base64-encoded PNG per label, or per different label
 * with how many times each prints
 */
type Render = (
  zpl: string,
  options: RenderOptions
) => Promise<(string | PrintedLabel)[]>;

/** Counts different labels and labels printed, to say how many aren't shown */
type CountLabels = (zpl: string) => { labels: number; printed: number };

/** Anything with a toZPL() method, such as a zplkit Label */
type ZplSource = string | { toZPL(): string };

let renderer: Promise<{ render: Render; count?: CountLabels }> | undefined;

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
    renderer = Promise.resolve({ render: options.render });
  }
};

// The renderer is only loaded once something is rendered
const loadRenderer = () =>
  (renderer ??= import("@zplkit/render").then((module) => ({
    render: module.renderPrinted,
    count: module.countLabels,
  })));

const DEFAULT_MAX_LABELS = 20;

const DEFAULT_SMOOTHING = 0.4;

/** Default size when neither attributes nor ^PW/^LL give one: 4 × 6 inches */
const DEFAULT_SIZE_INCHES = { width: 4, height: 6 };

/** The dots per inch printers are sold as, for each dots per millimeter */
const dpiByDpmm: Record<number, number> = { 6: 152, 8: 203, 12: 300, 24: 600 };

/** Inches in dots, like 6 in at 300 dpi is 1800 dots */
const inchDots = (inches: number, dpmm: number): number =>
  Math.round(inches * (dpiByDpmm[dpmm] ?? dpmm * 25.4));

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
  [part="item"] { position: relative; }
  img { display: block; max-width: 100%; height: auto; background: #fff; }
  [part="copies"] {
    position: absolute; top: 6px; right: 6px; padding: 2px 8px;
    border-radius: 999px; background: rgb(0 0 0 / 0.72); color: #fff;
    font: 600 12px/1.5 system-ui, sans-serif;
  }
  [part="more"] { margin: 0; color: #555; font: 13px/1.4 system-ui, sans-serif; }
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
 * edges, default 0.4), `max-labels` (labels to show before saying how many
 * more there are, default 20) and `fade` (fade labels in when they first
 * appear). Copies printed with ^PQ that are all the same show once, marked
 * with how many more print.
 * Properties `fonts` and `font0` take font files, as for @zplkit/render.
 *
 * Events: `zpl-render-start` when a render starts, `zpl-render` with
 * `detail.images` (PNG data URLs), `detail.copies` (how many times each
 * prints), the size and resolution used and how long it took, and
 * `zpl-error` with `detail.error`.
 */
class ZplPreview extends Base {
  static observedAttributes = [
    "zpl",
    "width",
    "height",
    "dpmm",
    "smoothing",
    "max-labels",
  ];
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

  /**
   * How many labels to show. Past that, a line says how many more there
   * are. Defaults to 20.
   */
  get maxLabels(): number {
    const value = this.#number("max-labels");
    return value === undefined || !(value >= 1)
      ? DEFAULT_MAX_LABELS
      : Math.floor(value);
  }

  set maxLabels(value: number) {
    this.#setNumber("max-labels", value);
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
    const maxLabels = this.maxLabels;

    const dpmm = this.dpmm ?? 8;
    const smoothing = this.smoothing;
    const width =
      this.width ??
      (lastValue(zpl, "PW") ?? inchDots(DEFAULT_SIZE_INCHES.width, dpmm)) /
        dpmm;
    const height =
      this.height ??
      (lastValue(zpl, "LL") ?? inchDots(DEFAULT_SIZE_INCHES.height, dpmm)) /
        dpmm;

    const started = performance.now();
    this.dispatchEvent(
      new CustomEvent("zpl-render-start", { detail: { zpl } })
    );

    try {
      const { render, count } = await loadRenderer();
      // One more than shown, to know whether there are more
      const rendered = await render(zpl, {
        widthMm: width,
        heightMm: height,
        dpmm,
        grayscale: smoothing > 0,
        ...(this.#fonts && { fonts: this.#fonts }),
        ...(this.#font0 && { font0: this.#font0 }),
        limit: maxLabels + 1,
      });
      if (!rendered.length) {
        throw new Error(
          "No labels parsed: labels start with ^XA and end with ^XZ"
        );
      }
      const labels = rendered
        .slice(0, maxLabels)
        .map((label) =>
          typeof label === "string" ? { png: label, copies: 1 } : label
        );
      const images = await Promise.all(
        labels.map(({ png }) =>
          smoothing > 0 && smoothing < 1
            ? smoothPng(png, smoothing)
            : `data:image/png;base64,${png}`
        )
      );
      const copies = labels.map((label) => label.copies);
      const totals = count?.(zpl);
      const more = totals
        ? totals.labels - labels.length
        : rendered.length > maxLabels
        ? Infinity
        : 0;

      // A newer render started while this one was running
      if (id !== this.#renderId) return;

      this.#show(images, undefined, copies, more);
      const duration = Math.round(performance.now() - started);
      this.dispatchEvent(
        new CustomEvent("zpl-render", {
          detail: {
            images,
            copies,
            ...totals,
            width,
            height,
            dpmm,
            duration,
          },
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

  /**
   * Show the labels, each marked with how many more identical copies print,
   * and how many more labels there are (Infinity when unknown)
   */
  #show(
    images: string[],
    error: Error | undefined,
    copies: number[] = [],
    more = 0
  ): void {
    // Only labels appearing where there were none fade in
    this.#labels.toggleAttribute(
      "data-entering",
      images.length > 0 && this.#labels.childElementCount === 0
    );
    const total = images.length + (Number.isFinite(more) ? more : 0);
    const items: HTMLElement[] = images.map((src, index) => {
      const item = document.createElement("div");
      item.setAttribute("part", "item");
      const image = document.createElement("img");
      image.src = src;
      image.setAttribute("part", "label");
      const count = copies[index] ?? 1;
      image.alt =
        (total === 1 ? "Label" : `Label ${index + 1} of ${total}`) +
        (count > 1 ? `, printed ${count} times` : "");
      item.append(image);
      if (count > 1) {
        const badge = document.createElement("span");
        badge.setAttribute("part", "copies");
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = `+${count - 1} identical`;
        item.append(badge);
      }
      return item;
    });
    if (more > 0) {
      const note = document.createElement("p");
      note.setAttribute("part", "more");
      note.textContent = Number.isFinite(more)
        ? `${more} more ${more === 1 ? "label" : "labels"}`
        : "More labels";
      items.push(note);
    }
    this.#labels.replaceChildren(...items);
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
  /** How many times each label prints in a row, from ^PQ */
  copies: number[];
  /**
   * Different labels and labels printed in all, with the default renderer.
   * More than `images` when there are more than `max-labels`.
   */
  labels?: number;
  printed?: number;
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
  PrintedLabel,
  RenderOptions,
  ConfigureOptions,
  RenderStartDetail,
  RenderDetail,
  ErrorDetail,
};
export { ZplPreview, configure };
