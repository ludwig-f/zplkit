/**
 * Copies: ^PQ prints a label more than once, and ^SN and ^SF change its
 * data on each copy. Labels whose copies are all the same are drawn once
 * with their count; serialized ones once for each different copy. Commands
 * keep their index in the original list.
 */
import { labelsOf } from "./formats.js";
import { serialNumber, serializedField } from "./serial.js";
import type { Command } from "@zplkit/core";
import type { Indexed } from "./formats.js";

type PrintQuantity = Extract<Command, { type: "PrintQuantity" }>;

/** How many labels ^PQ prints, and how many of each serial number */
const quantityOf = (label: readonly Indexed[]) => {
  const pq = label
    .map(({ command }) => command)
    .filter(
      (command): command is PrintQuantity => command.type === "PrintQuantity"
    )
    .pop();
  return {
    quantity: Math.max(1, Math.floor(pq?.quantity ?? 1)),
    replicates: Math.max(1, Math.floor(pq?.replicates || 1)),
  };
};

const isSerialized = (label: readonly Indexed[]) =>
  label.some(
    ({ command }) =>
      command.type === "SerialNumber" || command.type === "SerializationField"
  );

/** A label with each serialized field's data for one step */
const serialize = (label: readonly Indexed[], step: number): Indexed[] => {
  const result: Indexed[] = [];
  let fieldStart = 0;
  let serial: Extract<Command, { type: "SerializationField" }> | undefined;

  for (const item of label) {
    const { command } = item;
    if (command.type === "FieldOrigin" || command.type === "FieldTypeset") {
      fieldStart = result.length;
      serial = undefined;
    }
    if (command.type === "SerialNumber") {
      // ^SN is the field's data, instead of any ^FD
      for (let i = result.length - 1; i >= fieldStart; i--) {
        if (result[i].command.type === "FieldData") result.splice(i, 1);
      }
      const data = serialNumber(
        command.start,
        command.increment,
        command.leadingZeros,
        step
      );
      result.push({ command: { type: "FieldData", data }, index: item.index });
      continue;
    }
    if (command.type === "SerializationField") serial = command;
    if (command.type === "FieldSeparator" && serial?.mask) {
      for (let i = result.length - 1; i >= fieldStart; i--) {
        const { command: data, index } = result[i];
        if (data.type !== "FieldData") continue;
        const counted = serializedField(
          data.data,
          serial.mask,
          serial.increment,
          step
        );
        result[i] = { command: { ...data, data: counted }, index };
        break;
      }
      serial = undefined;
    }
    result.push(item);
  }
  return result;
};

/**
 * The commands with each serialized label repeated for each different
 * copy, and how many copies each label prints. Stops after `limit` labels.
 */
const expandCopies = (
  items: readonly Indexed[],
  limit = Infinity
): { items: Indexed[]; copies: number[] } => {
  const result: Indexed[] = [];
  const copies: number[] = [];

  for (const part of labelsOf(items)) {
    if (copies.length >= limit) break;
    if (!part.label) {
      result.push(...part.commands);
      continue;
    }
    const { quantity, replicates } = quantityOf(part.commands);
    if (!isSerialized(part.commands)) {
      result.push(...part.commands);
      copies.push(quantity);
      continue;
    }
    const steps = Math.ceil(quantity / replicates);
    for (let step = 0; step < steps && copies.length < limit; step++) {
      result.push(...serialize(part.commands, step));
      copies.push(Math.min(replicates, quantity - step * replicates));
    }
  }
  return { items: result, copies };
};

/** Different labels, and labels printed, without laying any out */
const countCopies = (items: readonly Indexed[]) => {
  let labels = 0;
  let printed = 0;
  for (const part of labelsOf(items)) {
    if (!part.label) continue;
    const { quantity, replicates } = quantityOf(part.commands);
    labels += isSerialized(part.commands)
      ? Math.ceil(quantity / replicates)
      : 1;
    printed += quantity;
  }
  return { labels, printed };
};

export { expandCopies, countCopies };
