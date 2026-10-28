# @zplkit/cli

Render, preview, lint, convert, view and print ZPL labels from the command line.

```bash
npx @zplkit/cli render label.zpl
```

Or install it to get the `zplkit` command:

```bash
npm install --global @zplkit/cli
```

It needs Node 22 or newer.

## Commands

### render

Renders each label to a PNG, with zplkit's own renderer. The size comes from `^PW` and `^LL`, or `--width` and `--height`; the resolution from `--dpi` (203 if not given).

```bash
zplkit render label.zpl                      # label.png
zplkit render label.zpl -o out.png --dpi 300 # out.png at 300 dpi
zplkit render label.zpl --width 4in --height 2in
cat label.zpl | zplkit render - -o label.png # from standard input
```

Labels with serial numbers (`^SN`, `^SF`) render one PNG per copy, like `label-1.png`, `label-2.png`; `--limit 10` renders the first ten. Copies that are all the same render once. `--clock 2026-10-28T08:00` sets the time for `^FC` dates, and `--smooth` smooths edges instead of drawing the printer's exact dots.

### preview

Renders the labels into a temporary folder and opens them in your image viewer, like Preview on macOS or Photos on Windows, without a browser or a network connection. It takes the same options as `render`, and opens the first 20 different labels unless `--limit` says otherwise.

```bash
zplkit preview label.zpl --dpi 300
```

### lint

Lists problems the printer won't report, with their line and column. It exits with 1 when there's an error, or any problem with `--strict`, so it can check labels in CI.

```bash
zplkit lint labels/*.zpl
# labels/box.zpl:3:1  warning  ^PM stays on for the labels printed after this one…  setting-kept-after-label
```

### convert

Turns ZPL into zplkit code: JSX, or builder calls with `--style builder`.

```bash
zplkit convert label.zpl --style builder > label.ts
```

### view

Opens the label in the [zplkit viewer](https://zplkit.fingal.dev/viewer). The ZPL goes in the link, after the `#`, so it isn't sent to a server. `--no-open` only prints the link.

### print and status

Sends labels to a network printer on port 9100, or another port after a colon. It asks the printer's status first and sends nothing if it isn't ready; `--no-check` skips that. `status` only asks.

```bash
zplkit print label.zpl --printer 192.168.1.50
zplkit status --printer printer.local:6101
# printer.local isn't ready: out of labels
```

> [!WARNING]
> Printing uses [`@zplkit/print`](https://www.npmjs.com/package/@zplkit/print), which is experimental: it's built from Zebra's documentation and not yet tested against real printers.

Run `zplkit --help` for every option.
