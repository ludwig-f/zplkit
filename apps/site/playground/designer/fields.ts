import { parse } from "@zplkit/core";
import { designLabels } from "@zplkit/render/internal";
import type { Command } from "@zplkit/core";
import type { RenderOptions } from "@zplkit/render";
import type { DesignField, DesignLabel, Rect } from "@zplkit/render/internal";

type Design = {
  zpl: string;
  dpmm: number;
  commands: Command[];
  labels: DesignLabel[];
};

/** How big a target an empty field gets, in dots */
const EMPTY_TARGET = 6;

/** Parse ZPL and measure its fields on every label */
const designFor = (zpl: string, options: RenderOptions): Design => {
  const { commands } = parse(zpl);
  return {
    zpl,
    dpmm: options.dpmm,
    commands,
    labels: designLabels(commands, options),
  };
};

/** Where a field can be hit: empty fields get a small target on their position */
const target = ({ bounds }: DesignField): Rect =>
  bounds.width === 0 && bounds.height === 0
    ? {
        x: bounds.x - EMPTY_TARGET / 2,
        y: bounds.y - EMPTY_TARGET / 2,
        width: EMPTY_TARGET,
        height: EMPTY_TARGET,
      }
    : bounds;

/**
 * The topmost field under a point on a label, in dots. With `under`, the next
 * field below that one at the point, or the topmost again after the lowest.
 */
const fieldAt = (
  label: DesignLabel,
  x: number,
  y: number,
  under?: DesignField
): DesignField | undefined => {
  const hits: DesignField[] = [];
  for (let i = label.fields.length - 1; i >= 0; i--) {
    const rect = target(label.fields[i]);
    if (
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
    ) {
      hits.push(label.fields[i]);
    }
  }
  const at = under ? hits.indexOf(under) : -1;
  return hits[at + 1] ?? hits[0];
};

/** Fields whose bounds overlap a rectangle, like a selection box */
const fieldsIn = (label: DesignLabel, rect: Rect): DesignField[] =>
  label.fields.filter((field) => {
    const box = target(field);
    return (
      box.x < rect.x + rect.width &&
      box.x + box.width > rect.x &&
      box.y < rect.y + rect.height &&
      box.y + box.height > rect.y
    );
  });

/** The field whose ZPL holds a text offset, like the editor's cursor */
const fieldAtOffset = (
  design: Design,
  offset: number
): DesignField | undefined => {
  const index = design.commands.findIndex(
    ({ span }) => span && offset >= span.start && offset < span.end
  );
  if (index < 0) return undefined;
  for (const label of design.labels) {
    const field = label.fields.find(({ commands }) => commands.includes(index));
    if (field) return field;
  }
  return undefined;
};

/** The ranges of ZPL text a field's commands take, in order, for highlighting */
const spansOf = (
  design: Design,
  field: DesignField
): { from: number; to: number }[] =>
  field.commands.flatMap((index) => {
    const span = design.commands[index]?.span;
    return span ? [{ from: span.start, to: span.end }] : [];
  });

/** How many labels print a field */
const labelsSharing = (design: Design, key: number): number =>
  design.labels.filter((label) => label.fields.some((f) => f.key === key))
    .length;

export type { Design };
export { designFor, fieldAt, fieldAtOffset, fieldsIn, labelsSharing, spansOf };
