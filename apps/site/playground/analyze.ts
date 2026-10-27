import { lint, parse } from "@zplkit/core";

type Problem = {
  from: number;
  to: number;
  /** 1-based line of `from` */
  line: number;
  severity: "error" | "warning";
  rule: string;
  message: string;
};

type Settings = {
  dpmm: number;
  /** Media size, used for labels without ^PW or ^LL */
  widthMm?: number;
  heightMm?: number;
};

const lineAt = (text: string, offset: number): number =>
  text.slice(0, offset).split("\n").length;

/**
 * Find problems in ZPL: parameters the parser couldn't read, and everything
 * zplkit's linter reports. Ordered by position in the text.
 */
const analyze = (zpl: string, settings: Settings): Problem[] => {
  const { commands, diagnostics } = parse(zpl);
  const dots = (mm: number | undefined) =>
    mm === undefined ? undefined : Math.round(mm * settings.dpmm);

  const problems: Problem[] = [
    ...diagnostics.map((diagnostic) => ({
      from: diagnostic.span.start,
      to: diagnostic.span.end,
      severity: diagnostic.severity,
      rule: diagnostic.rule,
      message: diagnostic.message,
    })),
    ...lint(commands, {
      width: dots(settings.widthMm),
      length: dots(settings.heightMm),
    }).map((diagnostic) => {
      const span = diagnostic.span ?? commands[diagnostic.index]?.span;
      return {
        from: span?.start ?? 0,
        to: span?.end ?? 0,
        severity: diagnostic.severity,
        rule: diagnostic.rule,
        message: diagnostic.message,
      };
    }),
  ].map((problem) => ({
    from: problem.from,
    to: problem.to,
    line: lineAt(zpl, problem.from),
    severity: problem.severity,
    rule: problem.rule,
    message: problem.message,
  }));

  return problems.sort((a, b) => a.from - b.from);
};

export type { Problem, Settings };
export { analyze };
