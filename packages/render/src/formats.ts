/**
 * Stored formats: a label with ^DF is saved instead of printed, and ^XF
 * prints a saved one in place. The recalling label fills fields numbered
 * with ^FN: data after ^FNn goes into every field of the format numbered n,
 * replacing data of its own. Commands keep their index in the original
 * list, so drawn elements can still be traced back to their source.
 */
import type { Command } from "@zplkit/core";

type Indexed = { command: Command; index: number };

const formatKey = (command: {
  device: string;
  name: string;
  extension: string;
}) => `${command.device}:${command.name}.${command.extension}`.toUpperCase();

/** Split commands into labels from ^XA to ^XZ, and what's between them */
const labelsOf = (commands: readonly Indexed[]) => {
  const parts: { label: boolean; commands: Indexed[] }[] = [];
  let current: Indexed[] | undefined;
  for (const item of commands) {
    if (item.command.type === "StartFormat") {
      current = [item];
      parts.push({ label: true, commands: current });
    } else if (current) {
      current.push(item);
      if (item.command.type === "EndFormat") current = undefined;
    } else {
      const last = parts[parts.length - 1];
      if (last && !last.label) last.commands.push(item);
      else parts.push({ label: false, commands: [item] });
    }
  }
  return parts;
};

/** Each ^FNn field's data, and the commands of those fields */
const fieldData = (commands: Indexed[]) => {
  const data = new Map<number, Indexed>();
  const fields = new Map<number, Indexed[]>();
  let number: number | undefined;
  let field: Indexed[] = [];
  for (const item of commands) {
    const { command } = item;
    if (command.type === "FieldNumber") {
      number = command.number;
      field = [item];
      fields.set(number, field);
    } else if (number !== undefined) {
      field.push(item);
      if (command.type === "FieldData") data.set(number, item);
      if (command.type === "FieldSeparator") number = undefined;
    }
  }
  return { data, fields };
};

/** A stored format's commands with the recalling label's data filled in */
const fill = (format: Indexed[], data: Map<number, Indexed>): Indexed[] => {
  const result: Indexed[] = [];
  let filling: Indexed | undefined;
  for (const item of format) {
    const { command } = item;
    if (command.type === "FieldNumber") filling = data.get(command.number);
    if (filling && command.type === "FieldData") continue;
    if (filling && command.type === "FieldSeparator") {
      result.push(filling);
      filling = undefined;
    }
    result.push(item);
  }
  if (filling) result.push(filling);
  return result;
};

const expandFormats = (commands: readonly Command[]): Indexed[] => {
  const formats = new Map<string, Indexed[]>();
  const result: Indexed[] = [];

  const indexed = commands.map((command, index) => ({ command, index }));
  for (const part of labelsOf(indexed)) {
    const label = part.commands;
    const download = label.findIndex(
      ({ command }) => command.type === "DownloadFormat"
    );
    if (part.label && download >= 0) {
      const command = label[download].command as Extract<
        Command,
        { type: "DownloadFormat" }
      >;
      formats.set(
        formatKey(command),
        label
          .slice(download + 1)
          .filter(({ command }) => command.type !== "EndFormat")
      );
      continue;
    }

    const recall = label.findIndex(
      ({ command }) => command.type === "RecallFormat"
    );
    if (!part.label || recall < 0) {
      result.push(...label);
      continue;
    }

    const command = label[recall].command as Extract<
      Command,
      { type: "RecallFormat" }
    >;
    const format = formats.get(formatKey(command)) ?? [];
    const numbers = new Set(
      format.flatMap(({ command }) =>
        command.type === "FieldNumber" ? [command.number] : []
      )
    );
    // Fields that fill the format aren't drawn on their own
    const { data, fields } = fieldData(label);
    const used = new Set(
      [...fields].flatMap(([number, items]) =>
        numbers.has(number) ? items : []
      )
    );
    const rest = (items: Indexed[]) => items.filter((item) => !used.has(item));

    const end = label[label.length - 1];
    const ends = end.command.type === "EndFormat";
    result.push(
      ...rest(label.slice(0, recall + 1)),
      ...fill(format, data),
      ...rest(label.slice(recall + 1, ends ? -1 : undefined)),
      ...(ends ? [end] : [])
    );
  }
  return result;
};

export type { Indexed };
export { expandFormats, labelsOf };
