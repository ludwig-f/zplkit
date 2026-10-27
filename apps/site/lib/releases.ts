import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { packageNames, parseChangelog } from "./changelog";
import type { PackageDir, Release } from "./changelog";

type PackageRelease = Release & { dir: PackageDir; name: string };

const dirs: PackageDir[] = ["zpl", "render", "preview"];

/**
 * Every package's releases, newest first, read from the changelogs
 * release-please keeps in the repository. The site is built from the
 * repository, so the page updates with each release.
 */
export async function getReleases(): Promise<PackageRelease[]> {
  const all = await Promise.all(
    dirs.map(async (dir) => {
      const file = path.join(
        process.cwd(),
        "../../packages",
        dir,
        "CHANGELOG.md"
      );
      const markdown = await readFile(file, "utf8").catch(() => "");
      return parseChangelog(markdown).map((release) => ({
        ...release,
        dir,
        name: packageNames[dir],
      }));
    })
  );
  return all
    .flat()
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        dirs.indexOf(a.dir) - dirs.indexOf(b.dir)
    );
}

export type { PackageRelease };
