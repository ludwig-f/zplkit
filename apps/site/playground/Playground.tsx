"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@zplkit/preview/react";
import "./styles.css";
import Editor from "./Editor";
import Bench from "./Bench";
import FontsPanel from "./FontsPanel";
import { useFonts } from "./fonts";
import ProblemList from "./ProblemList";
import codeExamples from "./code-examples";
import { analyze } from "./analyze";
import { createRunner } from "./run-code";
import { decodeCodeShare, decodeShare, encodeCodeShare } from "./share";
import type { Cursor } from "./Bench";
import type { EditorHandle, EditorProblem } from "./Editor";
import type { Outcome } from "./run-code";
import type { CodeShareState } from "./share";

const STORAGE_KEY = "zplkit-playground";

/** Smoothing when "Smooth edges" is on; off shows the printer's exact dots */
const SMOOTHING = 0.4;

/** Wait this long after typing stops before running the code */
const DEBOUNCE = 250;

const loadSaved = (): CodeShareState | undefined => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as CodeShareState) : undefined;
  } catch {
    return undefined;
  }
};

/** The first value of a command like ^PW800 in the ZPL, if any */
const firstValue = (zpl: string, command: string): number | undefined => {
  const value = zpl.match(new RegExp(`\\^${command}(\\d+)`))?.[1];
  return value === undefined ? undefined : Number(value);
};

/** Offsets in the code of a 1-based line and column */
const rangeAt = (code: string, line: number, column = 1) => {
  const lines = code.split("\n");
  const index = Math.min(Math.max(line, 1), lines.length) - 1;
  const start = lines.slice(0, index).join("\n").length + (index ? 1 : 0);
  const text = lines[index] ?? "";
  // Underline from the column to the end of the line, or the whole line
  const from = start + Math.min(Math.max(column - 1, 0), text.length);
  const to = start + text.length;
  return from < to ? { from, to } : { from: start, to: Math.max(to, start) };
};

type Tab = "Code" | "Preview" | "Problems";

/** A problem in the list: in the code, or in the ZPL the code built */
type PlaygroundProblem = {
  severity: "error" | "warning";
  rule: string;
  message: string;
  line?: number;
  from?: number;
  to?: number;
};

export default function Playground() {
  const [state, setState] = useState<CodeShareState>(
    () => loadSaved() ?? { code: codeExamples[0].code, smoothing: SMOOTHING }
  );
  const [output, setOutput] = useState<{ zpl: string; dpmm: number }>();
  const [failure, setFailure] = useState<Extract<Outcome, { ok: false }>>();
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [tab, setTab] = useState<Tab>("Code");
  const [cursor, setCursor] = useState<Cursor>();
  const [showFonts, setShowFonts] = useState(false);
  const fonts = useFonts();
  const fontCount = fonts.printerFonts.length + (fonts.font0 ? 1 : 0);
  const [render, setRender] = useState<{ busy: boolean; ms?: number }>({
    busy: true,
  });
  const editor = useRef<EditorHandle>(null);
  const runner = useRef<ReturnType<typeof createRunner>>(undefined);
  const { code, smoothing } = state;
  const update = (changes: Partial<CodeShareState>) =>
    setState((current) => ({ ...current, ...changes }));

  // Open shared links. Links with ZPL are from before the viewer had its own
  // page, so they open there.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    void (async () => {
      const shared = await decodeCodeShare(hash);
      if (shared) return setState(shared);
      if (await decodeShare(hash)) return location.replace(`/viewer#${hash}`);
      setNotice("This link doesn't contain a label.");
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable, e.g. in private windows
    }
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(undefined), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    runner.current = createRunner();
    return () => runner.current?.dispose();
  }, []);

  // Run the code once typing pauses. The last label that ran stays shown
  // while the code has an error.
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const outcome = await runner.current?.run(code);
      if (!outcome) return;
      if (outcome.ok) {
        setOutput({ zpl: outcome.zpl, dpmm: outcome.dpmm });
        setFailure(undefined);
      } else {
        setFailure(outcome);
      }
    }, DEBOUNCE);
    return () => clearTimeout(timeout);
  }, [code]);

  const zpl = output?.zpl ?? "";
  const dpmm = output?.dpmm ?? 8;
  const labelSize = {
    width: (firstValue(zpl, "PW") ?? 0) / dpmm || 101.6,
    height: (firstValue(zpl, "LL") ?? 0) / dpmm || 152.4,
  };

  const lintProblems = useMemo(
    () => (zpl ? analyze(zpl, { dpmm }) : []),
    [zpl, dpmm]
  );
  const problems: PlaygroundProblem[] = [
    ...(failure
      ? [
          {
            severity: "error" as const,
            rule: "code",
            message: failure.message,
            line: failure.line,
            ...(failure.line === undefined
              ? {}
              : rangeAt(code, failure.line, failure.column)),
          },
        ]
      : []),
    // Lint problems are in the ZPL, which has no lines in the code
    ...lintProblems.map(({ severity, rule, message }) => ({
      severity,
      rule,
      message,
    })),
  ];
  const editorProblems = problems.filter(
    (problem): problem is EditorProblem & PlaygroundProblem =>
      problem.from !== undefined && problem.to !== undefined
  );
  const example = codeExamples.findIndex((option) => option.code === code);

  const share = async () => {
    const link = `${location.origin}${
      location.pathname
    }#${await encodeCodeShare(state)}`;
    history.replaceState(null, "", link);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied");
    } catch {
      setNotice("Link is in the address bar");
    }
  };

  const copyZpl = async () => {
    try {
      await navigator.clipboard.writeText(zpl);
      setNotice("ZPL copied");
    } catch {
      setNotice("Couldn't copy the ZPL");
    }
  };

  const download = () => {
    images.forEach((src, index) => {
      const link = document.createElement("a");
      link.href = src;
      link.download =
        images.length === 1 ? "label.png" : `label-${index + 1}.png`;
      link.click();
    });
  };

  const selectProblem = (problem: PlaygroundProblem) => {
    if (problem.from === undefined || problem.to === undefined) return;
    const { from, to } = problem;
    setTab("Code");
    // Let the editor show again on phones before selecting
    requestAnimationFrame(() => editor.current?.select(from, to));
  };

  return (
    <div className="playground" data-tab={tab}>
      <div className="toolbar">
        <span className="filename">label.tsx</span>
        <span className="divider" aria-hidden="true" />
        <label className="toggle">
          <input
            type="checkbox"
            checked={smoothing > 0}
            onChange={(event) =>
              update({ smoothing: event.target.checked ? SMOOTHING : 0 })
            }
          />
          Smooth edges
        </label>
        <div className="spacer" />
        <select
          aria-label="Open an example"
          value={example === -1 ? "" : example}
          onChange={(event) => {
            update({ code: codeExamples[Number(event.target.value)].code });
            history.replaceState(null, "", location.pathname);
          }}
        >
          <option value="" disabled>
            Examples
          </option>
          {codeExamples.map((option, index) => (
            <option key={option.name} value={index}>
              {option.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setShowFonts(true)}>
          {fontCount ? `Fonts (${fontCount})` : "Fonts"}
        </button>
        <button type="button" onClick={share}>
          Share link
        </button>
        <button type="button" onClick={copyZpl} disabled={!zpl}>
          Copy ZPL
        </button>
        <button
          type="button"
          className="primary"
          onClick={download}
          disabled={!images.length}
        >
          Download PNG
        </button>
      </div>

      <div role="tablist" className="tabs">
        {(["Code", "Preview", "Problems"] as const).map((id) => (
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
        <section className="code" aria-label="Code editor">
          <Editor
            ref={editor}
            language="tsx"
            value={code}
            problems={editorProblems}
            onChange={(value) => update({ code: value })}
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
            {cursor ? (
              <span title="Click to copy as ^FO">
                x {cursor.x}, y {cursor.y}
              </span>
            ) : (
              <span>
                {Math.round(labelSize.width * dpmm)} ×{" "}
                {Math.round(labelSize.height * dpmm)} dots
              </span>
            )}
          </div>
          {failure && output && (
            <p className="blocked">
              The code has an error, so this is the last label it built.
            </p>
          )}
          {failure && !output && (
            <p className="blocked">
              The code has an error. Fix it to see the label.
            </p>
          )}
          <div className={`bench-area${failure && output ? " dimmed" : ""}`}>
            {output && (
              <Bench
                widthMm={labelSize.width}
                heightMm={labelSize.height}
                onCursor={setCursor}
                labels={images.length}
                onPick={async ({ x, y }) => {
                  const origin = `x={dots(${x})} y={dots(${y})}`;
                  try {
                    await navigator.clipboard.writeText(origin);
                    setNotice(`Copied ${origin}`);
                  } catch {
                    setNotice(origin);
                  }
                }}
              >
                <zpl-preview
                  zpl={zpl}
                  dpmm={dpmm}
                  smoothing={smoothing}
                  fonts={fonts.fonts}
                  font0={fonts.font0?.bytes}
                  fade
                  onzpl-render-start={() =>
                    setRender((current) => ({ ...current, busy: true }))
                  }
                  onzpl-render={(event) => {
                    setImages(event.detail.images);
                    setRender({ busy: false, ms: event.detail.duration });
                  }}
                  onzpl-error={() => {
                    setImages([]);
                    setRender({ busy: false });
                  }}
                />
              </Bench>
            )}
          </div>
        </section>
      </div>

      <FontsPanel
        open={showFonts}
        onClose={() => setShowFonts(false)}
        fonts={fonts}
      />

      <div className="notice" role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}
