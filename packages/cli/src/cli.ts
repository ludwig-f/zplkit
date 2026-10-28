/**
 * The zplkit command: render, lint, convert, view and print ZPL labels.
 * Everything it touches outside goes through an Io, so it can be run
 * without files, a browser or a printer.
 */
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import { parseArgs } from "node:util";
import { lint, parse } from "@zplkit/core";
import { convert } from "@zplkit/core/convert";
import { encodePng, renderLabels } from "@zplkit/render";
import type { Command } from "@zplkit/core";

/** A printer, as far as the CLI needs one */
type PrinterLike = {
  send(zpl: string): Promise<void>;
  status(): Promise<unknown>;
  close(): Promise<void>;
};

/** What the CLI does outside itself */
type Io = {
  stdout(text: string): void;
  stderr(text: string): void;
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  /** Open a link in the browser */
  open(url: string): Promise<void>;
  connect(host: string, port: number): Promise<PrinterLike>;
};

const VIEWER = "https://zplkit.fingal.dev/viewer";

const usage = `Usage: zplkit <command> [options]

Commands:
  zplkit render <file>   Render labels to PNG files
  zplkit lint <file...>  List problems the printer won't report
  zplkit convert <file>  Turn ZPL into zplkit code
  zplkit view <file>     Open labels in the web viewer
  zplkit print <file>    Send labels to a network printer
  zplkit status          Ask a network printer how it's doing

Use - as the file to read standard input.

Options:
  --dpi <dpi>            Printer resolution: 152, 203, 300 or 600 (default 203)
  --width, --height      Label size, like 4in, 101.6mm or 812 (dots);
                         from ^PW and ^LL, else 4 × 6 in
  -o, --output <file>    render: where to write the PNG
  --limit <n>            render: only the first n different labels
  --clock <date>         render: the printer's time for ^FC, like 2026-10-28T08:00
  --strict               lint: fail on warnings too
  --style jsx|builder    convert: the code to write (default jsx)
  --units mm|dots        convert: lengths in millimeters where exact, or dots
  --no-open              view: print the link without opening it
  --printer <host:port>  print, status: the printer's address (port 9100)
  --no-check             print: send without asking the printer's status first
  -v, --version          Show the version
  -h, --help             Show this help`;

/** A usage mistake: said on stderr, and the command exits with 2 */
class UsageError extends Error {}

const dpmmByDpi: Record<string, 6 | 8 | 12 | 24> = {
  "152": 6,
  "203": 8,
  "300": 12,
  "600": 24,
};

const resolution = (dpi: string | undefined) => {
  const dpmm = dpmmByDpi[dpi ?? "203"];
  if (!dpmm) {
    throw new UsageError(`--dpi must be 152, 203, 300 or 600, got ${dpi}`);
  }
  return { dpmm, dpi: Number(dpi ?? "203") };
};

/** A length like 4in, 101.6mm or 812 (dots), in dots */
const lengthInDots = (
  value: string,
  name: string,
  { dpmm, dpi }: { dpmm: number; dpi: number }
) => {
  const match = /^(\d+(?:\.\d+)?)(in|mm|dots)?$/.exec(value.trim());
  if (!match) {
    throw new UsageError(
      `--${name} must be a length like 4in, 101.6mm or 812, got ${value}`
    );
  }
  const number = Number(match[1]);
  if (match[2] === "in") return Math.round(number * dpi);
  if (match[2] === "mm") return Math.round(number * dpmm);
  return Math.round(number);
};

/** The last value of a command like ^PW in the ZPL */
const lastOf = <T extends Command["type"]>(
  commands: readonly Command[],
  type: T
) =>
  commands
    .filter((c): c is Extract<Command, { type: T }> => c.type === type)
    .pop();

const read = async (io: Io, file: string) => {
  try {
    return file === "-" ? await io.readStdin() : await io.readFile(file);
  } catch {
    throw new Error(`Can't read ${file === "-" ? "standard input" : file}`);
  }
};

const onlyFile = (positionals: string[], command: string) => {
  if (positionals.length !== 1) {
    throw new UsageError(
      `zplkit ${command} takes one file, or - for standard input`
    );
  }
  return positionals[0];
};

const render = async (io: Io, args: string[]) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      dpi: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      limit: { type: "string" },
      clock: { type: "string" },
    },
  });
  const file = onlyFile(positionals, "render");
  const zpl = await read(io, file);
  const printer = resolution(values.dpi);
  const { commands } = parse(zpl);
  const width = values.width
    ? lengthInDots(values.width, "width", printer)
    : lastOf(commands, "PrintWidth")?.width ?? 4 * printer.dpi;
  const height = values.height
    ? lengthInDots(values.height, "height", printer)
    : lastOf(commands, "LabelLength")?.length ?? 6 * printer.dpi;
  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
    throw new UsageError(
      `--limit must be a whole number above 0, got ${values.limit}`
    );
  }
  const clock = values.clock === undefined ? undefined : new Date(values.clock);
  if (clock && Number.isNaN(clock.getTime())) {
    throw new UsageError(
      `--clock must be a date like 2026-10-28T08:00, got ${values.clock}`
    );
  }

  const rasters = renderLabels(commands, {
    widthMm: width / printer.dpmm,
    heightMm: height / printer.dpmm,
    dpmm: printer.dpmm,
    limit,
    clock,
  });
  if (!rasters.length) {
    throw new Error("No labels: labels start with ^XA and end with ^XZ");
  }

  const base = (values.output ?? (file === "-" ? "label" : file)).replace(
    /\.(png|zpl|txt)$/i,
    ""
  );
  const digits = String(rasters.length).length;
  for (const [index, raster] of rasters.entries()) {
    const path =
      rasters.length === 1
        ? values.output ?? `${base}.png`
        : `${base}-${String(index + 1).padStart(digits, "0")}.png`;
    await io.writeFile(path, await encodePng(raster));
    io.stdout(
      raster.copies > 1 ? `${path} (prints ${raster.copies} times)` : path
    );
  }
  return 0;
};

/** Line and column, from 1, of an offset in the text */
const position = (text: string, offset: number) => {
  const before = text.slice(0, offset).split("\n");
  return `${before.length}:${before[before.length - 1].length + 1}`;
};

const lintFiles = async (io: Io, args: string[]) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { strict: { type: "boolean" } },
  });
  if (!positionals.length) {
    throw new UsageError(
      "zplkit lint takes one or more files, or - for standard input"
    );
  }
  let failed = false;
  for (const file of positionals) {
    const zpl = await read(io, file);
    const diagnostics = lint(parse(zpl).commands);
    if (!diagnostics.length) {
      io.stdout(`${file}: no problems`);
      continue;
    }
    for (const { rule, severity, message, span } of diagnostics) {
      const where = span ? position(zpl, span.start) : "1:1";
      io.stdout(`${file}:${where}  ${severity}  ${message}  ${rule}`);
      if (severity === "error" || values.strict) failed = true;
    }
  }
  return failed ? 1 : 0;
};

const convertFile = async (io: Io, args: string[]) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      style: { type: "string" },
      units: { type: "string" },
      dpi: { type: "string" },
    },
  });
  const zpl = await read(io, onlyFile(positionals, "convert"));
  if (values.style && values.style !== "jsx" && values.style !== "builder") {
    throw new UsageError(`--style must be jsx or builder, got ${values.style}`);
  }
  if (values.units && values.units !== "mm" && values.units !== "dots") {
    throw new UsageError(`--units must be mm or dots, got ${values.units}`);
  }
  io.stdout(
    convert(zpl, {
      style: values.style as "jsx" | "builder" | undefined,
      units: values.units as "mm" | "dots" | undefined,
      dpmm: resolution(values.dpi).dpmm,
    })
  );
  return 0;
};

/** A label size in a viewer link: millimeters, or inches as given */
const linkLength = (value: string | undefined, name: string, dpmm: number) => {
  if (value === undefined) return null;
  const inches = /^(\d+(?:\.\d+)?)in$/.exec(value.trim());
  if (inches) return { inches: Number(inches[1]) };
  return lengthInDots(value, name, { dpmm, dpi: dpmm * 25.4 }) / dpmm;
};

const view = async (io: Io, args: string[]) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      dpi: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      "no-open": { type: "boolean" },
    },
  });
  const zpl = await read(io, onlyFile(positionals, "view"));
  const { dpmm } = resolution(values.dpi);
  // The viewer's share links: the label and its settings, deflated
  const state = [
    zpl,
    linkLength(values.width, "width", dpmm),
    linkLength(values.height, "height", dpmm),
    dpmm,
    0.4,
  ];
  const hash = deflateRawSync(JSON.stringify(state))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const link = `${VIEWER}#${hash}`;
  io.stdout(link);
  if (!values["no-open"]) await io.open(link);
  return 0;
};

/** A printer address like 192.168.1.50 or printer.local:6101 */
const address = (value: string | undefined) => {
  if (!value) {
    throw new UsageError(
      "Give the printer's address with --printer, like --printer 192.168.1.50"
    );
  }
  const match = /^(.+?)(?::(\d+))?$/.exec(value.trim())!;
  return { host: match[1], port: match[2] ? Number(match[2]) : 9100 };
};

/** Why a printer can't print, from its ~HS status */
const problems: [string, string][] = [
  ["paperOut", "out of labels"],
  ["ribbonOut", "out of ribbon"],
  ["headOpen", "the head is open"],
  ["paused", "paused"],
  ["bufferFull", "its buffer is full"],
  ["overTemperature", "the head is too hot"],
  ["underTemperature", "the head is too cold"],
  ["labelWaiting", "a label is waiting to be taken"],
  ["corruptRam", "its settings were lost"],
];

/** Whether the printer can print, and what to say if it can't */
const describe = (host: string, status: unknown) => {
  const s = status as Record<string, unknown>;
  if (s.noReply) {
    return {
      ready: false,
      text: `${host} didn't answer: it may be out of labels or ribbon, open, or paused`,
    };
  }
  if (s.ready) return { ready: true, text: `${host} is ready` };
  const reasons = problems.filter(([key]) => s[key]).map(([, text]) => text);
  return {
    ready: false,
    text: `${host} isn't ready: ${
      reasons.join(", ") || "it says it can't print"
    }`,
  };
};

const print = async (io: Io, args: string[]) => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      printer: { type: "string" },
      "no-check": { type: "boolean" },
    },
  });
  const file = onlyFile(positionals, "print");
  const { host, port } = address(values.printer);
  const zpl = await read(io, file);
  const printer = await io.connect(host, port);
  try {
    if (!values["no-check"]) {
      const { ready, text } = describe(host, await printer.status());
      if (!ready) {
        io.stderr(`${text}. Nothing was sent.`);
        return 1;
      }
    }
    await printer.send(zpl);
    io.stdout(`Sent ${file === "-" ? "the labels" : file} to ${host}`);
    return 0;
  } finally {
    await printer.close();
  }
};

const status = async (io: Io, args: string[]) => {
  const { values } = parseArgs({
    args,
    options: { printer: { type: "string" } },
  });
  const { host, port } = address(values.printer);
  const printer = await io.connect(host, port);
  try {
    const { ready, text } = describe(host, await printer.status());
    io.stdout(text);
    return ready ? 0 : 1;
  } finally {
    await printer.close();
  }
};

const commands: Record<string, (io: Io, args: string[]) => Promise<number>> = {
  render,
  lint: lintFiles,
  convert: convertFile,
  view,
  print,
  status,
};

/** Run the zplkit command with its arguments, and return its exit code */
const run = async (args: string[], io: Io): Promise<number> => {
  const [name, ...rest] = args;
  if (!name || name === "-h" || name === "--help" || name === "help") {
    io.stdout(usage);
    return 0;
  }
  if (name === "-v" || name === "--version") {
    const { version } = createRequire(import.meta.url)("../package.json");
    io.stdout(version);
    return 0;
  }
  const command = commands[name];
  if (!command) {
    io.stderr(`Unknown command '${name}'\n\n${usage}`);
    return 2;
  }
  try {
    return await command(io, rest);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(message);
    return error instanceof UsageError ||
      (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")
      ? 2
      : 1;
  }
};

/** The io of a real terminal: files, the browser and network printers */
const systemIo = async (): Promise<Io> => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { execFile } = await import("node:child_process");
  const { connectNetworkPrinter } = await import("@zplkit/print/network");
  return {
    stdout: (text) => process.stdout.write(`${text}\n`),
    stderr: (text) => process.stderr.write(`${text}\n`),
    readFile: (path) => readFile(path, "utf8"),
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString("utf8");
    },
    writeFile: (path, data) => writeFile(path, data),
    open: (url) =>
      new Promise((resolve) => {
        const [command, ...args] =
          process.platform === "darwin"
            ? ["open", url]
            : process.platform === "win32"
            ? ["cmd", "/c", "start", "", url]
            : ["xdg-open", url];
        // Opening is a convenience: the link is printed either way
        execFile(command, args, () => resolve());
      }),
    connect: async (host, port) => {
      const printer = await connectNetworkPrinter(host, { port }).catch(
        (error: { code?: string; message: string }) => {
          const reason =
            error.code === "ECONNREFUSED"
              ? `nothing answered on port ${port}`
              : error.code === "ENOTFOUND"
              ? "there's no such host"
              : error.code === "EHOSTUNREACH"
              ? "it isn't on this network"
              : error.message;
          throw new Error(`Can't reach ${host}: ${reason}`);
        }
      );
      return {
        send: (zpl) => printer.send(zpl),
        status: () => printer.status(),
        close: () => printer.close(),
      };
    },
  };
};

/** Run zplkit in a terminal */
const main = async (args: string[]): Promise<number> =>
  run(args, await systemIo());

export { run, main };
export type { Io, PrinterLike };
