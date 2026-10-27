import type { ThemeRegistration } from "shiki";

/**
 * Syntax colors from the site's tokens, as CSS variables, so code follows
 * the light and dark themes: keywords violet, strings green, numbers rust,
 * comments muted and functions and JSX tags cobalt
 */
export const codeTheme: ThemeRegistration = {
  name: "zplkit",
  type: "light",
  colors: {
    "editor.foreground": "var(--zk-ink)",
    "editor.background": "transparent",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "var(--zk-syn-com)" },
    },
    {
      scope: ["keyword", "storage", "constant.language", "variable.language"],
      settings: { foreground: "var(--zk-syn-kw)" },
    },
    {
      scope: ["keyword.operator", "punctuation"],
      settings: { foreground: "var(--zk-ink)" },
    },
    {
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "var(--zk-syn-str)" },
    },
    {
      scope: ["constant.numeric"],
      settings: { foreground: "var(--zk-syn-num)" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call entity.name.function",
      ],
      settings: { foreground: "var(--zk-syn-fn)" },
    },
    {
      scope: [
        "entity.name.tag",
        "support.class.component",
        "entity.name.tag.tsx",
      ],
      settings: { foreground: "var(--zk-syn-fn)" },
    },
  ],
};
