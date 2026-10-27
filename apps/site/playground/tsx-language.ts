import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/** TypeScript with JSX, colored with the site's syntax tokens */
export const tsxLanguage = [
  javascript({ jsx: true, typescript: true }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: [tags.keyword, tags.modifier], color: "var(--zk-syn-kw)" },
      { tag: tags.string, color: "var(--zk-syn-str)" },
      { tag: [tags.number, tags.bool, tags.null], color: "var(--zk-syn-num)" },
      {
        tag: tags.comment,
        color: "var(--zk-syn-com)",
        fontStyle: "italic",
      },
      {
        tag: [
          tags.function(tags.variableName),
          tags.tagName,
          tags.typeName,
          tags.className,
        ],
        color: "var(--zk-syn-fn)",
      },
      { tag: [tags.punctuation, tags.angleBracket], color: "var(--muted)" },
    ])
  ),
];
