"use client";

import { useState } from "react";
import { InlineMarkdown } from "./inline-markdown";
import type { PackageRelease } from "@/lib/releases";

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 2026-10-24 as 24 Oct 2026, the same on the server and in every browser */
const formatDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
};

const filters = [
  { id: "all", label: "All packages" },
  { id: "zpl", label: "@zplkit/core" },
  { id: "render", label: "@zplkit/render" },
  { id: "preview", label: "@zplkit/preview" },
] as const;

/** Releases newest first, with a filter by package */
export function ReleaseList({ releases }: { releases: PackageRelease[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const shown = releases.filter((r) => filter === "all" || r.dir === filter);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="radiogroup"
        aria-label="Package"
        className="flex flex-wrap gap-2"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            role="radio"
            aria-checked={f.id === filter}
            onClick={() => setFilter(f.id)}
            className={`h-9 rounded border px-3 font-mono text-[13px] font-medium ${
              f.id === filter
                ? "border-ink bg-ink text-bg"
                : "border-rule-strong bg-raised text-ink hover:bg-surface"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col">
        {shown.map((release) => (
          <li
            key={`${release.dir}-${release.version}`}
            id={`${release.dir}-${release.version}`}
            className="grid scroll-mt-24 gap-x-10 gap-y-3 border-t border-rule py-8 @[720px]:grid-cols-[180px_minmax(0,1fr)]"
          >
            <div className="flex flex-col gap-1.5 font-mono text-[13px] text-muted">
              <time dateTime={release.date}>{formatDate(release.date)}</time>
              <span className="w-fit rounded-[3px] border border-rule-strong px-1.5 py-0.5 text-xs text-ink">
                {release.name}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.01em] [font-stretch:108%]">
                <a
                  href={`#${release.dir}-${release.version}`}
                  className="hover:text-accent"
                >
                  {release.version}
                </a>
              </h2>
              {release.sections.map((section) => (
                <section key={section.title} className="flex flex-col gap-2">
                  <h3
                    className={`font-mono text-xs font-semibold uppercase tracking-[0.06em] ${
                      section.title === "Breaking changes"
                        ? "text-err"
                        : "text-muted"
                    }`}
                  >
                    {section.title}
                  </h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-rule-strong">
                    {section.items.map((item, index) => (
                      <li key={index} className="leading-relaxed">
                        <InlineMarkdown text={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {release.url && (
                <a
                  href={release.url}
                  className="w-fit text-sm font-semibold text-accent hover:underline"
                >
                  Compare with the previous release →
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      {shown.length === 0 && (
        <p className="text-muted">No releases of this package yet.</p>
      )}
    </div>
  );
}
