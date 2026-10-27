"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import data from "@/content/commands.json";
import { anchorOf, categoryAnchor } from "./anchor";
import { detailsOf } from "./command-details";
import type { Command } from "./command-details";
import { apiFor } from "./api-links";
import { Mark } from "./mark";
import type { Support } from "./mark";

type Mode = "All" | "Supported" | "Not yet";
const isSupported = (command: Command) => command.support !== "no";

/** The supported commands, generated from the code, with a filter */
/** What a row's panel shows: the summary, and where to read more */
function CommandSummary({ command }: { command: Command }) {
  const info = detailsOf(command.code);
  if (!info) return null;
  const api = command.support !== "no" ? apiFor[command.code] : undefined;
  return (
    <div className="flex max-w-[68ch] flex-col gap-2 pb-4 pt-1 text-[14px] leading-[1.55]">
      <p className="text-ink-2">{info.summary}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={`/docs/commands/${anchorOf(command.code)}`}
          className="font-semibold text-accent hover:underline"
        >
          Parameters and example
        </a>
        {api && (
          <a
            href={`/docs/api/label#${api.method.toLowerCase()}`}
            className="font-mono text-[13px] text-accent hover:underline"
          >
            label.{api.method}()
          </a>
        )}
      </p>
    </div>
  );
}

export function CommandsTable() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("All");
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Rows stay in the page after they're first opened, so they can close
  // with the same animation they open with
  const [opened, setOpened] = useState<Set<string>>(new Set());
  // Spaces are ignored, so "barcode" finds Zebra's "bar code"
  const squash = (text: string) => text.toLowerCase().replace(/\s+/g, "");
  const q = squash(query);

  const flip = (code: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const toggle = (code: string) => {
    if (opened.has(code)) {
      flip(code);
      return;
    }
    // Mount the details collapsed first, then open them once that's been
    // painted, so the first opening slides like the ones after it
    setOpened((current) => new Set(current).add(code));
    requestAnimationFrame(() => requestAnimationFrame(() => flip(code)));
  };

  const matches = (command: Command) => {
    const text = squash(
      [
        command.code,
        command.name,
        command.note,
        command.category,
        detailsOf(command.code)?.summary,
      ].join(" ")
    );
    if (q && !text.includes(q)) return false;
    if (mode === "Supported") return isSupported(command);
    if (mode === "Not yet") return !isSupported(command);
    return true;
  };

  const groups = data.categories
    .map((category) => {
      const all = data.commands.filter((c) => c.category === category);
      return {
        category,
        total: all.length,
        supported: all.filter(isSupported).length,
        rows: all.filter(matches),
      };
    })
    .filter((group) => group.rows.length);
  const shown = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="not-prose @container mt-6">
      <div className="mb-3 flex flex-wrap gap-x-[18px] gap-y-2 text-[13.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Mark value="yes" /> Supported
        </span>
        <span className="flex items-center gap-1.5">
          <Mark value="partial" /> Partly, see the notes
        </span>
        <span className="flex items-center gap-1.5">
          <Mark value="no" /> Not yet
        </span>
      </div>

      <div className="sticky top-[var(--fd-header-height,0px)] z-20 -mx-1 flex flex-wrap items-center gap-2.5 border-b border-rule-strong bg-bg px-1 py-2.5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter: ^BC, barcode, font…"
          aria-label="Filter commands"
          className="h-10 min-w-0 flex-[1_1_220px] rounded border border-rule-strong bg-raised px-3 font-mono text-sm"
        />
        <div
          role="radiogroup"
          aria-label="Show"
          className="flex overflow-hidden rounded border border-rule-strong"
        >
          {(["All", "Supported", "Not yet"] as const).map((label) => (
            <button
              key={label}
              role="radio"
              aria-checked={label === mode}
              onClick={() => setMode(label)}
              className={`h-[38px] whitespace-nowrap border-r border-rule px-3 text-[13px] font-semibold [outline-offset:-2px] last:border-r-0 ${
                label === mode ? "bg-ink text-bg" : "bg-raised text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="whitespace-nowrap font-mono text-[12.5px] font-medium text-muted">
          {shown} of {data.commands.length}
        </span>
      </div>

      <div className="flex flex-col gap-7 pb-16 pt-2">
        {groups.map((group) => (
          <section key={group.category} className="flex flex-col gap-2.5">
            <h2
              id={categoryAnchor(group.category)}
              className="mt-4 flex scroll-mt-40 items-baseline gap-2.5 text-[22px] font-extrabold [font-stretch:108%]"
            >
              {group.category}
              <span className="font-mono text-[12.5px] font-medium text-muted">
                {group.supported} of {group.total} supported
              </span>
            </h2>
            <div className="rounded-md border border-rule-strong">
              <table className="w-full table-fixed border-separate border-spacing-0 text-sm leading-[1.4]">
                <thead>
                  <tr className="text-left">
                    {[
                      ["Command", "w-[120px] @[640px]:w-28"],
                      ["Name", "hidden w-[34%] @[640px]:table-cell"],
                      ["Supported", "w-[96px] text-center"],
                      ["Notes", "hidden @[640px]:table-cell"],
                    ].map(([label, className]) => (
                      <th
                        key={label}
                        className={`sticky top-[calc(var(--fd-header-height,0px)+61px)] z-10 border-b border-rule-strong bg-surface px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted first:rounded-tl-md last:rounded-tr-md ${className}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((command) => {
                    const expandable = Boolean(detailsOf(command.code));
                    const expanded = expandable && open.has(command.code);
                    const detailsId = `details-${anchorOf(command.code)}`;
                    return (
                      <Fragment key={command.code}>
                        <tr
                          id={anchorOf(command.code)}
                          onClick={
                            expandable
                              ? (event) => {
                                  // Links and the button handle their own clicks
                                  if (
                                    (event.target as HTMLElement).closest(
                                      "a, button"
                                    )
                                  ) {
                                    return;
                                  }
                                  toggle(command.code);
                                }
                              : undefined
                          }
                          className={`scroll-mt-40 target:bg-accent-soft ${
                            expandable ? "cursor-pointer hover:bg-surface" : ""
                          } ${expanded ? "bg-surface" : ""}`}
                        >
                          <td className="border-b border-rule px-3 py-[7px] align-top">
                            <div className="flex items-center gap-1">
                              {expandable ? (
                                <button
                                  type="button"
                                  onClick={() => toggle(command.code)}
                                  aria-expanded={expanded}
                                  aria-controls={detailsId}
                                  aria-label={`${
                                    expanded ? "Hide" : "Show"
                                  } details for ${command.code}`}
                                  className="-ms-1.5 rounded p-0.5 text-muted hover:text-ink"
                                >
                                  <ChevronRight
                                    aria-hidden="true"
                                    className={`size-4 transition-transform motion-reduce:transition-none ${
                                      expanded ? "rotate-90" : ""
                                    }`}
                                  />
                                </button>
                              ) : (
                                <span className="-ms-1.5 w-5" />
                              )}
                              <a
                                href={`/docs/commands/${anchorOf(
                                  command.code
                                )}`}
                                className="font-mono text-sm font-semibold text-ink underline decoration-rule-strong underline-offset-[3px] hover:text-accent hover:decoration-accent"
                              >
                                {command.code}
                              </a>
                            </div>
                            <div className="flex flex-col ps-[18px] @[640px]:hidden">
                              <span className="text-[13.5px] text-muted">
                                {command.name}
                              </span>
                              {command.note && (
                                <span className="text-[12.5px] text-warn">
                                  {command.note}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="hidden border-b border-rule px-3 py-[7px] align-top @[640px]:table-cell">
                            <a
                              href={`/docs/commands/${anchorOf(command.code)}`}
                              className="hover:text-accent hover:underline"
                            >
                              {command.name}
                            </a>
                          </td>
                          <td className="border-b border-rule px-3 py-[7px] text-center align-top">
                            <Mark value={command.support as Support} />
                          </td>
                          <td className="hidden border-b border-rule px-3 py-[7px] align-top text-[13.5px] text-muted @[640px]:table-cell">
                            {command.note}
                          </td>
                        </tr>
                        {opened.has(command.code) && expandable && (
                          <tr id={detailsId} className="bg-surface">
                            <td
                              colSpan={4}
                              className={`border-b p-0 transition-colors duration-200 motion-reduce:transition-none ${
                                expanded ? "border-rule" : "border-transparent"
                              }`}
                            >
                              {/* Rows from 0fr to 1fr slide to the content's height */}
                              <div
                                inert={!expanded}
                                className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                                  expanded
                                    ? "grid-rows-[1fr]"
                                    : "grid-rows-[0fr]"
                                }`}
                              >
                                <div className="min-h-0 overflow-hidden px-3 @[640px]:ps-[42px]">
                                  <CommandSummary command={command} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {shown === 0 && (
          <p className="text-muted">No commands match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
