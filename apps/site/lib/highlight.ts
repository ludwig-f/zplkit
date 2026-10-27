import "server-only";
import { codeToHtml } from "shiki";
import { codeTheme } from "./code-theme";

/** Code as highlighted HTML, colored with the site's syntax tokens */
export const highlight = (code: string, lang: string) =>
  codeToHtml(code, { lang, theme: codeTheme });

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * ZPL as highlighted HTML: commands in the ZPL color, field data as strings
 * and parameters as numbers, with each field on a line of its own
 */
export const highlightZpl = (zpl: string) => {
  const lines = zpl.replace(/(?=\^(?:FO|FT|XZ))/g, "\n").split("\n");
  const html = lines.map((line) => {
    let inData = false;
    return line
      .split(/([\^~][A-Z@][A-Z0-9@]?)/)
      .filter(Boolean)
      .map((part) => {
        if (/^[\^~][A-Z@]/.test(part)) {
          inData = part === "^FD" || part === "^FV";
          return `<span style="color:var(--zk-syn-zpl)">${escape(part)}</span>`;
        }
        const color = inData ? "var(--zk-syn-str)" : "var(--zk-syn-num)";
        return `<span style="color:${color}">${escape(part)}</span>`;
      })
      .join("");
  });
  return `<pre class="shiki"><code>${html
    .map((line) => `<span class="line">${line}</span>`)
    .join("\n")}</code></pre>`;
};
