/**
 * zplkit's MCP server: tools for AI assistants to render ZPL and see the
 * result, lint it, convert it to zplkit code, look commands up and link to
 * the viewer. Printing is a tool only when it's allowed.
 */
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { format, lint, parse, serializeCommand } from "@zplkit/core";
import { convert } from "@zplkit/core/convert";
import { countLabels, encodePng, layout, renderLabels } from "@zplkit/render";
import { reference } from "./reference.js";
import type { Command } from "@zplkit/core";

/** A printer, as far as print_zpl needs one */
type PrinterLike = {
  send(zpl: string): Promise<void>;
  status(): Promise<unknown>;
  close(): Promise<void>;
};

type ServerOptions = {
  /**
   * Offer print_zpl, which sends labels to network printers
   * @defaultValue false
   */
  allowPrint?: boolean;
  /** How print_zpl connects to a printer; a network printer if not given */
  connect?: (host: string, port: number) => Promise<PrinterLike>;
};

const SITE = "https://zplkit.fingal.dev";

/** Labels render_zpl returns unless asked for more */
const DEFAULT_LABELS = 3;

const dpmmByDpi = { 152: 6, 203: 8, 300: 12, 600: 24 } as const;

type ToolResult = {
  content: (
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  )[];
  isError?: boolean;
};

const text = (value: string, isError = false): ToolResult => ({
  content: [{ type: "text", text: value }],
  ...(isError && { isError }),
});

/** A tool that answers with an error instead of throwing */
const safely =
  <A>(handler: (args: A) => Promise<ToolResult> | ToolResult) =>
  async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (error) {
      return text(error instanceof Error ? error.message : String(error), true);
    }
  };

/** A length like 4in, 101.6mm or 812 (dots), in dots */
const lengthInDots = (
  value: string,
  name: string,
  dpmm: number,
  dpi: number
) => {
  const match = /^(\d+(?:\.\d+)?)\s*(in|mm|dots)?$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `${name} must be a length like 4in, 101.6mm or 812, got ${value}`
    );
  }
  const number = Number(match[1]);
  if (match[2] === "in") return Math.round(number * dpi);
  if (match[2] === "mm") return Math.round(number * dpmm);
  return Math.round(number);
};

const lastOf = <T extends Command["type"]>(
  commands: readonly Command[],
  type: T
) =>
  commands
    .filter((c): c is Extract<Command, { type: T }> => c.type === type)
    .pop();

/** What every field has, which isn't what's missing when one isn't drawn */
const fieldParts = new Set<string>([
  "FieldOrigin",
  "FieldTypeset",
  "FieldData",
  "FieldHexIndicator",
  "FieldSeparator",
]);

/** A command's code, like ^B4, for saying what isn't drawn */
const codeOf = (command: Command) =>
  command.type === "Raw"
    ? command.zpl.slice(0, 3)
    : serializeCommand(command).slice(0, 3);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const zplInput = z
  .string()
  .describe("The ZPL, from ^XA to ^XZ; several labels are fine");
const dpiInput = z
  .union([z.literal(152), z.literal(203), z.literal(300), z.literal(600)])
  .optional()
  .describe("Printer resolution in dots per inch; 203 if not given");
const lengthInput = (side: string) =>
  z
    .string()
    .optional()
    .describe(
      `Label ${side}, like 4in, 101.6mm or 812 (dots); from ^PW or ^LL, else 4 × 6 in`
    );

/** Line and column, from 1, of an offset in the text */
const position = (source: string, offset: number) => {
  const before = source.slice(0, offset).split("\n");
  return `${before.length}:${before[before.length - 1].length + 1}`;
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

const notReady = (host: string, status: unknown) => {
  const s = status as Record<string, unknown>;
  if (s.noReply) {
    return `${host} didn't answer: it may be out of labels or ribbon, open, or paused`;
  }
  if (s.ready) return undefined;
  const reasons = problems.filter(([key]) => s[key]).map(([, why]) => why);
  return `${host} isn't ready: ${
    reasons.join(", ") || "it says it can't print"
  }`;
};

const networkPrinter = async (host: string, port: number) => {
  const { connectNetworkPrinter } = await import("@zplkit/print/network");
  const printer = await connectNetworkPrinter(host, { port });
  return {
    send: (zpl: string) => printer.send(zpl),
    status: () => printer.status(),
    close: () => printer.close(),
  };
};

/** zplkit's MCP server, ready to connect to a transport */
const createServer = (options: ServerOptions = {}): McpServer => {
  const { version } = createRequire(import.meta.url)("../package.json");
  const server = new McpServer({ name: "zplkit", version });

  server.registerTool(
    "render_zpl",
    {
      title: "Render ZPL",
      description:
        "Render ZPL labels to PNG images, drawn the way a Zebra printer prints them, to check what a label looks like. Says the size, how many labels there are, and anything the renderer doesn't draw yet.",
      inputSchema: {
        zpl: zplInput,
        dpi: dpiInput,
        width: lengthInput("width"),
        height: lengthInput("height"),
        labels: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe(
            `Most labels to return; ${DEFAULT_LABELS} if not given, as serial numbers can print hundreds`
          ),
      },
      annotations: { readOnlyHint: true },
    },
    safely(async ({ zpl, dpi = 203, width, height, labels }) => {
      const dpmm = dpmmByDpi[dpi];
      const { commands, diagnostics: unread } = parse(zpl);
      const widthDots = width
        ? lengthInDots(width, "width", dpmm, dpi)
        : lastOf(commands, "PrintWidth")?.width ?? 4 * dpi;
      const heightDots = height
        ? lengthInDots(height, "height", dpmm, dpi)
        : lastOf(commands, "LabelLength")?.length ?? 6 * dpi;
      const limit = labels ?? DEFAULT_LABELS;
      const rasters = renderLabels(commands, {
        widthMm: widthDots / dpmm,
        heightMm: heightDots / dpmm,
        dpmm,
        limit,
      });
      if (!rasters.length) {
        return text("No labels: labels start with ^XA and end with ^XZ.", true);
      }

      const total = countLabels(zpl).labels;
      const lines = [
        total > rasters.length
          ? `Showing the first ${rasters.length} of ${total} different labels, ${widthDots} × ${heightDots} dots at ${dpi} dpi.`
          : `${plural(
              rasters.length,
              "label"
            )}, ${widthDots} × ${heightDots} dots at ${dpi} dpi.`,
      ];
      for (const [index, raster] of rasters.entries()) {
        if (raster.copies > 1) {
          lines.push(`Label ${index + 1} prints ${raster.copies} times.`);
        }
      }
      const undrawn = [
        ...new Set(
          layout(commands, { dpmm, limit }).flatMap((label) =>
            label.unsupported
              .map((index) => commands[index])
              .filter((command) => !fieldParts.has(command.type))
              .map(codeOf)
          )
        ),
      ];
      if (undrawn.length) {
        lines.push(
          `${undrawn.join(", ")} ${
            undrawn.length === 1 ? "isn't" : "aren't"
          } drawn yet, so a printer may print more than this shows.`
        );
      }
      const diagnostics = [...unread, ...lint(commands)];
      if (diagnostics.length) {
        const errors = diagnostics.filter((d) => d.severity === "error").length;
        const warnings = diagnostics.length - errors;
        const found = [
          errors && plural(errors, "error"),
          warnings && plural(warnings, "warning"),
        ].filter(Boolean);
        lines.push(`lint_zpl found ${found.join(" and ")}.`);
      }

      const images = await Promise.all(
        rasters.map(async (raster) => ({
          type: "image" as const,
          data: Buffer.from(await encodePng(raster)).toString("base64"),
          mimeType: "image/png",
        }))
      );
      return {
        content: [{ type: "text", text: lines.join(" ") }, ...images],
      };
    })
  );

  server.registerTool(
    "lint_zpl",
    {
      title: "Lint ZPL",
      description:
        "Find problems in ZPL that a printer won't report, like fields that aren't closed, values out of range or settings left on the printer. Each problem has its line and column.",
      inputSchema: { zpl: zplInput },
      annotations: { readOnlyHint: true },
    },
    safely(({ zpl }) => {
      const { commands, diagnostics: unread } = parse(zpl);
      // What the parser couldn't read, and what lint() found, in order
      const diagnostics = [...unread, ...lint(commands)].sort(
        (a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0)
      );
      if (!diagnostics.length) return text("No problems found.");
      return text(
        diagnostics
          .map(
            ({ rule, severity, message, span }) =>
              `${
                span ? position(zpl, span.start) : "1:1"
              } ${severity} ${rule}: ${message}`
          )
          .join("\n")
      );
    })
  );

  server.registerTool(
    "convert_zpl",
    {
      title: "Convert ZPL to zplkit code",
      description:
        "Turn ZPL into TypeScript that builds the same label with @zplkit/core, as JSX or builder calls.",
      inputSchema: {
        zpl: zplInput,
        style: z
          .enum(["jsx", "builder"])
          .optional()
          .describe("JSX elements or Label method calls; jsx if not given"),
        dpi: dpiInput,
      },
      annotations: { readOnlyHint: true },
    },
    safely(({ zpl, style, dpi = 203 }) =>
      text(convert(zpl, { style, dpmm: dpmmByDpi[dpi] }))
    )
  );

  server.registerTool(
    "lookup_command",
    {
      title: "Look up a ZPL command",
      description:
        "What a ZPL command does: its format, parameters and defaults, an example, and how well zplkit supports it.",
      inputSchema: {
        command: z.string().describe("The command, like ^FO, ~DG or FO"),
      },
      annotations: { readOnlyHint: true },
    },
    safely(({ command }) => {
      const wanted = command.trim().toUpperCase();
      const found = /^[\^~]/.test(wanted)
        ? reference.find((c) => c.code.toUpperCase() === wanted)
        : reference.find((c) => c.code.slice(1).toUpperCase() === wanted);
      if (!found) {
        const letter = wanted.replace(/^[\^~]/, "")[0] ?? "";
        const close = reference
          .filter((c) => c.code.slice(1).startsWith(letter))
          .map((c) => `${c.code} ${c.name}`);
        return text(
          `There's no ${
            wanted.startsWith("^") || wanted.startsWith("~")
              ? wanted
              : `^${wanted}`
          } command.${
            close.length
              ? ` Commands starting with ${letter}: ${close.join(", ")}.`
              : ""
          }`,
          true
        );
      }
      const support = {
        yes: "Supported by zplkit",
        partial: "Partly supported by zplkit",
        no: "Not supported by zplkit yet: parse() keeps it as written",
      }[found.support];
      const slug = `${
        found.code.startsWith("~") ? "tilde-" : ""
      }${found.code.slice(1)}`;
      const lines = [
        `${found.code} ${found.name}`,
        found.summary ?? "",
        found.syntax ? `Format: ${found.syntax}` : "",
        ...(found.params ?? []).map(
          (p) =>
            `- ${p.name}: ${p.description}${p.values ? ` (${p.values})` : ""}${
              p.default ? `, default ${p.default}` : ""
            }`
        ),
        found.example ? `Example:\n${found.example}` : "",
        `${support}${found.note ? `. ${found.note}` : ""}.`,
        `${SITE}/docs/commands/${slug}`,
      ];
      return text(lines.filter(Boolean).join("\n"));
    })
  );

  server.registerTool(
    "viewer_link",
    {
      title: "Link to the ZPL viewer",
      description:
        "A link that opens ZPL in the zplkit web viewer, where people can see and edit it, with one field or setting per line. The ZPL is in the link after #, so it isn't uploaded.",
      inputSchema: { zpl: zplInput, dpi: dpiInput },
      annotations: { readOnlyHint: true },
    },
    safely(({ zpl, dpi = 203 }) => {
      // Formatted, so it's easy to read and edit in the viewer
      const state = [format(zpl), null, null, dpmmByDpi[dpi], 0.4];
      const hash = deflateRawSync(JSON.stringify(state))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      return text(`${SITE}/viewer#${hash}`);
    })
  );

  if (options.allowPrint) {
    const connect = options.connect ?? networkPrinter;
    server.registerTool(
      "print_zpl",
      {
        title: "Print ZPL",
        description:
          "Send ZPL to a Zebra printer on the network, after checking that it's ready. This prints real labels.",
        inputSchema: {
          zpl: zplInput,
          printer: z
            .string()
            .describe(
              "The printer's address, like 192.168.1.50 or printer.local:6101 (port 9100 if not given)"
            ),
        },
        annotations: { destructiveHint: false, openWorldHint: true },
      },
      safely(async ({ zpl, printer: address }) => {
        const match = /^(.+?)(?::(\d+))?$/.exec(address.trim())!;
        const host = match[1];
        const printer = await connect(host, match[2] ? Number(match[2]) : 9100);
        try {
          const problem = notReady(host, await printer.status());
          if (problem) return text(`${problem}. Nothing was sent.`, true);
          await printer.send(zpl);
          return text(`Sent to ${host}`);
        } finally {
          await printer.close();
        }
      })
    );
  }

  return server;
};

export { createServer };
export type { ServerOptions, PrinterLike };
