/**
 * Compiles playground code with Sucrase and runs it, with zplkit as its only
 * import. The worker in run-code.worker.ts calls this away from the page.
 */
import { transform } from "sucrase";
import * as core from "@zplkit/core";
import * as jsx from "@zplkit/core/jsx";
import * as jsxRuntime from "@zplkit/core/jsx-runtime";

/** What running code gave: its ZPL, or why it didn't run */
type Outcome =
  | { ok: true; zpl: string; dpmm: number }
  | { ok: false; message: string; line?: number; column?: number };

const modules: Record<string, unknown> = {
  "@zplkit/core": core,
  "@zplkit/core/jsx": jsx,
  "@zplkit/core/jsx-runtime": jsxRuntime,
  "@zplkit/core/jsx-dev-runtime": jsxRuntime,
};

const require = (name: string) => {
  if (name in modules) return modules[name];
  throw new Error(
    `Only zplkit can be imported here, not "${name}". Use @zplkit/core or @zplkit/core/jsx.`
  );
};

/** Where a line of code ends up in the stack of a function from new Function */
const position = (stack: string | undefined) => {
  const frame = stack
    ?.split("\n")
    .find((line) => /<anonymous>|Function|eval/.test(line));
  const match = frame?.match(/:(\d+):(\d+)\)?\s*$/);
  return match ? { line: Number(match[1]), column: Number(match[2]) } : {};
};

// Browsers put a header before the body of a new Function, so measure it
const headerLines = (() => {
  try {
    new Function("throw new Error()")();
  } catch (error) {
    return (position((error as Error).stack).line ?? 1) - 1;
  }
  return 0;
})();

type Printable = { toZPL(): string; dpmm?: number; parts?: Printable[] };

const isPrintable = (value: unknown): value is Printable =>
  typeof (value as Printable | undefined)?.toZPL === "function";

const isElement = (value: unknown) =>
  typeof (value as { type?: unknown } | null)?.type === "function" &&
  typeof (value as { props?: unknown }).props === "object";

const run = (code: string): Outcome => {
  let compiled: string;
  try {
    compiled = transform(code, {
      transforms: ["typescript", "jsx", "imports"],
      jsxRuntime: "automatic",
      jsxImportSource: "@zplkit/core",
      production: true,
    }).code;
  } catch (error) {
    const { message, loc } = error as {
      message: string;
      loc?: { line: number; column: number };
    };
    return {
      ok: false,
      message: message.replace(/\s*\(\d+:\d+\)$/, ""),
      line: loc?.line,
      column: loc === undefined ? undefined : loc.column + 1,
    };
  }

  const exports: { default?: unknown } = {};
  try {
    new Function("require", "exports", compiled)(require, exports);
  } catch (error) {
    const { line, column } = position((error as Error).stack);
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      line: line === undefined ? undefined : line - headerLines,
      column,
    };
  }

  let result = exports.default;
  // A <Label> element that wasn't built yet
  if (isElement(result)) {
    try {
      result = jsx.build(result as Parameters<typeof jsx.build>[0]);
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }
  if (!isPrintable(result)) {
    return {
      ok: false,
      message:
        result === undefined
          ? "Nothing to show yet. Export the label to preview it, like export default label."
          : "The default export isn't a label. Export a Label, a <Label> element or a PrintJob.",
    };
  }

  try {
    const zpl = result.toZPL();
    const label = [result, ...(result.parts ?? [])].find(
      (part) => typeof part.dpmm === "number"
    );
    return { ok: true, zpl, dpmm: label?.dpmm ?? 8 };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
};

export { run };
export type { Outcome };
