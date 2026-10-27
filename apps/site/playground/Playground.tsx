"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "@zplkit/preview/react";
import "./styles.css";
import Editor from "./Editor";
import { Code, ImageDown, Link2 } from "lucide-react";
import Bench from "./Bench";
import { useFonts } from "./fonts";
import ProblemList from "./ProblemList";
import codeExamples, { blankLabel } from "./code-examples";
import { analyze } from "./analyze";
import { createRunner } from "./run-code";
import {
  decodeCodeShare,
  decodeShare,
  encodeCodeShare,
  encodeShare,
} from "./share";
import { useSettings } from "./settings";
import { DiscardDialog, ExportMenu, TemplateMenu, ViewMenu } from "./chrome";
import ToolTitle from "./ToolTitle";
import type { Cursor } from "./Bench";
import type { EditorHandle, EditorProblem } from "./Editor";
import type { Outcome } from "./run-code";
import type { CodeShareState } from "./share";

const STORAGE_KEY = "zplkit-playground";

/** Wait this long after typing stops before running the code */
const DEBOUNCE = 250;

/** The code, and the template it started from */
type Saved = CodeShareState & { template?: number };

const loadSaved = (): Saved | undefined => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Saved) : undefined;
  } catch {
    return undefined;
  }
};

const dpiOf = (dpmm: number) =>
  ({ 6: 152, 8: 203, 12: 300, 24: 600 }[dpmm] ?? Math.round(dpmm * 25.4));

const labelCount = (count: number) => `${count} label${count === 1 ? "" : "s"}`;

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
  const [state, setState] = useState<Saved>(
    () =>
      loadSaved() ?? { code: codeExamples[0].code, smoothing: 0, template: 0 }
  );
  const settings = useSettings();
  // A template waiting for the visitor to confirm replacing their edits
  const [pending, setPending] = useState<number | "blank">();
  const [output, setOutput] = useState<{ zpl: string; dpmm: number }>();
  const [failure, setFailure] = useState<Extract<Outcome, { ok: false }>>();
  const [images, setImages] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [tab, setTab] = useState<Tab>("Code");
  const [cursor, setCursor] = useState<Cursor>();
  const fonts = useFonts();
  const [render, setRender] = useState<{ busy: boolean; ms?: number }>({
    busy: true,
  });
  const editor = useRef<EditorHandle>(null);
  const runner = useRef<ReturnType<typeof createRunner>>(undefined);
  const { code } = state;
  const { smoothing } = settings;
  const update = (changes: Partial<Saved>) =>
    setState((current) => ({ ...current, ...changes }));

  // Open shared links. Links with ZPL are from before the viewer had its own
  // page, so they open there.
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    void (async () => {
      const shared = await decodeCodeShare(hash);
      if (shared) return setState({ code: shared.code, smoothing: 0 });
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
  // The template shown: the one the code matches, else the one it started from
  const example = codeExamples.findIndex((option) => option.code === code);
  const template = example === -1 ? state.template : example;
  const edited = example === -1;

  const open = (choice: number | "blank") => {
    update({
      code: choice === "blank" ? blankLabel : codeExamples[choice].code,
      template: choice === "blank" ? undefined : choice,
    });
    history.replaceState(null, "", location.pathname);
  };

  /** Open a template, asking first if it would replace edited code */
  const pickTemplate = (choice: number | "blank") => {
    if (edited && code !== blankLabel) setPending(choice);
    else open(choice);
  };

  const share = async () => {
    const link = `${location.origin}${
      location.pathname
    }#${await encodeCodeShare({ code, smoothing })}`;
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

  const openInViewer = async () => {
    const hash = await encodeShare({
      zpl,
      // Sized by the label's ^PW and ^LL
      width: undefined,
      height: undefined,
      dpmm,
      smoothing,
    });
    window.location.href = `/viewer#${hash}`;
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
    <div className="playground" data-tool="playground" data-tab={tab}>
      <div className="toolbar">
        <ToolTitle tool="playground" />
        <span className="divider" aria-hidden="true" />
        <TemplateMenu
          tool="playground"
          templates={codeExamples.map((option) => option.name)}
          current={template}
          edited={edited}
          onPick={pickTemplate}
          onBlank={() => pickTemplate("blank")}
        />
        <div className="spacer" />
        <ExportMenu
          tool="playground"
          rows={[
            {
              icon: <Link2 />,
              title: "Share link",
              detail: "A link that opens this code",
              actions: (
                <button type="button" onClick={share}>
                  Copy link
                </button>
              ),
            },
            {
              icon: <Code />,
              title: "ZPL",
              detail: `${Math.round(labelSize.width * dpmm)} × ${Math.round(
                labelSize.height * dpmm
              )} dots, ${labelCount(Math.max(images.length, 1))}`,
              actions: (
                <>
                  <button type="button" onClick={copyZpl} disabled={!zpl}>
                    Copy ZPL
                  </button>
                  <button type="button" onClick={openInViewer} disabled={!zpl}>
                    Open in viewer
                  </button>
                </>
              ),
            },
            {
              icon: <ImageDown />,
              title: "PNG",
              detail: `${dpiOf(dpmm)} dpi, ${labelCount(
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
          ]}
        />
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
            <span className="spacer" />
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
            <ViewMenu tool="playground" settings={settings} fonts={fonts} />
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

      <DiscardDialog
        from={template === undefined ? undefined : codeExamples[template].name}
        to={
          pending === undefined
            ? undefined
            : pending === "blank"
            ? "a blank label"
            : codeExamples[pending].name
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
