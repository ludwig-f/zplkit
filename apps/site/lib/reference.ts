import data from "@/content/commands.json";
import { detailsOf } from "@/components/reference/command-details";
import { anchorOf } from "@/components/reference/anchor";

/** A command's page under /docs/commands: ^BC at /docs/commands/BC, ~CC at /docs/commands/tilde-CC */
export const commandSlug = anchorOf;

export const commandBySlug = (slug: string) =>
  data.commands.find((command) => commandSlug(command.code) === slug);

/** The commands before and after this one in its category */
export const neighbors = (code: string) => {
  const command = data.commands.find((c) => c.code === code)!;
  const siblings = data.commands.filter((c) => c.category === command.category);
  const i = siblings.findIndex((c) => c.code === code);
  return { previous: siblings[i - 1], next: siblings[i + 1] };
};

/** A sentence about the command, for search results and link previews */
export const commandDescription = (code: string) =>
  detailsOf(code)?.summary ?? `The ZPL ${code} command.`;
