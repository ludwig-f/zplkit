import Link from "next/link";
import data from "@/content/commands.json";
import {
  CommandDetails,
  detailsOf,
} from "@/components/reference/command-details";
import { CommandsTable } from "@/components/reference/commands-table";
import { apiFor } from "@/components/reference/api-links";
import { Mark } from "@/components/reference/mark";
import type { Support } from "@/components/reference/mark";
import { commandExamples } from "@/lib/command-examples";

const support: Record<Support, string> = {
  yes: "Supported by zplkit",
  partial: "Partly supported by zplkit",
  no: "Not supported by zplkit yet",
};

/** The sections a command's page has, for the table of contents */
export function commandToc(code: string) {
  const info = detailsOf(code);
  const command = data.commands.find((c) => c.code === code);
  if (!info || !command) return [];
  return [
    { title: "Format", url: "#format", depth: 2 },
    info.params?.length && {
      title: "Parameters",
      url: "#parameters",
      depth: 2,
    },
    info.example && { title: "Example", url: "#example", depth: 2 },
    command.support !== "no" &&
      apiFor[code] && {
        title: "In zplkit",
        url: "#in-zplkit",
        depth: 2,
      },
  ].filter((item) => !!item);
}

/** A command's page: its code and name, whether zplkit supports it, details */
export async function CommandPage({ code }: { code: string }) {
  const command = data.commands.find((c) => c.code === code)!;
  const image = (await commandExamples()).get(code);

  return (
    <>
      <h1 className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-[clamp(32px,4cqi,44px)] font-bold leading-[1.05]">
          {command.code}
        </span>
        <span className="text-[clamp(22px,2.6cqi,28px)] font-extrabold leading-[1.15] [font-stretch:108%]">
          {command.name}
        </span>
      </h1>

      <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
        <Mark value={command.support as Support} />
        {support[command.support as Support]}
        {command.note && <span className="text-warn">· {command.note}</span>}
      </p>

      <div className="border-t border-rule pt-5">
        <CommandDetails command={command} image={image} />
      </div>
    </>
  );
}

const supported = data.commands.filter((c) => c.support !== "no").length;

/** /docs/commands: every command, and whether zplkit supports it */
export function CommandsIndex() {
  return (
    <>
      <h1 className="text-[clamp(32px,4cqi,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] [font-stretch:112%]">
        Supported commands
      </h1>
      <div className="flex flex-col gap-3.5">
        <p className="max-w-[40em] text-pretty text-muted">
          zplkit currently supports {supported} of the {data.commands.length}{" "}
          commands in Zebra&apos;s ZPL II Programming Guide. A supported command
          can be built with zplkit,{" "}
          <code className="font-mono text-[0.9em]">parse()</code> reads it into
          a typed node, and the{" "}
          <Link href="/docs/preview" className="text-accent hover:underline">
            preview
          </Link>{" "}
          draws it if it draws anything. Other commands are kept as they are by{" "}
          <code className="font-mono text-[0.9em]">parse()</code> and can be
          added with <code className="font-mono text-[0.9em]">raw()</code>. Open
          a row for a summary, or a command&apos;s page for its parameters and
          an example.
        </p>
        <p className="max-w-[40em] text-pretty text-muted">
          Every parameter and edge case is in{" "}
          <a
            href="https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands.html"
            className="text-accent hover:underline"
          >
            Zebra&apos;s ZPL II Programming Guide
          </a>
          .
        </p>
      </div>
      <CommandsTable />
    </>
  );
}
