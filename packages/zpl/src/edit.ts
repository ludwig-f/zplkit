import type { Command } from "./ast.js";
import ZplError from "./ZplError.js";

/** A change to ZPL text, shaped like a CodeMirror change */
type TextChange = { from: number; to: number; insert: string };

/**
 * Whether the text has a ^CD command, tracking the prefixes ^CC and ~CT
 * changed, the way the parser does
 */
const changesDelimiter = (text: string): boolean => {
  let caret = "^";
  let tilde = "~";
  // Like the parser, ignore line breaks between a prefix and the code, and
  // before a new prefix character
  const next = (index: number): number => {
    while (text.charAt(index) === "\r" || text.charAt(index) === "\n") index++;
    return index;
  };
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char !== caret && char !== tilde) {
      i++;
      continue;
    }
    const first = next(i + 1);
    const second = next(first + 1);
    const code = text.charAt(first) + text.charAt(second);
    if (code === "CD") return true;
    if (code === "CC" || code === "CT") {
      const prefix = next(second + 1);
      if (code === "CC") caret = text.charAt(prefix);
      else tilde = text.charAt(prefix);
      // Skip the new prefix character itself
      i = prefix + 1;
    } else {
      i++;
    }
  }
  return false;
};

/**
 * Replace parameters of a parsed command, by position, keeping every other
 * character of the command as written. The change covers only the
 * parameters from the first changed one to the last.
 */
const editParameters = (
  zpl: string,
  command: Command,
  changes: Record<number, string | number>
): TextChange => {
  if (!command.span) {
    throw new ZplError("Can't edit a command that wasn't parsed from text");
  }
  const { start, end } = command.span;

  // A changed delimiter would make the commas below mean something else
  if (changesDelimiter(zpl.slice(0, start))) {
    throw new ZplError(
      "Can't edit parameters after a ^CD changed the delimiter"
    );
  }

  const text = zpl.slice(start, end);
  // The prefix may have been changed by ^CC or ~CT, so read it from the text.
  // The code is two letters, except ^A followed by a font name.
  const isFont = text.charAt(1) === "A" && text.charAt(2) !== "@";
  const bodyStart = isFont ? 2 : 3;
  const original = text.slice(bodyStart).split(",");

  const indexes = Object.keys(changes).map(Number);
  if (indexes.length === 0) {
    return { from: start + bodyStart, to: start + bodyStart, insert: "" };
  }
  const parameters = [...original];
  while (parameters.length <= Math.max(...indexes)) parameters.push("");

  // Start from the last parameter that exists, so added ones get their comma
  const first = Math.min(Math.min(...indexes), original.length - 1);
  const last = Math.max(...indexes);
  let from = start + bodyStart;
  for (let i = 0; i < first; i++) from += original[i].length + 1;
  const edited = parameters.slice(first, last + 1).map((parameter, i) => {
    if (!(first + i in changes)) return parameter;
    // Keep the spaces around the value as written
    const lead = /^\s*/.exec(parameter)?.[0] ?? "";
    const trail = /\s*$/.exec(parameter.slice(lead.length))?.[0] ?? "";
    return lead + String(changes[first + i]) + trail;
  });
  const replaced = original.slice(first, last + 1).join(",");

  // Past the last parameter, the change runs to the end of the command
  const to = last < original.length ? from + replaced.length : end;
  return { from, to, insert: edited.join(",") };
};

export type { TextChange };
export { changesDelimiter, editParameters };
