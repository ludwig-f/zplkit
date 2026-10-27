/**
 * Reading the changelogs release-please writes: a "## [version](compare
 * link) (date)" heading per release, then "###" headings with a bullet per
 * change, in Markdown.
 */

type Section = { title: string; items: string[] };

type Release = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  /** Comparison with the previous release, if there is one */
  url?: string;
  sections: Section[];
};

/** Package folders in the repository */
type PackageDir = "zpl" | "render" | "preview";

const packageNames: Record<PackageDir, string> = {
  zpl: "@zplkit/core",
  render: "@zplkit/render",
  preview: "@zplkit/preview",
};

/** release-please's headings, in plain sentence case, breaking changes first */
const sectionTitles: Record<string, string> = {
  "⚠ BREAKING CHANGES": "Breaking changes",
  Features: "Features",
  "Bug Fixes": "Bug fixes",
  "Performance Improvements": "Performance",
  Reverts: "Reverts",
  Documentation: "Documentation",
};

const releaseHeading =
  /^## (?:\[([^\]]+)\]\(([^)]+)\)|([^\s(]+)) \((\d{4}-\d{2}-\d{2})\)/;

const parseChangelog = (markdown: string): Release[] => {
  const releases: Release[] = [];
  let release: Release | undefined;
  let section: Section | undefined;

  for (const line of markdown.split("\n")) {
    const heading = releaseHeading.exec(line);
    if (heading) {
      release = {
        version: heading[1] ?? heading[3],
        date: heading[4],
        url: heading[2],
        sections: [],
      };
      releases.push(release);
      section = undefined;
      continue;
    }
    if (!release) continue;

    if (line.startsWith("### ")) {
      const raw = line.slice(4).trim();
      section = { title: sectionTitles[raw] ?? raw, items: [] };
      release.sections.push(section);
    } else if (line.startsWith("* ") && section) {
      section.items.push(line.slice(2).trim());
    }
  }

  // Leave out headings without changes
  for (const r of releases) {
    r.sections = r.sections.filter((s) => s.items.length);
    if (!r.url) delete r.url;
  }
  return releases;
};

export type { PackageDir, Release, Section };
export { packageNames, parseChangelog };
