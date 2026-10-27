import { lint } from "./lint.js";
import { parse } from "./parse.js";
import type { LintDiagnostic } from "./lint.js";

/** Anything that produces ZPL, like a Label or PrinterSetup */
type PrintJobPart = { toZPL(): string };

/** Options for `new PrintJob()` */
type PrintJobOptions = {
  /**
   * Leave out the line breaks between parts in the output
   * @defaultValue true
   */
  minify?: boolean;
};

const isPart = (value: unknown): value is PrintJobPart =>
  typeof (value as PrintJobPart | undefined)?.toZPL === "function";

/**
 * Everything to send to a printer at once: printer setup and labels, in the
 * order they should run. Setup sent before the labels changes the printer
 * for them; each label prints with its own settings.
 */
class PrintJob {
  readonly #parts: PrintJobPart[] = [];
  readonly #minify: boolean;

  constructor(...parts: PrintJobPart[]);
  constructor(options: PrintJobOptions, ...parts: PrintJobPart[]);
  constructor(...args: (PrintJobOptions | PrintJobPart)[]) {
    const [first, ...rest] = args;
    const options = first && !isPart(first) ? first : {};
    this.#minify = options.minify ?? true;
    this.add(...((first && !isPart(first) ? rest : args) as PrintJobPart[]));
  }

  /** The setup and labels in the job, in order */
  get parts(): readonly PrintJobPart[] {
    return [...this.#parts];
  }

  /** Add setup or labels to the end of the job */
  add(...parts: PrintJobPart[]): this {
    this.#parts.push(...parts);
    return this;
  }

  /** @returns The ZPL of every part, in order */
  toZPL(): string {
    return this.#parts
      .map((part) => part.toZPL())
      .join(this.#minify ? "" : "\n");
  }

  /**
   * Find problems the printer would not report in the whole job, like a
   * printer command inside a label. Indexes and spans refer to toZPL().
   */
  lint(): LintDiagnostic[] {
    return lint(parse(this.toZPL()).commands);
  }
}

export default PrintJob;
export type { PrintJobPart, PrintJobOptions };
