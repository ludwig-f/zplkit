import { editParameters } from "@zplkit/core/internal";
import type { TextChange } from "@zplkit/core/internal";
import type { Design } from "./fields";

/** Round to 2 decimals, so floats don't leak into the ZPL */
const round = (value: number): number => Math.round(value * 100) / 100;

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
  const { zpl, commands, dpmm, labels } = design;

  // The dots in one unit of ^MU, before each command
  const dotsPerUnit = { D: 1, M: dpmm, I: 25 * dpmm };
  let unit: keyof typeof dotsPerUnit = "D";
  const dots = commands.map((command) => {
    if (command.type === "MeasurementUnits") unit = command.unit ?? unit;
    return dotsPerUnit[unit];
  });

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
    const moveX = round(x / perUnit);
    const moveY = round(y / perUnit);

    if (command.type === "FieldOrigin" || command.type === "FieldTypeset") {
      const changed: Record<number, number> = {};
      const x0 = command.x ?? 0;
      const y0 = command.y ?? 0;
      if (moveX !== 0) changed[0] = round(x0 + moveX);
      if (moveY !== 0) changed[1] = round(y0 + moveY);
      if (Object.keys(changed).length > 0) {
        changes.push(editParameters(zpl, command, changed));
      }
    } else if (command.span && (moveX !== 0 || moveY !== 0)) {
      const { start } = command.span;
      changes.push({
        from: start,
        to: start,
        insert: `${zpl.charAt(start)}FO${moveX},${moveY}`,
      });
    }
  }
  return changes.sort((a, b) => a.from - b.from);
};

export { moveFields };
