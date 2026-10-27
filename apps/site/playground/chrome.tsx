"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Upload,
  X,
} from "lucide-react";
import type { Tool } from "@/components/tools";
import FontsPanel from "./FontsPanel";
import type { Fonts } from "./fonts";
import { SMOOTHING } from "./settings";
import type { Unit, useSettings } from "./settings";

/** A popover in the tools' style, with their buttons and colors */
const popover = (tool: Tool, className = "") => ({
  className: `tool-popover w-[min(340px,calc(100vw-16px))] rounded-md border border-rule-strong bg-raised p-0 text-[13.5px] text-ink shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)] backdrop-blur-none ${className}`,
  "data-tool": tool,
});

/**
 * The template the label started from, and a menu to start from another.
 * Shows "edited" once the label has changed since.
 */
export function TemplateMenu({
  tool,
  templates,
  current,
  edited,
  onPick,
  onBlank,
  extra,
}: {
  tool: Tool;
  templates: string[];
  /** The template the label started from, if it did */
  current?: number;
  edited: boolean;
  onPick: (index: number) => void;
  onBlank: () => void;
  /** More ways to start, after the blank label */
  extra?: ReactNode;
}) {
  return (
    <div className="field template">
      <span className="field-label">Template</span>
      <Popover>
        <PopoverTrigger className="menu-button" aria-label="Template">
          <span className="menu-value">
            {current === undefined ? "Your label" : templates[current]}
          </span>
          {edited && current !== undefined && (
            <span className="edited">edited</span>
          )}
          <ChevronDown aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" {...popover(tool, "w-[240px] py-1.5")}>
          <p className="menu-heading">Templates</p>
          {templates.map((name, index) => (
            <PopoverClose
              key={name}
              className="menu-item"
              onClick={() => onPick(index)}
              aria-current={index === current ? "true" : undefined}
            >
              <Check aria-hidden="true" />
              {name}
            </PopoverClose>
          ))}
          <div className="menu-rule" />
          <PopoverClose className="menu-item" onClick={onBlank}>
            <span className="menu-spacer" />
            Start from a blank label
          </PopoverClose>
          {extra}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** One way to take the label out of the tool, in the Export menu */
export type ExportRow = {
  icon: ReactNode;
  title: string;
  detail: string;
  actions: ReactNode;
};

/** Every way to take the label with you: a link, code, ZPL or images */
export function ExportMenu({ tool, rows }: { tool: Tool; rows: ExportRow[] }) {
  return (
    <Popover>
      <PopoverTrigger className="primary export-button" aria-label="Export">
        <Upload aria-hidden="true" />
        <span>Export</span>
        <ChevronDown aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" {...popover(tool)}>
        <p className="popover-title">Export</p>
        {rows.map((row) => (
          <div key={row.title} className="export-row">
            <span className="export-icon">{row.icon}</span>
            <span className="export-text">
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </span>
            <span className="export-actions">{row.actions}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const units: { id: Unit; label: string }[] = [
  { id: "mm", label: "mm" },
  { id: "in", label: "in" },
  { id: "dots", label: "dots" },
];

/**
 * How labels are shown, for both tools: units, edge smoothing and fonts.
 * Sits in the preview's status bar, next to what it changes.
 */
export function ViewMenu({
  tool,
  settings,
  fonts,
}: {
  tool: Tool;
  settings: ReturnType<typeof useSettings>;
  fonts: Fonts;
}) {
  const [panel, setPanel] = useState<"settings" | "fonts">("settings");
  const fontCount = fonts.printerFonts.length;
  return (
    <Popover onOpenChange={(open) => open && setPanel("settings")}>
      <PopoverTrigger className="view-button">
        <Settings aria-hidden="true" />
        View
      </PopoverTrigger>
      <PopoverContent align="end" {...popover(tool)}>
        {panel === "settings" ? (
          <>
            <div className="popover-head">
              <div>
                <p className="popover-title">Settings</p>
                <p className="hint">
                  For the playground and the viewer. Saved in this browser.
                </p>
              </div>
              <PopoverClose className="icon-button" aria-label="Close">
                <X aria-hidden="true" />
              </PopoverClose>
            </div>
            <div className="setting">
              <p className="setting-title">Units</p>
              <div
                role="radiogroup"
                aria-label="Units"
                className="segmented full"
              >
                {units.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.unit === unit.id}
                    onClick={() => settings.update({ unit: unit.id })}
                  >
                    {unit.label}
                  </button>
                ))}
              </div>
              <p className="hint">
                For the rulers, the cursor position and custom sizes. The label
                and its ZPL stay the same.
              </p>
            </div>
            <label className="setting setting-row">
              <span>
                <span className="setting-title">Smooth edges</span>
                <span className="hint">
                  Turn off to see the printer&apos;s exact dots.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={settings.smoothing > 0}
                onChange={(event) =>
                  settings.update({
                    smoothing: event.target.checked ? SMOOTHING : 0,
                  })
                }
              />
            </label>
            <button
              type="button"
              className="setting setting-row setting-link"
              onClick={() => setPanel("fonts")}
            >
              <span>
                <span className="setting-title">Fonts</span>
                <span className="hint">
                  {fonts.font0 ? fonts.font0.fileName : "Built-in font 0"}
                  {fontCount > 0 &&
                    `, ${fontCount} printer font${fontCount === 1 ? "" : "s"}`}
                </span>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="popover-head">
              <button
                type="button"
                className="icon-button"
                aria-label="Back to settings"
                onClick={() => setPanel("settings")}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <p className="popover-title">Fonts</p>
              <span className="spacer" />
              <PopoverClose className="icon-button" aria-label="Close">
                <X aria-hidden="true" />
              </PopoverClose>
            </div>
            <FontsPanel fonts={fonts} />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Asks before a template replaces a label that was edited */
export function DiscardDialog({
  from,
  to,
  onAnswer,
}: {
  /** The template the label started from */
  from?: string;
  /** What would replace it, or undefined while not asking */
  to?: string;
  onAnswer: (discard: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (to) dialog.current?.showModal();
    else dialog.current?.close();
  }, [to]);
  return (
    <dialog
      ref={dialog}
      className="dialog confirm-dialog"
      aria-labelledby="discard-title"
      onClose={() => onAnswer(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onAnswer(false);
      }}
    >
      <div className="confirm-body">
        <h2 id="discard-title">Discard your changes?</h2>
        <p>
          Your label has changed since you opened {from ?? "it"}. Opening {to}{" "}
          replaces it.
        </p>
      </div>
      <div className="confirm-actions">
        <button type="button" onClick={() => onAnswer(false)} autoFocus>
          Keep editing
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => onAnswer(true)}
        >
          Discard and switch
        </button>
      </div>
    </dialog>
  );
}
