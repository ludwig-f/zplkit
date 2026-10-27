/**
 * Turn ZPL into zplkit code: JSX or Label method calls. Each field becomes
 * the element that builds it, checked by building it and comparing with
 * the original; anything else becomes field() or raw(), so the code always
 * makes the same label.
 */
import Label from "./Label.js";
import { parse } from "./parse.js";
import { serialize, serializeCommand } from "./serialize.js";
import type { Command } from "./ast.js";
import type { Length } from "./units.js";

type ConvertOptions = {
  /**
   * The code to write: JSX elements or Label method calls
   * @defaultValue "jsx"
   */
  style?: "jsx" | "builder";
  /**
   * Dots per millimeter of the printer the ZPL is for
   * @defaultValue 8
   */
  dpmm?: 6 | 8 | 12 | 24;
  /**
   * Lengths in millimeters where they convert back to exactly the same
   * dots, or always in dots
   * @defaultValue "mm"
   */
  units?: "mm" | "dots";
  /**
   * The size of labels that don't set ^PW and ^LL, in millimeters
   * @defaultValue 101.6 by 152.4 (4 by 6 inches)
   */
  labelSize?: { width: number; height: number };
};

/** One step of building a label: a method call, a comment, or raw ZPL */
type Step =
  | { kind: "call"; method: string; options: Record<string, unknown> }
  | { kind: "orientation"; orientation: string }
  | { kind: "raw"; zpl: string }
  | { kind: "comment"; text: string };

type Part =
  | { kind: "setup"; steps: Step[] }
  | { kind: "label"; options: Record<string, unknown>; steps: Step[] };

/** Builder methods and the JSX elements that match them */
const elements: Record<string, string> = {
  text: "Text",
  box: "Box",
  graphic: "Graphic",
  storedGraphic: "StoredGraphic",
  field: "Field",
  setDefaultFont: "DefaultFont",
  code11: "Code11",
  code39: "Code39",
  code93: "Code93",
  code128: "Code128",
  codabar: "Codabar",
  ean13: "EAN13",
  ean8: "EAN8",
  upcA: "UpcA",
  upcE: "UpcE",
  upcEanExtension: "UpcEanExtension",
  interleaved2of5: "Interleaved2of5",
  industrial2of5: "Industrial2of5",
  standard2of5: "Standard2of5",
  logmars: "LOGMARS",
  msi: "MSI",
  plessey: "Plessey",
  postnet: "Postnet",
  planet: "Planet",
  intelligentMail: "IntelligentMail",
  gs1DataBar: "GS1DataBar",
  pdf417: "PDF417",
  microPdf417: "MicroPDF417",
  qrCode: "QrCode",
  dataMatrix: "DataMatrix",
  aztec: "Aztec",
  maxiCode: "MaxiCode",
};

const orientationNames: Record<string, string> = {
  N: "Normal",
  R: "Rotated90Degrees",
  I: "Inverted180Degrees",
  B: "BottomUp270Degrees",
};

const dataBarTypes = [
  "omnidirectional",
  "truncated",
  "stacked",
  "stackedOmnidirectional",
  "limited",
  "expanded",
];

/** Leave out undefined values, which the builder leaves out too */
const defined = (object: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

/** Field data with ^FH escapes decoded, as the printer reads it */
const decodeData = (data: string, indicator: string | undefined) => {
  if (indicator === undefined) return data;
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let i = 0; i < data.length; i++) {
    const hex = data.slice(i + 1, i + 3);
    if (data[i] === indicator && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...encoder.encode(data[i]));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};

/** Values printers use for parameters left out, where the builder writes them */
const defaults: Record<string, Record<string, unknown>> = {
  GraphicBox: { color: "B", rounding: 0 },
  RecallGraphic: { magnificationX: 1, magnificationY: 1 },
  QrCode: { orientation: "N", model: 2 },
};

/**
 * Commands in a form that compares by what they print: written and read
 * again, with ^FH escapes decoded and spans left out
 */
const normalize = (commands: readonly Command[]) => {
  const reread = parse(serialize([...commands])).commands;
  const out: unknown[] = [];
  let indicator: string | undefined;
  for (const command of reread) {
    const { span: _span, ...rest } = command as Command & { span?: unknown };
    void _span;
    if (rest.type === "FieldHexIndicator") {
      indicator = rest.indicator ?? "_";
      continue;
    }
    if (rest.type === "FieldData") {
      out.push({ ...rest, data: decodeData(rest.data, indicator) });
      indicator = undefined;
      continue;
    }
    out.push({ ...defaults[rest.type], ...rest });
  }
  return JSON.stringify(out);
};

/** Each barcode's builder method and options, from its command */
const barcodeCall = (
  node: Command,
  length: (dots: number | undefined) => Length | undefined
): { method: string; options: Record<string, unknown> } | undefined => {
  const n = node as Record<string, unknown> & { type: string };
  const linear = {
    orientation: n.orientation,
    height: length(n.height as number | undefined),
    printHri: n.interpretationLine,
    printHriAbove: n.interpretationLineAbove,
  };
  switch (n.type) {
    case "Code128":
      return {
        method: "code128",
        options: { ...linear, useUcc: n.uccCheckDigit, mode: n.mode },
      };
    case "Code39":
      return {
        method: "code39",
        options: { ...linear, checkDigit: n.checkDigit },
      };
    case "Interleaved2of5":
      return {
        method: "interleaved2of5",
        options: { ...linear, checkDigit: n.checkDigit },
      };
    case "Code11":
      return {
        method: "code11",
        options: { ...linear, checkDigits: n.checkDigits },
      };
    case "Ean13":
      return { method: "ean13", options: linear };
    case "Ean8":
      return { method: "ean8", options: linear };
    case "UpcEanExtension":
      return { method: "upcEanExtension", options: linear };
    case "Industrial2of5":
      return { method: "industrial2of5", options: linear };
    case "Standard2of5":
      return { method: "standard2of5", options: linear };
    case "UpcA":
    case "UpcE":
    case "Code93":
      return {
        method: { UpcA: "upcA", UpcE: "upcE", Code93: "code93" }[n.type],
        options: { ...linear, printCheckDigit: n.printCheckDigit },
      };
    case "Codabar":
      return {
        method: "codabar",
        options: { ...linear, start: n.start, stop: n.stop },
      };
    case "Logmars":
      return {
        method: "logmars",
        options: {
          orientation: n.orientation,
          height: length(n.height as number | undefined),
          printHriAbove: n.interpretationLineAbove,
        },
      };
    case "Msi":
      return {
        method: "msi",
        options: {
          ...linear,
          checkDigits: n.checkDigits,
          printCheckDigit: n.printCheckDigit,
        },
      };
    case "Plessey":
      return {
        method: "plessey",
        options: { ...linear, printCheckDigit: n.printCheckDigit },
      };
    case "PostalCode":
      if (n.postalType === 3) {
        return {
          method: "intelligentMail",
          options: {
            orientation: n.orientation,
            height: length(n.height as number | undefined),
          },
        };
      }
      return n.postalType ? undefined : { method: "postnet", options: linear };
    case "Planet":
      return { method: "planet", options: linear };
    case "Gs1DataBar": {
      const symbology = (n.symbology as number | undefined) ?? undefined;
      if (symbology !== undefined && symbology > 6) return undefined;
      return {
        method: "gs1DataBar",
        options: {
          orientation: n.orientation,
          type: symbology ? dataBarTypes[symbology - 1] : undefined,
          moduleSize: length(n.magnification as number | undefined),
          separatorHeight: n.separatorHeight,
          segments: n.segments,
        },
      };
    }
    case "Pdf417":
      return {
        method: "pdf417",
        options: {
          orientation: n.orientation,
          rowHeight: length(n.rowHeight as number | undefined),
          securityLevel: n.securityLevel,
          columns: n.columns,
          rows: n.rows,
          truncate: n.truncate,
        },
      };
    case "MicroPdf417":
      return {
        method: "microPdf417",
        options: {
          orientation: n.orientation,
          rowHeight: length(n.rowHeight as number | undefined),
          mode: n.mode,
        },
      };
    case "Aztec":
      return {
        method: "aztec",
        options: {
          orientation: n.orientation,
          moduleSize: length(n.magnification as number | undefined),
          errorControl: n.errorControl,
        },
      };
    case "MaxiCode":
      return { method: "maxiCode", options: { mode: n.mode } };
    case "DataMatrix":
      return n.height === undefined
        ? undefined
        : {
            method: "dataMatrix",
            options: {
              orientation: n.orientation,
              moduleSize: length(n.height as number),
              quality: n.quality,
              columns: n.columns,
              rows: n.rows,
              formatId: n.formatId,
              escapeCharacter: n.escapeCharacter,
            },
          };
    case "QrCode":
      return {
        method: "qrCode",
        options: { moduleSize: length(n.magnification as number | undefined) },
      };
    default:
      return undefined;
  }
};

/** Converts ZPL to steps, checking each element against the original */
const plan = (zpl: string, options: Required<ConvertOptions>): Part[] => {
  const { dpmm } = options;
  const length = (dots: number | undefined): Length | undefined => {
    if (dots === undefined) return undefined;
    // Millimeters only when they're exact, like 5 or 12.5, not 0.875
    if (options.units === "mm") {
      const value = Math.round((dots / dpmm) * 100) / 100;
      if (Math.abs(value * dpmm - dots) < 1e-9) return { mm: value };
    }
    return { dots };
  };

  /** Commands a builder call makes, after the label's own header */
  const built = (step: Step): Command[] | undefined => {
    const label = new Label({
      width: { dots: 10 },
      height: { dots: 10 },
      dpmm,
    });
    const start = label.commands.length;
    try {
      if (step.kind === "call") {
        const method = (
          label as unknown as Record<string, (o: unknown) => void>
        )[step.method];
        method.call(label, step.options);
      } else if (step.kind === "orientation") {
        label.setFieldOrientation(step.orientation as never);
      } else if (step.kind === "raw") {
        label.raw(step.zpl);
      }
    } catch {
      return undefined;
    }
    return label.commands.slice(start);
  };

  const same = (step: Step, original: Command[]) => {
    const commands = built(step);
    return (
      commands !== undefined && normalize(commands) === normalize(original)
    );
  };

  /** A field as the element that builds it, field(), or raw ZPL */
  const convertField = (field: Command[]): Step => {
    const raw: Step = { kind: "raw", zpl: serialize(field) };
    const [origin] = field;
    if (origin.type !== "FieldOrigin" || origin.justification !== undefined) {
      return raw;
    }
    const position = { x: length(origin.x), y: length(origin.y) };
    let indicator: string | undefined;
    const middle: Command[] = [];
    const data: string[] = [];
    for (const command of field.slice(1, -1)) {
      if (command.type === "FieldHexIndicator") {
        indicator = command.indicator ?? "_";
      } else if (command.type === "FieldData" && !command.variable) {
        data.push(decodeData(command.data, indicator));
        indicator = undefined;
      } else {
        middle.push(command);
      }
    }

    const candidates: Step[] = [];
    const call = (method: string, callOptions: Record<string, unknown>) =>
      candidates.push({ kind: "call", method, options: defined(callOptions) });
    const [first] = middle;
    if (
      middle.length <= 1 &&
      data.length === 1 &&
      (!first || first.type === "Font")
    ) {
      call("text", {
        position,
        text: data[0],
        font: first
          ? defined({
              name: first.font,
              height: length(first.height),
              width: length(first.width),
              orientation: first.orientation,
            })
          : undefined,
      });
    }
    if (
      middle.length === 1 &&
      data.length === 1 &&
      first.type === "FontByName"
    ) {
      const device = first.device ? `${first.device}:` : "";
      call("text", {
        position,
        text: data[0],
        font: defined({
          file: `${device}${first.name}.${first.extension}`,
          height: length(first.height),
          width: length(first.width),
          orientation: first.orientation,
        }),
      });
    }
    if (
      middle.length === 1 &&
      data.length === 0 &&
      first.type === "GraphicBox"
    ) {
      call("box", {
        position,
        width: length(first.width),
        height: length(first.height),
        thickness: length(first.thickness),
        color: first.color,
        rounding: first.rounding,
      });
    }
    if (
      middle.length === 1 &&
      data.length === 0 &&
      first.type === "GraphicField"
    ) {
      call("graphic", {
        position,
        graphic: {
          totalBytes: first.byteCount,
          bytesPerRow: first.bytesPerRow,
          data: first.data,
        },
      });
    }
    if (
      middle.length === 1 &&
      data.length === 0 &&
      first.type === "RecallGraphic"
    ) {
      call("storedGraphic", {
        position,
        name: first.name,
        device: first.device,
        magnification:
          first.magnificationX === undefined &&
          first.magnificationY === undefined
            ? undefined
            : { x: first.magnificationX ?? 1, y: first.magnificationY ?? 1 },
      });
    }
    if (middle.length === 1 && data.length === 1) {
      const barcode = barcodeCall(first, length);
      if (barcode?.method === "qrCode") {
        // The builder adds the error correction level and A for automatic
        const match = /^([HQML])A,(.*)$/s.exec(data[0]);
        if (match) {
          call("qrCode", {
            ...barcode.options,
            position,
            data: match[2],
            errorCorrection: match[1],
          });
        }
      } else if (barcode) {
        call(barcode.method, { ...barcode.options, position, data: data[0] });
      }
    }
    // Any other command, as written
    const command = serialize(middle);
    if (/^[\^~]/.test(command) && data.length <= 1) {
      call("field", { position, command, data: data[0] });
    }

    return candidates.find((step) => same(step, field)) ?? raw;
  };

  /** A command outside fields as a builder call, or raw ZPL */
  const convertCommand = (command: Command): Step => {
    const raw: Step = { kind: "raw", zpl: serializeCommand(command) };
    if (command.type === "Comment")
      return { kind: "comment", text: command.text.trim() };
    let step: Step | undefined;
    if (command.type === "DefaultFont") {
      step = {
        kind: "call",
        method: "setDefaultFont",
        options: defined({
          font: command.font,
          height: length(command.height),
          width: length(command.width),
        }),
      };
    } else if (command.type === "FieldOrientation") {
      step = { kind: "orientation", orientation: command.orientation };
    }
    return step && same(step, [command]) ? step : raw;
  };

  /** A label's options from the settings before its first field */
  const labelOptions = (commands: Command[]) => {
    const values: Record<string, unknown> = {};
    const used = new Set<number>();
    for (const [index, command] of commands.entries()) {
      if (command.type === "FieldOrigin" || command.type === "FieldTypeset")
        break;
      const take = (key: string, value: unknown) => {
        if (key in values) return;
        values[key] = value;
        used.add(index);
      };
      if (command.type === "PrintWidth") take("width", length(command.width));
      if (command.type === "LabelLength")
        take("height", length(command.length));
      if (command.type === "ChangeEncoding")
        take("characterSet", command.charset);
      if (command.type === "LabelHome" && !("home" in values)) {
        if (command.x || command.y) {
          take("home", { x: length(command.x), y: length(command.y) });
        } else {
          used.add(index);
        }
      }
      if (command.type === "LabelReverse" && !command.reverse) used.add(index);
      if (
        command.type === "PrintQuantity" &&
        command.quantity !== undefined &&
        Object.keys(command).filter((key) => key !== "span").length === 2
      ) {
        take("copies", command.quantity);
      }
      if (
        command.type === "PrintRate" &&
        typeof command.speed === "number" &&
        command.slew === undefined &&
        command.backfeed === undefined
      ) {
        take("speed", command.speed);
      }
      if (command.type === "MediaDarkness" && command.darkness !== undefined) {
        take("darkness", command.darkness);
      }
    }
    const size = options.labelSize;
    return {
      options: {
        width: values.width ?? { mm: size.width },
        height: values.height ?? { mm: size.height },
        dpmm,
        ...(values.characterSet !== undefined && values.characterSet !== 28
          ? { characterSet: values.characterSet }
          : {}),
        ...defined({
          home: values.home,
          copies: values.copies,
          speed: values.speed,
          darkness: values.darkness,
        }),
      },
      rest: commands.filter((_, index) => !used.has(index)),
    };
  };

  const commands = parse(zpl).commands;
  const parts: Part[] = [];
  let setup: Step[] = [];
  let label: Command[] | undefined;
  for (const command of commands) {
    if (command.type === "StartFormat") {
      if (setup.length) parts.push({ kind: "setup", steps: setup });
      setup = [];
      label = [];
    } else if (command.type === "EndFormat" && label) {
      const { options: labelOptionsValue, rest } = labelOptions(label);
      const steps: Step[] = [];
      for (let i = 0; i < rest.length; i++) {
        const command = rest[i];
        if (command.type === "FieldOrigin" || command.type === "FieldTypeset") {
          const end = rest.findIndex(
            (c, j) => j > i && c.type === "FieldSeparator"
          );
          if (end < 0) {
            steps.push({ kind: "raw", zpl: serialize(rest.slice(i)) });
            break;
          }
          steps.push(convertField(rest.slice(i, end + 1)));
          i = end;
        } else {
          steps.push(convertCommand(command));
        }
      }
      // Without ^CI the printer used its own character set, while zplkit
      // labels use UTF-8, which only matters for letters outside ASCII
      const nonAscii = label.some(
        (c) =>
          c.type === "FieldData" &&
          [...c.data].some((char) => char.charCodeAt(0) > 0x7f)
      );
      if (nonAscii && !label.some((c) => c.type === "ChangeEncoding")) {
        steps.unshift({
          kind: "comment",
          text: "This label didn't set a character set (^CI), so the printer used its own. zplkit labels use UTF-8 (^CI28): check that letters outside English print right.",
        });
      }
      parts.push({ kind: "label", options: labelOptionsValue, steps });
      label = undefined;
    } else if (label) {
      label.push(command);
    } else {
      setup.push(
        command.type === "SetDarkness"
          ? {
              kind: "call",
              method: "setDarkness",
              options: { darkness: command.darkness },
            }
          : { kind: "raw", zpl: serializeCommand(command) }
      );
    }
  }
  if (label) {
    parts.push({
      kind: "setup",
      steps: [{ kind: "raw", zpl: serialize(label) }],
    });
  }
  if (setup.length) parts.push({ kind: "setup", steps: setup });
  return parts;
};

/** Code for a value: lengths as mm() or dots(), orientations by name */
const code = (value: unknown, key = "", indent = ""): string => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("mm" in value) return `mm(${(value as { mm: number }).mm})`;
    if ("dots" in value) return `dots(${(value as { dots: number }).dots})`;
    const entries = Object.entries(value);
    const inner = entries.map(([k, v]) => `${k}: ${code(v, k, indent + "  ")}`);
    const line = `{ ${inner.join(", ")} }`;
    if (line.length + indent.length <= 72) return line;
    return `{\n${inner
      .map((part) => `${indent}  ${part},`)
      .join("\n")}\n${indent}}`;
  }
  if (key === "orientation" && typeof value === "string") {
    return `Orientation.${orientationNames[value] ?? value}`;
  }
  return JSON.stringify(value);
};

/** A printer setup step as a method call */
const setupCall = (step: Step) =>
  step.kind === "call"
    ? step.method === "setDarkness"
      ? `  .setDarkness(${step.options.darkness})`
      : `  .${step.method}(${code(step.options)})`
    : step.kind === "raw"
    ? `  .raw(${JSON.stringify(step.zpl)})`
    : step.kind === "comment"
    ? `  // ${step.text}`
    : "";

/** Names a code snippet uses, for its imports */
const usedNames = (text: string, names: string[]) =>
  names.filter((name) => new RegExp(`\\b${name}\\b`).test(text));

const writeBuilder = (parts: Part[]) => {
  const blocks: string[] = [];
  const names: string[] = [];
  let labels = 0;
  let setups = 0;
  for (const part of parts) {
    const steps = part.steps.map((step) => {
      switch (step.kind) {
        case "call":
          return `  .${step.method}(${code(step.options, "", "  ")})`;
        case "orientation":
          return `  .setFieldOrientation(${code(
            step.orientation,
            "orientation"
          )})`;
        case "raw":
          return `  .raw(${JSON.stringify(step.zpl)})`;
        case "comment":
          return `  // ${step.text}`;
      }
    });
    if (part.kind === "label") {
      const name = labels++ ? `label${labels}` : "label";
      names.push(name);
      blocks.push(
        `const ${name} = new Label(${code(part.options)})${
          steps.length ? "\n" : ""
        }${steps.join("\n")};`
      );
    } else {
      const name = setups++ ? `setup${setups}` : "setup";
      names.push(name);
      blocks.push(
        `const ${name} = new PrinterSetup()\n${part.steps
          .map(setupCall)
          .join("\n")};`
      );
    }
  }
  if (names.length > 1)
    blocks.push(`const job = new PrintJob(${names.join(", ")});`);
  const body = blocks.join("\n\n");
  const imports = usedNames(body, [
    "Label",
    "PrinterSetup",
    "PrintJob",
    "Orientation",
    "dots",
    "mm",
  ]);
  return `import { ${imports.join(", ")} } from "@zplkit/core";\n\n${body}\n`;
};

/** Text as JSX children: plain where it's safe, a string expression otherwise */
const jsxText = (text: string) =>
  /^[^{}<>&\n\r]*$/.test(text) && text.trim() === text && text.length > 0
    ? text
    : `{${JSON.stringify(text)}}`;

const jsxProps = (props: Record<string, unknown>) =>
  Object.entries(props)
    .map(([key, value]) =>
      typeof value === "string" && key !== "orientation"
        ? `${key}=${JSON.stringify(value)}`
        : value === true
        ? key
        : `${key}={${code(value, key, "      ")}}`
    )
    .join(" ");

const writeJsx = (parts: Part[]) => {
  const blocks: string[] = [];
  const names: string[] = [];
  const elementsUsed = new Set<string>();
  let labels = 0;
  let setups = 0;
  for (const part of parts) {
    if (part.kind === "setup") {
      const name = setups++ ? `setup${setups}` : "setup";
      names.push(name);
      blocks.push(
        `const ${name} = new PrinterSetup()\n${part.steps
          .map(setupCall)
          .join("\n")};`
      );
      continue;
    }
    const children = part.steps.map((step) => {
      if (step.kind === "comment")
        return `    {/* ${step.text.replace(/\*\//g, "* /")} */}`;
      if (step.kind === "raw") {
        elementsUsed.add("Raw");
        return `    <Raw zpl=${JSON.stringify(step.zpl)} />`;
      }
      if (step.kind === "orientation") {
        elementsUsed.add("FieldOrientation");
        return `    <FieldOrientation orientation={${code(
          step.orientation,
          "orientation"
        )}} />`;
      }
      const element = elements[step.method];
      elementsUsed.add(element);
      const { position, text, data, font, ...rest } = step.options as Record<
        string,
        unknown
      > & {
        position?: { x: unknown; y: unknown };
        font?: Record<string, unknown> | string;
      };
      const props: Record<string, unknown> = {};
      if (position) Object.assign(props, { x: position.x, y: position.y });
      // A text field's font becomes props of its own; DefaultFont's is a name
      if (typeof font === "object") {
        const { name, ...fontRest } = font;
        if (name !== undefined) props.font = name;
        Object.assign(props, fontRest);
      } else if (font !== undefined) {
        props.font = font;
      }
      Object.assign(props, rest);
      const content = (text ?? data) as string | undefined;
      const open = `<${element}${
        Object.keys(props).length ? " " + jsxProps(props) : ""
      }`;
      return content === undefined
        ? `    ${open} />`
        : `    ${open}>${jsxText(content)}</${element}>`;
    });
    const name = labels++ ? `label${labels}` : "label";
    names.push(name);
    const labelProps = jsxProps(part.options);
    blocks.push(
      `const ${name} = build(\n  <Label ${labelProps}>\n${children.join(
        "\n"
      )}\n  </Label>\n);`
    );
  }
  if (names.length > 1)
    blocks.push(`const job = new PrintJob(${names.join(", ")});`);
  const body = blocks.join("\n\n");
  const jsxImports = [
    "Label",
    ...[...elementsUsed].sort(),
    "build",
    ...usedNames(body, ["Orientation", "dots", "mm"]),
  ];
  const coreImports = usedNames(body, ["PrinterSetup", "PrintJob"]);
  return [
    `import { ${jsxImports.join(", ")} } from "@zplkit/core/jsx";`,
    ...(coreImports.length
      ? [`import { ${coreImports.join(", ")} } from "@zplkit/core";`]
      : []),
    "",
    body,
    "",
  ].join("\n");
};

/**
 * Turn ZPL into zplkit code that makes the same labels.
 *
 * ```ts
 * convert("^XA^FO50,50^A0N,40^FDHello^FS^XZ");
 * // const label = build(<Label …><Text x={mm(6.25)} y={mm(6.25)} …>Hello</Text></Label>);
 * ```
 */
const convert = (zpl: string, options: ConvertOptions = {}): string => {
  const parts = plan(zpl, {
    style: options.style ?? "jsx",
    dpmm: options.dpmm ?? 8,
    units: options.units ?? "mm",
    labelSize: options.labelSize ?? { width: 101.6, height: 152.4 },
  });
  return options.style === "builder" ? writeBuilder(parts) : writeJsx(parts);
};

export { convert };
export type { ConvertOptions };
