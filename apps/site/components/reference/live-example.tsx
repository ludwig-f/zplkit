"use client";

import { useState } from "react";
import type {} from "@zplkit/preview/react";
import { encodeShare } from "@/playground/share";
import { FadeInImage } from "./fade-in-image";

/** The example's image, and where it sits on the label, in dots */
type Image = {
  file: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/** An area of the label, in dots, right and bottom exclusive */
type Area = { left: number; top: number; right: number; bottom: number };

/** Examples render at 203 dpi, like their images */
const DPMM = 8;
/** Images show at three quarters of a pixel per dot */
const SCALE = 0.75;
/** Live previews render on a 4 by 6 inch label, then show what's printed */
const LABEL = { width: 812, height: 1218 };
/** Blank dots kept past the ink, as on the images */
const MARGIN = 16;

/** The ink in a rendered label with a margin around it, in dots */
const inkArea = (src: string): Promise<Area | undefined> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      let left = Infinity;
      let top = Infinity;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          if (data[(y * image.width + x) * 4] < 128) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }
      resolve(
        right < 0
          ? undefined
          : {
              left: left - MARGIN,
              top: top - MARGIN,
              right: right + 1 + MARGIN,
              bottom: bottom + 1 + MARGIN,
            }
      );
    };
    image.src = src;
  });

/**
 * A command's example, editable. It shows the image rendered when the site
 * was built until the first edit, then renders in the browser with
 * <zpl-preview>, the same renderer, as you type.
 */
export function LiveExample({
  code,
  zpl,
  image,
}: {
  code: string;
  zpl: string;
  image?: Image;
}) {
  const [text, setText] = useState(zpl);
  const [live, setLive] = useState(false);
  // The area shown: the image's at first, growing evenly around what the
  // edits print, so the ink stays centered
  const initial: Area | undefined = image && {
    left: image.left,
    top: image.top,
    right: image.left + image.width,
    bottom: image.top + image.height,
  };
  const [shown, setShown] = useState(initial);
  const edited = text !== zpl;

  const edit = (value: string) => {
    setText(value);
    if (!live && image) {
      // Loads the element and, on its first render, the renderer
      void import("@zplkit/preview/react").then(() => setLive(true));
    }
  };

  const openInViewer = async () => {
    const hash = await encodeShare({
      zpl: text,
      // A label from the top left corner to past the ink shown
      width: shown ? { mm: shown.right / DPMM } : undefined,
      height: shown ? { mm: shown.bottom / DPMM } : undefined,
      dpmm: DPMM,
      smoothing: 0.4,
    });
    window.location.href = `/viewer#${hash}`;
  };

  const button =
    "text-[13px] font-semibold text-accent hover:underline disabled:text-muted disabled:no-underline";

  return (
    <div className="grid gap-x-8 gap-y-4 @[720px]:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-baseline gap-4">
          <h2
            id="example"
            className="scroll-mt-24 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"
          >
            Example
          </h2>
          <span className="text-[12.5px] text-muted">
            {image ? "Edit it to see what prints" : "Editable"}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setText(zpl)}
            disabled={!edited}
            className={button}
          >
            Reset
          </button>
          <button type="button" onClick={openInViewer} className={button}>
            Open in viewer
          </button>
        </div>
        <textarea
          value={text}
          onChange={(event) => edit(event.target.value)}
          spellCheck={false}
          aria-label={`${code} example ZPL`}
          rows={Math.max(3, zpl.split("\n").length)}
          className="w-full resize-y rounded-md border border-rule-strong bg-code px-3 py-2.5 font-mono text-[13px] leading-[1.7] text-ink focus:border-accent focus:outline-none"
        />
      </div>

      {image && (
        <div className="@[720px]:pt-6">
          {/* The paper only dims in dark mode, so what's shown is what prints */}
          <div
            className="max-w-full overflow-hidden rounded-[6px] bg-paper shadow-label"
            style={{
              width: shown ? (shown.right - shown.left) * SCALE : undefined,
              height:
                live && shown ? (shown.bottom - shown.top) * SCALE : undefined,
            }}
          >
            {live ? (
              <zpl-preview
                zpl={text}
                width={Math.max(LABEL.width, image.left + image.width) / DPMM}
                height={Math.max(LABEL.height, image.top + image.height) / DPMM}
                dpmm={DPMM}
                smoothing={1}
                onzpl-render={(event) => {
                  const [src] = event.detail.images;
                  if (!src) return;
                  void inkArea(src).then((ink) => {
                    if (!ink || !initial) return;
                    setShown({
                      left: Math.min(initial.left, ink.left),
                      top: Math.min(initial.top, ink.top),
                      right: Math.max(initial.right, ink.right),
                      bottom: Math.max(initial.bottom, ink.bottom),
                    });
                  });
                }}
                className="block mix-blend-multiply [&::part(label)]:w-full"
                // The label shifted so the area shown is in view
                style={{
                  width:
                    Math.max(LABEL.width, image.left + image.width) * SCALE,
                  marginLeft: -(shown?.left ?? 0) * SCALE,
                  marginTop: -(shown?.top ?? 0) * SCALE,
                }}
              />
            ) : (
              <FadeInImage
                src={`/docs/commands/examples/${image.file}`}
                alt={`What the ${code} example prints`}
                width={image.width}
                height={image.height}
                loading="lazy"
                className="block h-auto w-full mix-blend-multiply"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
