import { parse } from "@zplkit/core";
import { countCopies } from "./copies.js";
import { expandFormats } from "./formats.js";
import { encodePng } from "./png.js";
import { renderLabels } from "./render.js";
import type { RenderOptions } from "./render.js";

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/** Options for `renderZpl()` */
type RenderZplOptions = Omit<RenderOptions, "antialias"> & {
  /** Anti-aliased edges instead of the printer's whole dots */
  grayscale: boolean;
};

/** A rendered label, and how many times it prints in a row */
type PrintedLabel = {
  /** Base64-encoded PNG */
  png: string;
  /** From ^PQ: copies that are all the same are drawn once */
  copies: number;
};

/**
 * Render ZPL to one base64-encoded PNG per different label, with how many
 * times each prints. Serialized labels (^SN, ^SF) are drawn for each copy;
 * use `limit` to draw only the first.
 */
const renderPrinted = async (
  zpl: string,
  options: RenderZplOptions
): Promise<PrintedLabel[]> => {
  const rasters = renderLabels(zpl, {
    ...options,
    antialias: options.grayscale,
  });
  return Promise.all(
    rasters.map(async (raster) => ({
      png: toBase64(await encodePng(raster)),
      copies: raster.copies,
    }))
  );
};

/**
 * How many different labels ZPL renders to, and how many it prints with
 * ^PQ's copies, without drawing them
 */
const countLabels = (zpl: string): { labels: number; printed: number } =>
  countCopies(expandFormats(parse(zpl).commands));

/**
 * Render ZPL to one base64-encoded PNG per different label: copies with
 * ^PQ that are all the same are drawn once. The signature matches what
 * @zplkit/preview expects from a renderer, so it can be passed to
 * `configure({ render: renderZpl })`.
 */
const renderZpl = async (
  zpl: string,
  options: RenderZplOptions
): Promise<string[]> => {
  const rasters = renderLabels(zpl, {
    ...options,
    antialias: options.grayscale,
  });
  return Promise.all(
    rasters.map(async (raster) => toBase64(await encodePng(raster)))
  );
};

export type { RenderOptions, RenderZplOptions, PrintedLabel };
export type { Path, Point, Color, Sampling } from "./raster.js";
export type { Element, LabelLayout, LayoutOptions } from "./layout.js";
export { renderZpl, renderPrinted, renderLabels, countLabels, encodePng };
export { Raster, fillPath } from "./raster.js";
export { layout } from "./layout.js";
