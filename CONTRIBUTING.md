# Contributing to zplkit

Thanks for helping out! Bug reports, ideas, docs fixes and pull requests are all welcome.

## Reporting a bug or asking for a feature

[Open an issue](https://github.com/ludwig-f/zplkit/issues). For a label that comes out wrong, include the ZPL and what you expected; a photo of the printed label helps a lot.

For bigger changes, like a new package or API, open an issue to discuss it before writing the code.

## Setting up

You need Node 22 or newer and [pnpm](https://pnpm.io). With Corepack, `corepack enable` installs the pnpm version the repository uses.

```bash
git clone https://github.com/ludwig-f/zplkit.git
cd zplkit
pnpm install
pnpm build
pnpm test
```

The repository is a pnpm workspace:

| Folder | What's in it |
| --- | --- |
| `packages/zpl` | `@zplkit/core`: the builder, JSX, parser and linter |
| `packages/render` | `@zplkit/render`: the renderer |
| `packages/preview` | `@zplkit/preview`: the `<zpl-preview>` web component |
| `apps/site` | The docs site and playground, built with Next.js and Fumadocs |
| `scripts` | Scripts for the repository, like the generated command table |

Packages use each other's `build` folders, so run `pnpm build` after changing one that another depends on.

## Working on the code

```bash
pnpm test                         # all packages
pnpm --filter @zplkit/core test   # one package
pnpm lint
pnpm fix                          # format with Prettier
pnpm --filter @zplkit/site dev    # the docs site and playground
```

Write a test for each change, in the `*.test.ts` file next to the code. A commit hook runs the tests, ESLint and Prettier before each commit.

### Adding a command

A new ZPL command usually touches:

1. `packages/zpl/src/ast.ts`, `parse.ts` and `serialize.ts`, with a case in `src/__fixtures__/commands.ts` that tests both parsing and serializing.
2. A builder method in `Label.ts` and a JSX element in `jsx.ts`, if the command draws something.
3. The renderer in `packages/render`, and `src/support.ts` once it's drawn.

Then run `pnpm build && pnpm commands`, which updates the [supported commands table](https://zplkit.fingal.dev/reference) on the site and the core README. CI fails if it's out of date.

### Renderer accuracy

Renderer tests expect the exact dots a printer prints, measured from reference renders, so a change that moves a field by one dot fails a test.

When references disagree, Zebra's ZPL II Programming Guide or a real printout decides.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change with tests, and keep each pull request to one change.
3. Write commit messages as [Conventional Commits](https://www.conventionalcommits.org), like `fix(render): keep thin strokes in small text`. Release notes are generated from them, so `feat` and `fix` commits show up in the changelog.
4. Open the pull request against `main`. CI runs the linter, formatting check, build and tests.

A maintainer reviews it, and merges it once CI passes and it's approved.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). It keeps a release pull request open on `main` with the next versions and changelogs; merging it tags the releases and publishes the packages to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no token is stored in the repository.

To add a new package to releases:

1. Add it to `release-please-config.json` (with `"initial-version"` for its first version) and to `.release-please-manifest.json` at `"0.0.0"`.
2. Publish it once by hand, since npm only allows trusted publishing for packages that exist: `npm publish --access public --tag next` with a prerelease version.
3. Add the release workflow as its trusted publisher: `npm trust github <package> --file release-please.yaml --repo ludwig-f/zplkit --allow-publish`.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
