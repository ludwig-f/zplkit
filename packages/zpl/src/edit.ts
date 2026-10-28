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
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char !== caret && char !== tilde) {
      i++;
      continue;
    }
    const code = text.slice(i + 1, i + 3);
    if (code === "CD") return true;
    if (code === "CC") caret = text.charAt(i + 3);
    if (code === "CT") tilde = text.charAt(i + 3);
    // Skip the new prefix character itself
    i += code === "CC" || code === "CT" ? 4 : 1;
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
  const edited = parameters
    .slice(first, last + 1)
    .map((parameter, i) =>
      first + i in changes ? String(changes[first + i]) : parameter
    );
  const replaced = original.slice(first, last + 1).join(",");

  // Past the last parameter, the change runs to the end of the command
  const to = last < original.length ? from + replaced.length : end;
  return { from, to, insert: edited.join(",") };
};

export type { TextChange };
export { editParameters };
