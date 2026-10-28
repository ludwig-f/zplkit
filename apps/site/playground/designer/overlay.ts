import type { Command } from "@zplkit/core";
import type { DesignField, Rect } from "@zplkit/render/internal";
import type { Unit } from "../settings";
import { formatDots } from "../units";
import type { Handle } from "./drag";
import { fieldAtOffset, type Design } from "./fields";
import { moved, union } from "./geometry";
import { dotsPerUnit } from "./move";
import { resizeHandles } from "./resize";
import type { Selection } from "./selection";
import type { Guide } from "./snap";

/** What each kind of field is called on its tag */
const KINDS: Record<DesignField["kind"], string> = {
  text: "Text",
  box: "Box",
  circle: "Circle",
  ellipse: "Ellipse",
  diagonal: "Line",
  barcode: "Barcode",
  placeholder: "Barcode",
  symbol: "Symbol",
  bitmap: "Graphic",
};

/** Barcodes are called by their symbology */
const BARCODES: Partial<Record<Command["type"], string>> = {
  Code128: "Code 128",
  Code39: "Code 39",
  Code93: "Code 93",
  Code11: "Code 11",
  Codabar: "Codabar",
  QrCode: "QR code",
  DataMatrix: "Data Matrix",
  Pdf417: "PDF417",
  MicroPdf417: "MicroPDF417",
  Aztec: "Aztec",
  MaxiCode: "MaxiCode",
  Ean13: "EAN-13",
  Ean8: "EAN-8",
  UpcA: "UPC-A",
  UpcE: "UPC-E",
  Interleaved2of5: "Interleaved 2 of 5",
  Gs1DataBar: "GS1 DataBar",
};

/** The 1-based line a text offset is on */
const lineAt = (zpl: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < zpl.length; i++) {
    if (zpl.charCodeAt(i) === 10) line++;
  }
  return line;
};

/** The line a field's first command is on */
const lineOf = (design: Design, field: DesignField): number =>
  lineAt(design.zpl, design.commands[field.key]?.span?.start ?? 0);

/** What a field is called, like "Text" or "Code 128" */
const kindOf = (design: Design, field: DesignField): string => {
  if (field.kind === "barcode") {
    for (const index of field.commands) {
      const name = BARCODES[design.commands[index]?.type];
      if (name) return name;
    }
  }
  return KINDS[field.kind] ?? "Field";
};

/** The command that starts a barcode, like ^B4, as written in a field */
const barcodeCommand = (
  design: Design,
  field: DesignField
): string | undefined => {
  for (const index of field.commands) {
    const span = design.commands[index]?.span;
    if (!span) continue;
    const text = design.zpl.slice(span.start, span.end);
    if (/^[\^~]B[0-9A-Z]/i.test(text) && !/^[\^~]BY/i.test(text)) {
      return `^${text.slice(1, 3).toUpperCase()}`;
    }
  }
  return undefined;
};

/** A stored format's name, as ^DF and ^XF write it */
const formatName = (command: Command): string | undefined =>
  command.type === "DownloadFormat" || command.type === "RecallFormat"
    ? `${command.device}:${command.name}.${command.extension}`.toUpperCase()
    : undefined;

/**
 * How many different labels print a field, counting all of them and not
 * only those designed: each ^XA that has it or recalls the format it's in,
 * once for each serialized copy. `copies` when they all come from one ^XA.
 */
const sharing = (design: Design, key: number) => {
  const { commands } = design;
  // The commands of each ^XA to ^XZ, by index
  const parts: number[][] = [];
  let part: number[] | undefined;
  commands.forEach((command, index) => {
    if (command.type === "StartFormat") parts.push((part = []));
    part?.push(index);
    if (command.type === "EndFormat") part = undefined;
  });
  const formats = new Map<string, number[]>();
  for (const indices of parts) {
    const download = indices.find((i) => commands[i].type === "DownloadFormat");
    const name =
      download === undefined ? undefined : formatName(commands[download]);
    if (name) formats.set(name, indices);
  }

  let total = 0;
  let sources = 0;
  for (const own of parts) {
    if (own.some((i) => commands[i].type === "DownloadFormat")) continue;
    const recall = own.find((i) => commands[i].type === "RecallFormat");
    const recalled =
      recall === undefined
        ? []
        : formats.get(formatName(commands[recall]) ?? "") ?? [];
    const all = [...own, ...recalled];
    if (!all.includes(key)) continue;
    sources++;
    const serialized = all.some((i) =>
      ["SerialNumber", "SerializationField"].includes(commands[i].type)
    );
    const pq = [...recalled, ...own]
      .map((i) => commands[i])
      .filter((c) => c.type === "PrintQuantity")
      .pop();
    const quantity =
      pq?.type === "PrintQuantity"
        ? Math.max(1, Math.floor(pq.quantity ?? 1))
        : 1;
    const replicates =
      pq?.type === "PrintQuantity"
        ? Math.max(1, Math.floor(pq.replicates || 1))
        : 1;
    total += serialized ? Math.ceil(quantity / replicates) : 1;
  }

  const designed = design.labels.filter((label) =>
    label.fields.some((f) => f.key === key)
  );
  return {
    count: Math.max(total, designed.length),
    copies:
      sources <= 1 &&
      designed.every((label) => label.start === designed[0]?.start),
  };
};

/** The tag above a selected field: its kind and line, or the labels sharing it */
const tagOf = (design: Design, field: DesignField): string => {
  const shared = sharing(design, field.key);
  if (shared.count > 1) {
    return `Shared by ${shared.count} ${shared.copies ? "copies" : "labels"}`;
  }
  const kind = field.drawn
    ? kindOf(design, field)
    : barcodeCommand(design, field) ?? kindOf(design, field);
  return `${kind} · L${lineOf(design, field)}`;
};

/** The note on a field that isn't drawn, like "^BF · not drawn"; empty for drawn ones */
const captionOf = (design: Design, field: DesignField): string =>
  field.drawn
    ? ""
    : `${barcodeCommand(design, field) ?? kindOf(design, field)} · not drawn`;

/** How much room a caption or tag takes above a field's outline, in px */
const CAPTION_ROOM = 20;

/**
 * Where a not-drawn field's caption goes, never over the field: above its
 * outline like the tag, or below when the label's top leaves no room or a
 * selected field's tag is above. `top` and `labelTop` are in px.
 */
const captionSide = ({
  top,
  labelTop,
  selected,
}: {
  top: number;
  labelTop: number;
  selected: boolean;
}): "above" | "below" =>
  selected || top - CAPTION_ROOM < labelTop ? "below" : "above";

/** The keys of the fields with a problem, by where each problem starts */
const problemKeys = (
  design: Design,
  problems: readonly { from: number }[]
): Set<number> => {
  const keys = new Set<number>();
  for (const { from } of problems) {
    const field = fieldAtOffset(design, from);
    if (field) keys.add(field.key);
  }
  return keys;
};

const EIGHT: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CORNERS: Handle[] = ["nw", "ne", "sw", "se"];

/**
 * The handles a selected field gets: all eight for boxes, the corners for
 * what keeps its shape, and the two ends a barcode's height grows from
 */
const handlesFor = (design: Design, field: DesignField): Handle[] => {
  // Nothing to grab on a field with no size, like empty text
  if (!field.bounds.width || !field.bounds.height) return [];
  const handles = resizeHandles(design, field);
  if (handles === "none") return [];
  if (handles === "proportional") return CORNERS;
  const code128 = field.commands
    .map((index) => design.commands[index])
    .find((command) => command?.type === "Code128");
  if (code128?.type === "Code128") {
    const turned = code128.orientation === "R" || code128.orientation === "B";
    return turned ? ["w", "e"] : ["n", "s"];
  }
  return EIGHT;
};

/** What a snapping guide lines up with: the label's edge or center, or another field's */
const guideName = (
  guide: Guide,
  label: { width: number; height: number },
  others: readonly Rect[]
): string => {
  const size = guide.axis === "x" ? label.width : label.height;
  if (guide.at === 0 || guide.at === size) return "label edge";
  if (guide.at === size / 2) return "label center";
  const centered = others.some((rect) =>
    guide.axis === "x"
      ? rect.x + rect.width / 2 === guide.at
      : rect.y + rect.height / 2 === guide.at
  );
  return centered ? "field center" : "field edge";
};

/**
 * The position a move writes, like "^FO351,648", in the unit the viewer
 * shows: "43.9, 81.0 mm". Empty when the readout isn't a position.
 */
const positionIn = (
  design: Design,
  field: DesignField,
  readout: string,
  unit: Unit
): string => {
  const match = /^[\^~]F[OT](-?[\d.]*),?(-?[\d.]*)/i.exec(readout);
  if (!match) return "";
  const perUnit = dotsPerUnit(design)[field.key] ?? 1;
  const [x, y] = [match[1], match[2]].map(
    (value) => (Number(value) || 0) * perUnit
  );
  return `${formatDots(x, unit, design.dpmm)}, ${formatDots(
    y,
    unit,
    design.dpmm
  )} ${unit}`;
};

/**
 * The fields a drag moves, drawn from the label image: where each one's ink
 * is (`from`) and where it goes (`to`), in dots. A move shifts every
 * selected field on the label; a resize stretches the first to the step's
 * bounds. Fields with no ink have nothing to draw.
 */
const cropsFor = (
  design: Design,
  label: number,
  keys: readonly number[],
  kind: "move" | "resize" | "box",
  step: { dx: number; dy: number; bounds?: Rect }
): { from: Rect; to: Rect }[] => {
  if (kind === "box") return [];
  const fields = (design.labels[label]?.fields ?? []).filter(
    (f) => keys.includes(f.key) && f.bounds.width > 0 && f.bounds.height > 0
  );
  if (kind === "resize") {
    const [field] = fields;
    return field && step.bounds
      ? [{ from: field.bounds, to: step.bounds }]
      : [];
  }
  return fields.map((f) => ({
    from: f.bounds,
    to: moved(f.bounds, step.dx, step.dy),
  }));
};

/** The overlay's accessible name, saying what's selected */
const describeSelection = (design: Design, selection: Selection): string => {
  const fields = design.labels[selection.label]?.fields ?? [];
  const selected = fields.filter((f) => selection.keys.includes(f.key));
  if (selected.length === 0) return "Label designer, nothing selected";
  if (selected.length > 1) {
    return `Label designer, ${selected.length} fields selected`;
  }
  const [field] = selected;
  return `Label designer, ${kindOf(design, field)} on line ${lineOf(
    design,
    field
  )} selected`;
};

/** The selected fields' bounds together, for the rulers */
const extentOf = (
  design: Design,
  selection: Selection
): (Rect & { label: number }) | undefined => {
  const rects = (design.labels[selection.label]?.fields ?? [])
    .filter((f) => selection.keys.includes(f.key))
    .map((f) => f.bounds);
  if (rects.length === 0) return undefined;
  return { label: selection.label, ...union(rects) };
};

export {
  captionOf,
  captionSide,
  cropsFor,
  describeSelection,
  extentOf,
  guideName,
  handlesFor,
  positionIn,
  problemKeys,
  tagOf,
};
