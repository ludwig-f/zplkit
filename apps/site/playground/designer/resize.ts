import { editParameters } from "@zplkit/core/internal";
import type { Command } from "@zplkit/core";
import type { TextChange } from "@zplkit/core/internal";
import type { DesignField, Rect } from "@zplkit/render/internal";
import type { Design } from "./fields";
import { dotsPerUnit, moveFields, round } from "./move";

type Handles = "none" | "corners" | "proportional";

/** The command of a field that sets its size, with where its size is */
const sizing = (
  design: Design,
  field: DesignField
): { index: number; command: Command; handles: Handles } | undefined => {
  for (const index of field.commands) {
    const command = design.commands[index];
    if (!command.span) continue;
    switch (command.type) {
      case "GraphicBox":
      case "GraphicEllipse":
      case "GraphicDiagonal":
        return { index, command, handles: "corners" };
      case "GraphicCircle":
        return { index, command, handles: "proportional" };
      case "Font":
        if (command.height !== undefined) {
          return { index, command, handles: "proportional" };
        }
        break;
      case "Code128":
        if (command.height !== undefined) {
          return { index, command, handles: "corners" };
        }
        break;
      case "QrCode":
        if (command.magnification !== undefined) {
          return { index, command, handles: "proportional" };
        }
        break;
    }
  }
  return undefined;
};

/** Which handles a field gets */
const resizeHandles = (design: Design, field: DesignField): Handles =>
  sizing(design, field)?.handles ?? "none";

/** A size in dots as written in the field's ^MU units: whole dots, or 2 decimals */
const inUnits = (dots: number, perUnit: number): number =>
  Math.max(perUnit === 1 ? Math.round(dots) : round(dots / perUnit), 1);

/**
 * Resize a field to new bounds on screen, moving it if its top or left moved
 */
const resizeField = (
  design: Design,
  key: number,
  bounds: Rect
): TextChange[] => {
  const label = design.labels.find(({ fields }) =>
    fields.some((f) => f.key === key)
  );
  const field = label?.fields.find((f) => f.key === key);
  const found = field && sizing(design, field);
  if (!label || !field || !found) return [];

  const { index, command } = found;
  const old = field.bounds;
  const perUnit = dotsPerUnit(design)[index];
  const sizes: Record<number, number> = {};
  /** A written parameter times how much bigger the bounds got */
  const scaled = (value: number, ratio: number): number =>
    inUnits(value * perUnit * ratio, perUnit);

  switch (command.type) {
    case "GraphicBox":
    case "GraphicEllipse":
    case "GraphicDiagonal":
      sizes[0] = inUnits(bounds.width, perUnit);
      sizes[1] = inUnits(bounds.height, perUnit);
      break;
    case "GraphicCircle":
      sizes[0] = inUnits(bounds.width, perUnit);
      break;
    case "Font": {
      // Turned text is as long as it is tall
      const turned = command.orientation === "R" || command.orientation === "B";
      const ratio = turned
        ? bounds.width / old.width
        : bounds.height / old.height;
      if (!Number.isFinite(ratio) || ratio <= 0) return [];
      sizes[1] = scaled(command.height ?? 0, ratio);
      if (command.width !== undefined) sizes[2] = scaled(command.width, ratio);
      break;
    }
    case "Code128":
      // Bounds include the interpretation line, so only the difference counts
      sizes[1] = inUnits(
        (command.height ?? 0) * perUnit + bounds.height - old.height,
        perUnit
      );
      break;
    case "QrCode": {
      const ratio = bounds.width / old.width;
      if (!Number.isFinite(ratio) || ratio <= 0) return [];
      const magnification = Math.round((command.magnification ?? 0) * ratio);
      sizes[2] = Math.min(Math.max(magnification, 1), 100);
      break;
    }
  }

  // Only write what changes
  const parameters = command as unknown as Record<string, number | undefined>;
  const names: Record<number, string> = {
    0: command.type === "GraphicCircle" ? "diameter" : "width",
    1: "height",
    2: command.type === "QrCode" ? "magnification" : "width",
  };
  for (const position of Object.keys(sizes).map(Number)) {
    if (parameters[names[position]] === sizes[position]) delete sizes[position];
  }
  const changes: TextChange[] = [];
  if (Object.keys(sizes).length > 0) {
    changes.push(editParameters(design.zpl, command, sizes));
  }

  // The origin sits on the screen's top left, unless the label is turned over
  const flipX = Boolean(label.mirrored) !== Boolean(label.inverted);
  const flipY = Boolean(label.inverted);
  const dx = flipX
    ? bounds.x + bounds.width - (old.x + old.width)
    : bounds.x - old.x;
  const dy = flipY
    ? bounds.y + bounds.height - (old.y + old.height)
    : bounds.y - old.y;
  if (dx !== 0 || dy !== 0) {
    changes.push(...moveFields(design, [key], dx, dy));
  }
  return changes.sort((a, b) => a.from - b.from);
};

export type { Handles };
export { resizeField, resizeHandles };
