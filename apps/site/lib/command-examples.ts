import "server-only";
import { Raster, encodePng, renderLabels } from "@zplkit/render";
import data from "@/content/commands.json";
import details from "@/content/command-details.json";
import { anchorOf } from "@/components/reference/anchor";

/** Examples render at 203 dpi, the most common resolution */
const DPMM = 8;
/** Blank dots kept around the ink */
const MARGIN = 16;

const lastValue = (zpl: string, command: string): number | undefined => {
  const matches = [...zpl.matchAll(new RegExp(`\\^${command}(\\d+)`, "g"))];
  const value = matches[matches.length - 1]?.[1];
  return value === undefined ? undefined : Number(value);
};

/** Where an example's image sits on its label, in dots */
type Crop = { left: number; top: number; width: number; height: number };

/**
 * The ink with the same margin on every side, so it's centered, padding
 * with blank dots past the label's edges. Undefined when nothing prints.
 */
const crop = (raster: Raster): { raster: Raster; crop: Crop } | undefined => {
  const { width, height, ink } = raster;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x] > 0.05) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < 0) return undefined;

  const box = {
    left: left - MARGIN,
    top: top - MARGIN,
    width: right - left + 1 + 2 * MARGIN,
    height: bottom - top + 1 + 2 * MARGIN,
  };
  const cropped = new Raster(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    const sourceY = box.top + y;
    if (sourceY < 0 || sourceY >= height) continue;
    for (let x = 0; x < box.width; x++) {
      const sourceX = box.left + x;
      if (sourceX < 0 || sourceX >= width) continue;
      cropped.ink[y * box.width + x] = ink[sourceY * width + sourceX];
    }
  }
  return { raster: cropped, crop: box };
};

type Example = Crop & { file: string; png: Uint8Array };

let cache: Promise<Map<string, Example>> | undefined;

/**
 * Images of the reference's examples, rendered with zplkit's own renderer
 * at build time, for commands it draws. Keyed by command code.
 */
export const commandExamples = (): Promise<Map<string, Example>> =>
  (cache ??= (async () => {
    const examples = new Map<string, Example>();
    for (const command of data.commands) {
      const zpl = (details as Record<string, { example?: string }>)[
        command.code
      ]?.example;
      if (!command.drawn || command.support === "no" || !zpl) continue;

      const widthMm = (lastValue(zpl, "PW") ?? 812) / DPMM;
      const heightMm = (lastValue(zpl, "LL") ?? 1218) / DPMM;
      const [raster] = renderLabels(zpl, {
        widthMm,
        heightMm,
        dpmm: DPMM,
        antialias: true,
      });
      const cropped = raster && crop(raster);
      if (!cropped) continue;

      examples.set(command.code, {
        ...cropped.crop,
        file: `${anchorOf(command.code)}.png`,
        png: await encodePng(cropped.raster),
      });
    }
    return examples;
  })());
