import { editParameters } from "@zplkit/core/internal";
import type { TextChange } from "@zplkit/core/internal";
import type { Design } from "./fields";

/** Round to 2 decimals, so floats don't leak into the ZPL */
const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * A value in ^MU units as it's written: whole dots, since printers don't
 * read fractions of them, or millimeters and inches to 2 decimals
 */
const written = (value: number, perUnit: number): number =>
  perUnit === 1 ? Math.round(value) : round(value);

/** A length in dots, written in ^MU units */
const inUnits = (dots: number, perUnit: number): number =>
  written(dots / perUnit, perUnit);

/** The dots in one unit of ^MU, as in effect at each command */
const dotsPerUnit = ({ commands, dpmm }: Design): number[] => {
  const perUnit = { D: 1, M: dpmm, I: 25 * dpmm };
  let unit: keyof typeof perUnit = "D";
  return commands.map((command) => {
    if (command.type === "MeasurementUnits") unit = command.unit ?? unit;
    return perUnit[unit];
  });
};

/**
 * Move fields by a distance on screen, in dots: their ^FO or ^FT changes,
 * or a ^FO is added to a field that has neither
 */
const moveFields = (
  design: Design,
  keys: number[],
  dx: number,
  dy: number
): TextChange[] => {
  const { zpl, commands, labels } = design;

  const dots = dotsPerUnit(design);

  const changes: TextChange[] = [];
  for (const key of new Set(keys)) {
    const label = labels.find(({ fields }) =>
      fields.some((f) => f.key === key)
    );
    const field = label?.fields.find((f) => f.key === key);
    if (!label || !field) continue;

    // Turn the screen's distance into the printed one
    let x = label.mirrored ? -dx : dx;
    let y = dy;
    if (label.inverted) {
      x = -x;
      y = -y;
    }

    const index = field.commands[0];
    const command = commands[index];
    const perUnit = dots[index];
    const moveX = inUnits(x, perUnit);
    const moveY = inUnits(y, perUnit);
    /** A position as written, never past the label's left or top edge */
    const position = (value: number) => Math.max(0, written(value, perUnit));

    if (command.type === "FieldOrigin" || command.type === "FieldTypeset") {
      const changed: Record<number, number> = {};
      // Layout draws a ^FT's omitted value at the label home, as if it were
      // 0, so the move writes it from there
      const x0 = command.x ?? 0;
      const y0 = command.y ?? 0;
      if (moveX !== 0) changed[0] = position(x0 + moveX);
      if (moveY !== 0) changed[1] = position(y0 + moveY);
      if (Object.keys(changed).length > 0) {
        changes.push(editParameters(zpl, command, changed));
      }
    } else if (command.span && (moveX !== 0 || moveY !== 0)) {
      const { start } = command.span;
      changes.push({
        from: start,
        to: start,
        insert: `${zpl.charAt(start)}FO${position(moveX)},${position(moveY)}`,
      });
    }
  }
  return changes.sort((a, b) => a.from - b.from);
};

export { dotsPerUnit, inUnits, moveFields };
