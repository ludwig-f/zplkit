"use client";

import { useEffect, useRef, useState } from "react";
import { convert } from "@zplkit/core/convert";
import type { ConvertOptions } from "@zplkit/core/convert";
import { codeTheme } from "@/lib/code-theme";

type Style = NonNullable<ConvertOptions["style"]>;
type Units = NonNullable<ConvertOptions["units"]>;

const styles: { id: Style; label: string }[] = [
  { id: "jsx", label: "JSX" },
  { id: "builder", label: "Method calls" },
];

const units: { id: Units; label: string }[] = [
  { id: "mm", label: "mm" },
  { id: "dots", label: "dots" },
];

/** Highlight with Shiki, loaded the first time code is shown */
const highlight = async (code: string) => {
  const { codeToHtml } = await import("shiki/bundle/web");
  return codeToHtml(code, { lang: "tsx", theme: codeTheme });
};

/**
 * The label as zplkit code in a dialog: JSX or Label method calls, with
 * lengths in millimeters or dots, ready to copy into a project
 */
export default function CodePanel({
  open,
  onClose,
  zpl,
  dpmm,
  labelSize,
  onCopied,
}: {
  open: boolean;
  onClose: () => void;
  zpl: string;
  dpmm: number;
  labelSize: { width: number; height: number };
  onCopied: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [style, setStyle] = useState<Style>("jsx");
  const [unit, setUnit] = useState<Units>("mm");
  const [html, setHtml] = useState<string>();

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  let code = "";
  let error: string | undefined;
  if (open) {
    try {
      code = convert(zpl, {
        style,
        units: unit,
        dpmm: dpmm as ConvertOptions["dpmm"],
        labelSize,
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  useEffect(() => {
    if (!code) return;
    let current = true;
    void highlight(code).then((result) => {
      if (current) setHtml(result);
    });
    return () => {
      current = false;
    };
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      onCopied("Code copied");
    } catch {
      onCopied("Couldn't copy. Select the code instead.");
    }
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="code-dialog-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id="code-dialog-title">Label as code</h2>
        <div role="radiogroup" aria-label="Code style" className="segmented">
          {styles.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === style}
              onClick={() => setStyle(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Lengths in" className="segmented">
          {units.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === unit}
              onClick={() => setUnit(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button
          type="button"
          className="primary"
          onClick={copy}
          disabled={!code}
        >
          Copy
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="dialog-body">
        {error ? (
          <p className="dialog-error">
            This ZPL couldn&apos;t be converted: {error}
          </p>
        ) : html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>
      <p className="dialog-note">
        Fields without a matching element are kept as raw ZPL.{" "}
        <a href="/docs/converting">How converting works</a>
      </p>
    </dialog>
  );
}
