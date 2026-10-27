import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

type State = { inData: "field" | "comment" | false };

const isPrefix = (char: string | undefined) => char === "^" || char === "~";

/** Highlights commands, field data, comments and numbers in ZPL */
const zplLanguage = StreamLanguage.define<State>({
  startState: () => ({ inData: false }),
  token(stream, state) {
    if (state.inData) {
      while (!stream.eol() && !isPrefix(stream.peek())) stream.next();
      const style = state.inData === "comment" ? "comment" : "string";
      if (!stream.eol() || isPrefix(stream.peek())) state.inData = false;
      return style;
    }

    if (stream.match(/^[\^~](FD|FX)/)) {
      state.inData = stream.current().endsWith("X") ? "comment" : "field";
      return "keyword";
    }
    // ^A takes its font name directly after the command: ^A0N,30,30
    if (stream.match(/^\^A[@A-Z0-9]?/) || stream.match(/^[\^~][A-Z0-9]{2}/i)) {
      return "keyword";
    }
    if (stream.match(/^-?\d+(\.\d+)?/)) return "number";
    if (stream.eat(",")) return "punctuation";

    stream.next();
    return null;
  },
  copyState: (state) => ({ ...state }),
});

const zplHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: "var(--syntax-command)", fontWeight: "600" },
    { tag: tags.string, color: "var(--syntax-data)" },
    { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
    { tag: tags.number, color: "var(--syntax-number)" },
    { tag: tags.punctuation, color: "var(--muted)" },
  ])
);

export { zplLanguage, zplHighlighting };
