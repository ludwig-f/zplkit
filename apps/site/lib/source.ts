import { createElement } from "react";
import { llms, loader } from "fumadocs-core/source";
import type { LoaderPlugin } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { docsRoute } from "./shared";
import { defineDocs } from "fumadocs-mdx/macro";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { codeTheme } from "./code-theme";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import {
  createFileSystemGeneratorCache,
  createGenerator,
  remarkAutoTypeTable,
} from "fumadocs-typescript";
import type { RemarkAutoTypeTableOptions } from "fumadocs-typescript";
import { commandsSource } from "./commands-source";

type TypeSimplifierContext = Parameters<
  NonNullable<
    NonNullable<
      NonNullable<RemarkAutoTypeTableOptions["options"]>["typeSimplifier"]
    >["override"]
  >
>[0];

/**
 * Show short types in full, like `6 | 8 | 12 | 24`, instead of "union".
 * Optional props leave out undefined, since the table marks them optional,
 * and named types like Length keep their name.
 */
const shortUnion = ({ type, checker, location }: TypeSimplifierContext) => {
  if ((type as { getAliasSymbol?: () => unknown }).getAliasSymbol?.()) {
    return undefined;
  }
  const text = checker
    .typeToString(type, location)
    .split(" | ")
    .filter((member) => member !== "undefined")
    .join(" | ");
  return text.length <= 48 && !/[{&(]/.test(text) ? text : undefined;
};

/** Shared types and where they're described, so tables can link to them */
const typeLinks: Record<string, string> = {
  Length: "/docs/api/types#length",
  Position: "/docs/api/types#position",
  Orientation: "/docs/api/types#orientation",
  ZebraFontFamily: "/docs/api/types#zebrafontfamily",
  Color: "/docs/api/types#color",
  StorageDevice: "/docs/api/types#storagedevice",
  Graphic: "/docs/api/types#graphic",
  TextChildren: "/docs/api/types#textchildren",
  FontOptions: "/docs/api/label#text",
  Render: "/docs/api/preview#configure",
};

/** Link a property's type to where it's described, if it's a shared one */
const linkType = (entry: {
  type: string;
  simplifiedType: string;
  typeHref?: string;
}) => {
  const name = Object.keys(typeLinks).find((type) =>
    new RegExp(`\\b${type}\\b`).test(entry.simplifiedType || entry.type)
  );
  if (name) entry.typeHref = typeLinks[name];
};

// API reference tables, generated from the packages' TypeScript types
const generator = createGenerator({
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});

const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    // Fumadocs' defaults, with code in the site's syntax colors. The theme
    // uses CSS variables, so one theme covers light and dark.
    mdxOptions: applyMdxPreset({
      rehypeCodeOptions: { themes: { light: codeTheme, dark: codeTheme } },
      remarkPlugins: (plugins) => [
        ...plugins,
        [
          remarkAutoTypeTable,
          {
            generator,
            remarkStringify: true,
            options: {
              typeSimplifier: { override: shortUnion },
              transform: linkType,
            },
          },
        ],
      ],
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

/** Commands in the sidebar as their code in mono, then their name */
const commandNames: LoaderPlugin = {
  name: "command-names",
  transformPageTree: {
    file(node, filePath) {
      if (!filePath?.startsWith("commands/") || typeof node.name !== "string") {
        return node;
      }
      const [code, ...name] = node.name.split(" ");
      if (!/^[\^~]/.test(code)) return node;
      return {
        ...node,
        name: createElement(
          "span",
          { className: "command-name" },
          createElement("code", null, code),
          createElement("span", null, name.join(" "))
        ),
      };
    },
  },
};

// See https://fumadocs.dev/docs/headless/source-api for more info. The
// guides and API pages are MDX; the ZPL commands come from commands.json.
export const source = loader({
  baseUrl: docsRoute,
  source: { docs: docs.toFumadocsSource(), commands: commandsSource },
  plugins: [lucideIconsPlugin(), commandNames],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`,
});
