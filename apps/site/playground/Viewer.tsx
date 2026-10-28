"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeSet } from "@codemirror/state";
import "@zplkit/preview/react";
import "./styles.css";
import { PopoverClose } from "fumadocs-ui/components/ui/popover";
import Editor from "./Editor";
import ProblemList from "./ProblemList";
import { Code, FileArchive, ImageDown, Link2, WrapText } from "lucide-react";
import { format } from "@zplkit/core";
import { convert } from "@zplkit/core/convert";
import type { ConvertOptions } from "@zplkit/core/convert";
import Bench from "./Bench";
import { useFonts } from "./fonts";
import CodePanel from "./CodePanel";
import examples from "./examples";
import { analyze } from "./analyze";
import { decodeShare, encodeCodeShare, encodeShare } from "./share";
import { useSettings } from "./settings";
import {
  dpiFor,
  formatDots,
  formatSize,
  lengthIn,
  toLength,
  toMm,
} from "./units";
import { DiscardDialog, ExportMenu, TemplateMenu, ViewMenu } from "./chrome";
import ToolTitle from "./ToolTitle";
import type { Cursor } from "./Bench";
import type { EditorHandle } from "./Editor";
import type { Problem } from "./analyze";
import type { LabelLength, ShareState } from "./share";
import DesignOverlay from "./designer/DesignOverlay";
import { designFor, type Design } from "./designer/fields";
import { replacesAll } from "./designer/highlight";
import { extentOf } from "./designer/overlay";
import {
  highlightOf,
  redesigned,
  selectAtOffset,
  type Hover,
  type Selection,
} from "./designer/selection";

// Kept from before the rename, so saved labels stay
const STORAGE_KEY = "node-zpl-playground";

/** A label to start from scratch with */
const BLANK = "^XA\n\n^XZ\n";

/** The label, and the template or file it started from */
type Saved = ShareState & { template?: number; file?: string };

const fileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\.zpl$/, "");

const fromExample = (index: number): Saved => {
  const { zpl, width, height, dpmm } = examples[index];
  return { zpl, width, height, dpmm, smoothing: 0, template: index };
};

const labelCount = (count: number) => `${count} label${count === 1 ? "" : "s"}`;

/** Labels the preview shows; the rest can be downloaded as a .zip */
const PREVIEW_LABELS = 5;

/** Most labels in one .zip, as many as the renderer draws at once */
const ZIP_LABELS = 10_000;

/**
 * The label as playground code: convert()'s JSX, with the label as the
 * default export so the playground shows it
 */
const playgroundCode = (code: string) => {
  const name = ["job", "label", "setup"].find((candidate) =>
    code.includes(`const ${candidate} =`)
  );
  return name ? `${code}\nexport default ${name};\n` : code;
};

const loadSaved = (): Saved | undefined => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return undefined;
    const state = JSON.parse(saved);
    // Templates are saved by position, which changes when one is removed
    if (!examples[state.template]) delete state.template;
    // Saved before sizes kept their unit, in millimeters
    if ("widthMm" in state || "heightMm" in state) {
      const { widthMm, heightMm, ...rest } = state;
      return {
        ...rest,
        width: typeof widthMm === "number" ? { mm: widthMm } : undefined,
        height: typeof heightMm === "number" ? { mm: heightMm } : undefined,
      };
    }
    return state as Saved;
  } catch {
    return undefined;
  }
};

const inches = (value: number): LabelLength => ({ inches: value });
const mm = (value: number): LabelLength => ({ mm: value });

/** Common label sizes, in the unit they're sold in */
const sizes = [
  { id: "4x6", label: "4 × 6 in", width: inches(4), height: inches(6) },
  { id: "4x4", label: "4 × 4 in", width: inches(4), height: inches(4) },
  { id: "4x2", label: "4 × 2 in", width: inches(4), height: inches(2) },
  { id: "2x1", label: "2 × 1 in", width: inches(2), height: inches(1) },
  { id: "100x150", label: "100 × 150 mm", width: mm(100), height: mm(150) },
  { id: "57x32", label: "57 × 32 mm", width: mm(57), height: mm(32) },
];

const sameLength = (a: LabelLength | undefined, b: LabelLength) =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);

const resolutions = [
  { dpmm: 6, dpi: 152 },
  { dpmm: 8, dpi: 203 },
  { dpmm: 12, dpi: 300 },
  { dpmm: 24, dpi: 600 },
];

/** The last value of a command like ^PW800 in the ZPL, if any */
const lastValue = (zpl: string, command: string): number | undefined => {
  const matches = [...zpl.matchAll(new RegExp(`\\^${command}(\\d+)`, "g"))];
  const value = matches[matches.length - 1]?.[1];
  return value === undefined ? undefined : Number(value);
};

const unitNames = { mm: "millimeters", in: "inches", dots: "dots" };

const parseNumber = (text: string): number | undefined => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * A number field that keeps what's typed, like "10.", while it has focus,
 * and shows the value it stands for after
 */
function NumberField({
  value,
  onValue,
  ...props
}: {
  value: number | undefined;
  onValue: (value: number | undefined) => void;
  "aria-label": string;
  placeholder: string;
}) {
  const [text, setText] = useState<string>();
  return (
    <input
      {...props}
      inputMode="decimal"
      value={text ?? (value === undefined ? "" : String(value))}
      onChange={(event) => {
        setText(event.target.value);
        onValue(parseNumber(event.target.value));
      }}
      onBlur={() => setText(undefined)}
    />
  );
}

/** The last label home (^LH) in the ZPL, which ^FO positions are relative to */
const labelHome = (zpl: string) => {
  const matches = [...zpl.matchAll(/\^LH(\d+),(\d+)/g)];
  const last = matches[matches.length - 1];
  return last ? { x: Number(last[1]), y: Number(last[2]) } : { x: 0, y: 0 };
};

/** Why the label wouldn't print at all, if it wouldn't */
const blockingReason = (problems: Problem[]) => {
  const rules = new Set(problems.map((problem) => problem.rule));
  if (rules.has("missing-end-format")) {
    return "the format is never closed with ^XZ";
  }
  if (rules.has("missing-start-format")) {
    return "commands come before the format starts with ^XA";
  }
  return undefined;
};

type Tab = "Editor" | "Preview" | "Problems";

export default function Viewer() {
  const [state, setState] = useState<Saved>(
    () => loadSaved() ?? fromExample(0)
  );
  const settings = useSettings();
  // A template waiting for the visitor to confirm replacing their edits
  const [pending, setPending] = useState<number | "blank">();
  const [images, setImages] = useState<string[]>([]);
  /** Different labels in all, also those the preview doesn't show */
  const [labelTotal, setLabelTotal] = useState<number>();
  const [notice, setNotice] = useState<string>();
  const [tab, setTab] = useState<Tab>("Editor");
  const [showCode, setShowCode] = useState(false);
  const fonts = useFonts();
  const [cursor, setCursor] = useState<Cursor>();
  const [render, setRender] = useState<{ busy: boolean; ms?: number }>({
    busy: true,
  });
  const editor = useRef<EditorHandle>(null);
  const [selection, setSelection] = useState<Selection>({
    keys: [],
    label: 0,
  });
  const [hover, setHover] = useState<Hover>();
  /** The ZPL from before a drag, which the preview shows until it ends */
  const [frozen, setFrozen] = useState<string>();
  const { zpl, width, height, dpmm } = state;
  const previewZpl = frozen ?? zpl;
  /** The latest text, ahead of state while a drag edits */
  const latest = useRef(zpl);
  latest.current = zpl;
  /**
   * The editor's changes since the design was last made, from the text
   * `from` to `to`, so the selection follows them
   */
  const edits = useRef<{ from: string; to: string; changes: ChangeSet }>(
    undefined
  );
  /** Where a duplicate starts, and the text it's in, to select once the design has it */
  const selectAt = useRef<{ offset: number; zpl: string } | undefined>(
    undefined
  );
  /** The ZPL the preview is rendering, and the one its images show */
  const rendering = useRef<string | undefined>(undefined);
  const [imagesZpl, setImagesZpl] = useState<string>();
  const { smoothing, unit } = settings;
  const widthMm = width && toMm(width, dpmm);
  const heightMm = height && toMm(height, dpmm);
  const update = (changes: Partial<Saved>) =>
    setState((current) => ({ ...current, ...changes }));

  // Open shared links
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    void decodeShare(hash).then((shared) => {
      if (shared) setState({ ...shared, smoothing: 0 });
      else setNotice("This link doesn't contain a label.");
    });
  }, []);

  useEffect(() => {
    // Saved once a drag ends, not on every step
    if (frozen !== undefined) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable, e.g. in private windows
    }
  }, [state, frozen]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(undefined), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);

  // Checked once a drag ends; the editor keeps the marks in place meanwhile
  const problems = useMemo(
    () => analyze(previewZpl, { dpmm, widthMm, heightMm }),
    [previewZpl, dpmm, widthMm, heightMm]
  );
  const blocked = blockingReason(problems);
  // The template shown: the one the ZPL matches, else the one it started from
  const example = examples.findIndex((option) => option.zpl === zpl);
  const template = example === -1 ? state.template : example;
  const edited = example === -1;
  const name = state.file
    ? fileName(state.file)
    : template === undefined
    ? "label"
    : fileName(examples[template].name);

  // The size the preview uses: settings, then ^PW/^LL, then 4 × 6 in
  const labelSize = {
    width:
      widthMm ?? ((lastValue(zpl, "PW") ?? 0) / dpmm || toMm(inches(4), dpmm)),
    height:
      heightMm ?? ((lastValue(zpl, "LL") ?? 0) / dpmm || toMm(inches(6), dpmm)),
  };
  const labelDots = {
    width: Math.round(labelSize.width * dpmm),
    height: Math.round(labelSize.height * dpmm),
  };
  // The fields on the labels the preview shows, measured as it draws them
  const design = useMemo((): Design => {
    try {
      return designFor(previewZpl, {
        widthMm: labelSize.width,
        heightMm: labelSize.height,
        dpmm,
        fonts: fonts.fonts,
        font0: fonts.font0?.bytes,
        limit: PREVIEW_LABELS,
        antialias: smoothing > 0,
      });
    } catch {
      return { zpl: previewZpl, dpmm, commands: [], labels: [] };
    }
  }, [
    previewZpl,
    labelSize.width,
    labelSize.height,
    dpmm,
    fonts.fonts,
    fonts.font0,
    smoothing,
  ]);
  const designRef = useRef(design);
  designRef.current = design;

  // The selection follows the fields through edits, before it's drawn
  const designed = useRef(design);
  useLayoutEffect(() => {
    const before = designed.current;
    if (before === design) return;
    designed.current = design;
    const edit = edits.current;
    const changes =
      edit && edit.from === before.zpl && edit.to === design.zpl
        ? edit.changes
        : undefined;
    if (before.zpl !== design.zpl) edits.current = undefined;
    const pick = selectAt.current;
    selectAt.current = undefined;
    setSelection((current) =>
      redesigned(before, design, current, { changes, selectAt: pick })
    );
    setHover(undefined);
  }, [design]);

  // The selected and hovered fields' lines in the editor. A drag edits the
  // text past the design it started from; the editor keeps the lines meanwhile.
  useEffect(() => {
    if (frozen !== undefined) return;
    editor.current?.highlight(highlightOf(design, selection, hover));
  }, [design, selection, hover, frozen]);

  /** The editor changed the text: keep the change for the selection */
  const changed = (value: string, changes: ChangeSet) => {
    // A new document, like a template or a file opened: nothing to follow,
    // even fields that happen to start the same
    if (replacesAll(changes)) {
      setSelection({ keys: [], label: 0 });
      setHover(undefined);
    }
    // The editor taking a text from state, like a template, isn't an edit
    if (value === latest.current) return;
    const edit = edits.current;
    edits.current =
      edit && edit.to === latest.current
        ? { from: edit.from, to: value, changes: edit.changes.compose(changes) }
        : { from: latest.current, to: value, changes };
    latest.current = value;
    update({ zpl: value });
  };

  const hovered = useCallback(
    (next: Hover) =>
      setHover((current) =>
        current?.key === next?.key && current?.label === next?.label
          ? current
          : next
      ),
    []
  );

  /** A number in the unit, rounded as the unit shows it */
  const shown = (value: number) =>
    Number(value.toFixed(unit === "in" ? 2 : unit === "mm" ? 1 : 0));
  const size =
    width === undefined && height === undefined
      ? "auto"
      : sizes.find(
          (preset) =>
            sameLength(width, preset.width) && sameLength(height, preset.height)
        )?.id ?? "custom";
  const [custom, setCustom] = useState(size === "custom");
  const sizeValue = custom ? "custom" : size;

  const open = (choice: number | "blank") => {
    setState(
      choice === "blank"
        ? { ...state, zpl: BLANK, template: undefined, file: undefined }
        : fromExample(choice)
    );
    setCustom(false);
    history.replaceState(null, "", location.pathname);
  };

  /** Open a template, asking first if it would replace edited ZPL */
  const pickTemplate = (choice: number | "blank") => {
    if (edited && zpl !== BLANK) setPending(choice);
    else open(choice);
  };

  /** Open a .zpl file from the visitor's computer */
  const openFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zpl,.txt,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      update({ zpl: text, template: undefined, file: file.name });
      history.replaceState(null, "", location.pathname);
    };
    input.click();
  };

  const openInPlayground = async () => {
    try {
      const code = convert(zpl, {
        style: "jsx",
        units: "mm",
        dpmm: dpmm as ConvertOptions["dpmm"],
        labelSize,
      });
      const hash = await encodeCodeShare({
        code: playgroundCode(code),
        smoothing,
      });
      window.location.href = `/playground#${hash}`;
    } catch (cause) {
      setNotice(
        `This ZPL couldn't be converted: ${
          cause instanceof Error ? cause.message : String(cause)
        }`
      );
    }
  };

  const share = async () => {
    const link = `${location.origin}${location.pathname}#${await encodeShare({
      ...state,
      smoothing,
    })}`;
    history.replaceState(null, "", link);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied");
    } catch {
      setNotice("Link is in the address bar");
    }
  };

  const download = () => {
    images.forEach((src, index) => {
      const link = document.createElement("a");
      link.href = src;
      link.download =
        images.length === 1 ? `${name}.png` : `${name}-${index + 1}.png`;
      link.click();
    });
  };

  /** Every label as a PNG, in one .zip, with the printer's exact dots */
  const downloadAll = async () => {
    setNotice(`Rendering ${labelCount(labelTotal ?? 0)}…`);
    try {
      const [{ renderPrinted }, { zipSync }] = await Promise.all([
        import("@zplkit/render"),
        import("fflate"),
      ]);
      const labels = await renderPrinted(zpl, {
        widthMm: labelSize.width,
        heightMm: labelSize.height,
        dpmm,
        grayscale: false,
        fonts: fonts.fonts,
        font0: fonts.font0?.bytes,
        limit: ZIP_LABELS,
      });
      const digits = String(labels.length).length;
      const files = Object.fromEntries(
        labels.map(({ png }, index) => [
          `${name}-${String(index + 1).padStart(digits, "0")}.png`,
          Uint8Array.from(atob(png), (char) => char.charCodeAt(0)),
        ])
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        // PNGs are compressed already, so they're stored as they are
        new Blob([zipSync(files, { level: 0 }) as BlobPart], {
          type: "application/zip",
        })
      );
      link.download = `${name}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      setNotice(`Downloaded ${labelCount(labels.length)}`);
    } catch (cause) {
      setNotice(
        `The labels couldn't be rendered: ${
          cause instanceof Error ? cause.message : String(cause)
        }`
      );
    }
  };

  /** The ^FO that puts a field at a position, from the label home */
  const originAt = ({ x, y }: Cursor) => {
    const home = labelHome(zpl);
    return `^FO${Math.max(x - home.x, 0)},${Math.max(y - home.y, 0)}`;
  };

  /** Copy a clicked position as the ^FO that puts a field there */
  const pick = async (cursor: Cursor) => {
    const origin = originAt(cursor);
    try {
      await navigator.clipboard.writeText(origin);
      setNotice(`Copied ${origin}`);
    } catch {
      setNotice(origin);
    }
  };

  /** One field or setting per line; undo brings the old text back */
  const formatZpl = () => {
    const formatted = format(zpl);
    if (formatted === zpl) {
      setNotice("Already formatted");
    } else {
      update({ zpl: formatted });
      setNotice("Formatted");
    }
  };

  const selectProblem = (problem: Problem) => {
    setTab("Editor");
    // Let the editor show again on phones before selecting
    requestAnimationFrame(() =>
      editor.current?.select(problem.from, problem.to)
    );
  };

  return (
    <div className="playground" data-tool="viewer" data-tab={tab}>
      <div className="toolbar">
        <ToolTitle tool="viewer" />
        <span className="divider" aria-hidden="true" />
        <TemplateMenu
          tool="viewer"
          templates={examples.map((option) => option.name)}
          current={state.file ? undefined : template}
          edited={edited}
          onPick={pickTemplate}
          onBlank={() => pickTemplate("blank")}
          extra={
            <PopoverClose className="menu-item" onClick={openFile}>
              <span className="menu-spacer" />
              Open a .zpl file
            </PopoverClose>
          }
        />
        <label className="field">
          <span className="field-label">Size</span>
          <select
            value={sizeValue}
            onChange={(event) => {
              const id = event.target.value;
              setCustom(id === "custom");
              if (id === "auto") {
                update({ width: undefined, height: undefined });
              } else if (id !== "custom") {
                const preset = sizes.find((s) => s.id === id)!;
                update({ width: preset.width, height: preset.height });
              }
            }}
          >
            <option value="auto">From ^PW and ^LL</option>
            {sizes.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </label>
        {sizeValue === "custom" && (
          <span className="custom-size">
            <NumberField
              aria-label={`Width in ${unitNames[unit]}`}
              placeholder={formatDots(labelDots.width, unit, dpmm)}
              value={width && shown(lengthIn(width, unit, dpmm))}
              onValue={(value) =>
                update({
                  width:
                    value === undefined
                      ? undefined
                      : toLength(value, unit, dpmm),
                })
              }
            />
            ×
            <NumberField
              aria-label={`Height in ${unitNames[unit]}`}
              placeholder={formatDots(labelDots.height, unit, dpmm)}
              value={height && shown(lengthIn(height, unit, dpmm))}
              onValue={(value) =>
                update({
                  height:
                    value === undefined
                      ? undefined
                      : toLength(value, unit, dpmm),
                })
              }
            />
            {unit}
          </span>
        )}
        <div role="radiogroup" aria-label="Resolution" className="segmented">
          {resolutions.map((resolution) => (
            <button
              key={resolution.dpmm}
              type="button"
              role="radio"
              aria-checked={resolution.dpmm === dpmm}
              onClick={() => update({ dpmm: resolution.dpmm })}
            >
              {resolution.dpi}
            </button>
          ))}
        </div>
        <span className="unit">dpi</span>
        <div className="spacer" />
        <ExportMenu
          tool="viewer"
          rows={[
            {
              icon: <Link2 />,
              title: "Share link",
              detail: "A link that opens this label",
              actions: (
                <button type="button" onClick={share}>
                  Copy link
                </button>
              ),
            },
            {
              icon: <Code />,
              title: "zplkit code",
              detail: "This label as JSX or method calls",
              actions: (
                <>
                  <button type="button" onClick={() => setShowCode(true)}>
                    Show code
                  </button>
                  <button type="button" onClick={openInPlayground}>
                    Open in playground
                  </button>
                </>
              ),
            },
            {
              icon: <ImageDown />,
              title: "PNG",
              detail: `${dpiFor(dpmm)} dpi, ${labelCount(
                Math.max(images.length, 1)
              )}`,
              actions: (
                <button
                  type="button"
                  className="primary"
                  onClick={download}
                  disabled={!images.length}
                >
                  Download PNG
                </button>
              ),
            },
            ...((labelTotal ?? 0) > images.length
              ? [
                  {
                    icon: <FileArchive />,
                    title: "All labels",
                    detail: `${labelCount(
                      Math.min(labelTotal!, ZIP_LABELS)
                    )} as PNGs in a .zip`,
                    actions: (
                      <button type="button" onClick={downloadAll}>
                        Download ZIP
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <div role="tablist" className="tabs">
        {(["Editor", "Preview", "Problems"] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === tab}
            onClick={() => setTab(id)}
          >
            {id === "Problems" ? `Problems (${problems.length})` : id}
          </button>
        ))}
      </div>

      <div className="workspace">
        <section className="code" aria-label="ZPL editor">
          <div className="status">
            <span>
              {zpl.split("\n").length} line
              {zpl.split("\n").length === 1 ? "" : "s"}
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="view-button"
              onClick={formatZpl}
              title="One field or setting per line"
            >
              <WrapText aria-hidden="true" />
              Format
            </button>
          </div>
          <Editor
            ref={editor}
            value={zpl}
            problems={problems}
            onChange={changed}
            onCursor={(offset) =>
              setSelection((current) =>
                selectAtOffset(designRef.current, offset, current)
              )
            }
          />
          <div className="problems" data-open={problems.length > 0}>
            <div className="problems-header">
              <span>Problems · {problems.length}</span>
            </div>
            {/* Collapsed while there's nothing to show, slides open after */}
            <div className="problems-body">
              <div>
                <ProblemList problems={problems} onSelect={selectProblem} />
              </div>
            </div>
          </div>
        </section>

        <section className="problems-tab" aria-label="Problems">
          <ProblemList problems={problems} onSelect={selectProblem} />
        </section>

        <section className="preview" aria-label="Label preview">
          <div className="status" aria-live="polite">
            <span className={render.busy ? "busy" : undefined}>
              {render.busy || render.ms === undefined
                ? "Rendering…"
                : `Rendered in ${render.ms} ms`}
            </span>
            <span className="spacer" />
            {cursor ? (
              <>
                <span>
                  x {formatDots(cursor.x, unit, dpmm)}, y{" "}
                  {formatDots(cursor.y, unit, dpmm)} {unit}
                </span>
                <span className="hint">Right-click for {originAt(cursor)}</span>
              </>
            ) : (
              <span>
                {formatSize(labelDots.width, labelDots.height, unit, dpmm)}
              </span>
            )}
            <ViewMenu tool="viewer" settings={settings} fonts={fonts} />
          </div>
          {blocked && (
            <p className="blocked">
              This label would not print: {blocked}. Shown for reference.
            </p>
          )}
          <div className={`bench-area${blocked ? " dimmed" : ""}`}>
            <Bench
              widthMm={labelSize.width}
              heightMm={labelSize.height}
              dpmm={dpmm}
              unit={unit}
              onCursor={setCursor}
              labels={images.length}
              quiet={selection.keys.length > 0 || frozen !== undefined}
              extent={
                frozen === undefined ? extentOf(design, selection) : undefined
              }
              overlay={(boxes) => (
                <DesignOverlay
                  design={design}
                  boxes={boxes}
                  images={images}
                  imagesZpl={imagesZpl}
                  selection={selection}
                  hover={hover}
                  problems={problems}
                  unit={unit}
                  onSelect={setSelection}
                  onHover={hovered}
                  apply={(spec) => editor.current?.apply(spec)}
                  onDrag={(dragging) =>
                    setFrozen(dragging ? latest.current : undefined)
                  }
                  onSelectAt={(offset) => {
                    // Only for the text the edit made; an edit that changed
                    // nothing leaves latest as it was, and the next
                    // redesign drops it
                    selectAt.current = { offset, zpl: latest.current };
                  }}
                  onPick={pick}
                  onUndo={() => editor.current?.undo()}
                  onRedo={() => editor.current?.redo()}
                />
              )}
            >
              <zpl-preview
                zpl={previewZpl}
                width={widthMm}
                height={heightMm}
                dpmm={dpmm}
                smoothing={smoothing}
                fonts={fonts.fonts}
                font0={fonts.font0?.bytes}
                maxLabels={PREVIEW_LABELS}
                fade
                onzpl-render-start={(event) => {
                  rendering.current = event.detail.zpl;
                  setRender((current) => ({ ...current, busy: true }));
                }}
                onzpl-render={(event) => {
                  setImages(event.detail.images);
                  setImagesZpl(rendering.current);
                  setLabelTotal(event.detail.labels);
                  setRender({ busy: false, ms: event.detail.duration });
                }}
                onzpl-error={() => {
                  setImages([]);
                  setImagesZpl(undefined);
                  setLabelTotal(undefined);
                  setRender({ busy: false });
                }}
              />
            </Bench>
          </div>
        </section>
      </div>

      <CodePanel
        open={showCode}
        onClose={() => setShowCode(false)}
        zpl={zpl}
        dpmm={dpmm}
        labelSize={labelSize}
        onCopied={setNotice}
      />

      <DiscardDialog
        from={
          state.file ??
          (template === undefined ? undefined : examples[template].name)
        }
        to={
          pending === undefined
            ? undefined
            : pending === "blank"
            ? "a blank label"
            : examples[pending].name
        }
        onAnswer={(discard) => {
          if (discard && pending !== undefined) open(pending);
          setPending(undefined);
        }}
      />

      <div className="notice" role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}
