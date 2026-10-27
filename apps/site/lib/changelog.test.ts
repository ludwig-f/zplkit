import { describe, expect, test } from "vitest";
import { parseChangelog } from "./changelog";

const changelog = `# Changelog

## [2.0.0](https://github.com/ludwig-f/zplkit/compare/v1.0.5...v2.0.0) (2026-10-30)


### ⚠ BREAKING CHANGES

* rename the package

### Features

* **render:** draw Aztec codes ([1a2b3c4](https://github.com/ludwig-f/zplkit/commit/1a2b3c4d))
* name builder methods after what they draw ([5e6f7a8](https://github.com/ludwig-f/zplkit/commit/5e6f7a8b))


### Bug Fixes

* keep thin strokes in small text ([9c0d1e2](https://github.com/ludwig-f/zplkit/commit/9c0d1e2f))

## 1.0.0 (2024-03-18)


### Features

* first release
`;

describe("parseChangelog", () => {
  const releases = parseChangelog(changelog);

  test("reads each release, newest first", () => {
    expect(releases.map((r) => [r.version, r.date])).toStrictEqual([
      ["2.0.0", "2026-10-30"],
      ["1.0.0", "2024-03-18"],
    ]);
  });

  test("keeps the compare link when there is one", () => {
    expect(releases[0].url).toBe(
      "https://github.com/ludwig-f/zplkit/compare/v1.0.5...v2.0.0"
    );
    expect(releases[1].url).toBeUndefined();
  });

  test("groups changes under their headings, breaking changes first", () => {
    expect(releases[0].sections).toStrictEqual([
      { title: "Breaking changes", items: ["rename the package"] },
      {
        title: "Features",
        items: [
          "**render:** draw Aztec codes ([1a2b3c4](https://github.com/ludwig-f/zplkit/commit/1a2b3c4d))",
          "name builder methods after what they draw ([5e6f7a8](https://github.com/ludwig-f/zplkit/commit/5e6f7a8b))",
        ],
      },
      {
        title: "Bug fixes",
        items: [
          "keep thin strokes in small text ([9c0d1e2](https://github.com/ludwig-f/zplkit/commit/9c0d1e2f))",
        ],
      },
    ]);
  });
});
