import type { StaticSource, VirtualFile } from "fumadocs-core/source";
import data from "@/content/commands.json";
import { categoryAnchor } from "@/components/reference/anchor";
import { detailsOf, paramsOf } from "@/components/reference/command-details";
import { commandSlug } from "./reference";

type Command = (typeof data.commands)[number];

type StructuredData = {
  headings: { id: string; content: string }[];
  contents: { heading: string | undefined; content: string }[];
};

/** A page under ZPL commands: the supported commands table, or one command */
type CommandPageData = {
  title: string;
  description: string;
  /** The command's code, like ^BC; undefined for the table */
  code?: string;
  structuredData: StructuredData;
  /** The page as Markdown, for llms.txt */
  getText: (type: "raw" | "processed") => Promise<string>;
};

type CommandMetaData = {
  title: string;
  pages: string[];
  defaultOpen?: boolean;
};

type CommandFile = VirtualFile<{
  pageData: CommandPageData;
  metaData: CommandMetaData;
}>;

const supported = data.commands.filter((c) => c.support !== "no").length;

const indexDescription = `zplkit supports ${supported} of the ${data.commands.length} commands in Zebra's ZPL II Programming Guide.`;

/** A command's page as Markdown, and the text search finds it by */
const commandText = (command: Command) => {
  const info = detailsOf(command.code);
  const params = info ? paramsOf(info) : [];
  return [
    info?.summary ?? `The ZPL ${command.code} command.`,
    info && `Format: \`${info.syntax}\``,
    params.length > 0 &&
      params
        .map((param) => `- \`${param.name}\`: ${param.description}`)
        .join("\n"),
    info?.example && "Example:\n\n```zpl\n" + info.example + "\n```",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const commandPage = (command: Command): CommandFile => {
  const slug = commandSlug(command.code);
  const info = detailsOf(command.code);
  return {
    type: "page",
    path: `commands/${categoryAnchor(command.category)}/${slug}.mdx`,
    slugs: ["commands", slug],
    data: {
      title: `${command.code} ${command.name}`,
      description: info?.summary ?? `The ZPL ${command.code} command.`,
      code: command.code,
      structuredData: {
        headings: [],
        contents: [
          {
            heading: undefined,
            content: [
              info?.summary,
              info?.syntax,
              ...(info ? paramsOf(info).map((p) => p.description) : []),
            ]
              .filter(Boolean)
              .join(" "),
          },
        ],
      },
      getText: async () => commandText(command),
    } satisfies CommandPageData,
  };
};

/**
 * The ZPL commands section of the docs, made from commands.json: the table
 * at /docs/commands, and a page per command at /docs/commands/BC, in a
 * folder per category
 */
export const commandsSource: StaticSource<{
  pageData: CommandPageData;
  metaData: CommandMetaData;
}> = {
  files: [
    {
      type: "meta",
      path: "commands/meta.json",
      data: {
        title: "ZPL commands",
        pages: ["index", ...data.categories.map(categoryAnchor)],
      },
    },
    {
      type: "page",
      path: "commands/index.mdx",
      slugs: ["commands"],
      data: {
        title: "Supported commands",
        description: indexDescription,
        structuredData: {
          headings: [],
          contents: [{ heading: undefined, content: indexDescription }],
        },
        getText: async () =>
          [
            indexDescription,
            data.commands
              .map(
                (command) =>
                  `- [${command.code} ${
                    command.name
                  }](/docs/commands/${commandSlug(command.code)}): ${
                    command.support === "yes"
                      ? "supported"
                      : command.support === "partial"
                      ? "partly supported"
                      : "not supported yet"
                  }`
              )
              .join("\n"),
          ].join("\n\n"),
      },
    },
    ...data.categories.map(
      (category): CommandFile => ({
        type: "meta",
        path: `commands/${categoryAnchor(category)}/meta.json`,
        data: {
          title: category,
          pages: data.commands
            .filter((command) => command.category === category)
            .map((command) => commandSlug(command.code)),
        },
      })
    ),
    ...data.commands.map(commandPage),
  ],
};

export type { CommandPageData };
