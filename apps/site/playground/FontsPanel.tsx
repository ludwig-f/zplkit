"use client";

import { useState } from "react";
import { FONT0, defaultPath, isFontFile, isPrinterPath } from "./fonts";
import type { Fonts } from "./fonts";

/**
 * Font files for the preview, in the View settings: one to draw font 0
 * with, and fonts stored on the printer that labels call by name
 */
export default function FontsPanel({ fonts }: { fonts: Fonts }) {
  const [error, setError] = useState<string>();
  // A printer font that was picked and is waiting for its path
  const [pending, setPending] = useState<{ file: File; path: string }>();

  /** Let the visitor pick a file, and read it if it's a font */
  const pick = (onFont: (file: File, bytes: Uint8Array) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ttf,.otf,.ttc,font/ttf,font/otf,font/collection";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isFontFile(bytes)) {
        setError(`${file.name} isn't a TrueType or OpenType font.`);
        return;
      }
      setError(undefined);
      onFont(file, bytes);
    };
    input.click();
  };

  const addPrinterFont = async () => {
    if (!pending) return;
    const path = pending.path.trim().toUpperCase();
    if (!isPrinterPath(path)) {
      setError("Use the name the label calls, like E:ARIAL.TTF.");
      return;
    }
    const bytes = new Uint8Array(await pending.file.arrayBuffer());
    await fonts.save({ key: path, fileName: pending.file.name, bytes });
    setPending(undefined);
    setError(undefined);
  };

  return (
    <div className="fonts-body">
      <p className="hint">
        Zebra&apos;s fonts are licensed, so zplkit doesn&apos;t include them.
        Open-licensed fonts stand in: text takes the same space as on a printer,
        but letters look slightly different. Files stay in this browser and are
        never uploaded.
      </p>

      <section aria-labelledby="font0-title">
        <h3 id="font0-title">Font 0</h3>
        <p className="hint">
          The scalable font in <code>^A0</code>, also used for fonts the printer
          doesn&apos;t have.
        </p>
        <div className="font-row">
          <span className="font-name">
            {fonts.font0 ? fonts.font0.fileName : "Built-in stand-in"}
          </span>
          <button
            type="button"
            onClick={() =>
              pick((file, bytes) =>
                fonts.save({ key: FONT0, fileName: file.name, bytes })
              )
            }
          >
            {fonts.font0 ? "Replace" : "Choose font file"}
          </button>
          {fonts.font0 && (
            <button type="button" onClick={() => fonts.remove(FONT0)}>
              Remove
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="printer-fonts-title">
        <h3 id="printer-fonts-title">Fonts on the printer</h3>
        <p className="hint">
          Fonts that labels call by name, like{" "}
          <code>^A@N,30,30,E:ARIAL.TTF</code>. Labels that download fonts with{" "}
          <code>~DU</code> don&apos;t need them.
        </p>
        {fonts.printerFonts.map((font) => (
          <div className="font-row" key={font.key}>
            <code className="font-path">{font.key}</code>
            <span className="font-name">{font.fileName}</span>
            <button type="button" onClick={() => fonts.remove(font.key)}>
              Remove
            </button>
          </div>
        ))}
        {pending ? (
          <form
            className="font-row"
            onSubmit={(event) => {
              event.preventDefault();
              void addPrinterFont();
            }}
          >
            <input
              aria-label="Name on the printer"
              value={pending.path}
              onChange={(event) =>
                setPending({ ...pending, path: event.target.value })
              }
              autoFocus
            />
            <span className="font-name">{pending.file.name}</span>
            <button type="submit" className="primary">
              Add
            </button>
            <button type="button" onClick={() => setPending(undefined)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="font-row">
            <button
              type="button"
              onClick={() =>
                pick((file) =>
                  setPending({ file, path: defaultPath(file.name) })
                )
              }
            >
              Add font file
            </button>
          </div>
        )}
      </section>

      {error && (
        <p className="font-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
