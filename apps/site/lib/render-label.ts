import "server-only";
import { renderZpl } from "@zplkit/render";

/**
 * Render ZPL to a PNG data URL on the server, with the same renderer the
 * playground uses in the browser. Used for pages rendered at build time, so
 * visitors don't download the renderer just to see an example label.
 */
export async function renderLabel(
  zpl: string,
  options: { widthMm: number; heightMm: number; dpmm: number }
): Promise<string> {
  const [png] = await renderZpl(zpl, { ...options, grayscale: true });
  return `data:image/png;base64,${png}`;
}
