---
name: zpl-labels
description: Write, check and render Zebra printer labels (ZPL) with zplkit. Use when creating or changing shipping, product or barcode labels for Zebra printers, writing or fixing ZPL, converting ZPL to code, or working with @zplkit packages. Covers building labels in TypeScript or JSX, units and resolution, barcodes, serial numbers, printer settings, and checking labels by linting and rendering them.
---

# Zebra labels with zplkit

zplkit builds, checks and renders ZPL, the language Zebra label printers speak. Use it instead of writing ZPL strings by hand: it picks the right commands, converts units, escapes text and catches mistakes printers don't report.

Docs: https://zplkit.fingal.dev/docs, and for reading in full, https://zplkit.fingal.dev/llms-full.txt.

## Build labels in code

Install `@zplkit/core`. Write labels as JSX (`@zplkit/core/jsx`) or with `Label` method calls; both make the same ZPL. Match the style the project already uses.

```tsx
import { Label, Text, Code128, build, inches, mm } from "@zplkit/core/jsx";

const zpl = build(
  <Label width={inches(4)} height={inches(2)} dpmm={8}>
    <Text x={mm(5)} y={mm(5)} height={mm(7)}>
      Harbor Parts Co.
    </Text>
    <Code128 x={mm(5)} y={mm(20)} height={mm(13)}>
      10442-B3
    </Code128>
  </Label>
).toZPL();
```

```ts
import { Label, inches, mm } from "@zplkit/core";

const zpl = new Label({ width: inches(4), height: inches(2), dpmm: 8 })
  .text({ position: { x: mm(5), y: mm(5) }, text: "Harbor Parts Co.", font: { height: mm(7) } })
  .code128({ position: { x: mm(5), y: mm(20) }, data: "10442-B3", height: mm(13) })
  .toZPL();
```

- **Units.** Every length needs a unit: `mm()`, `inches()` or `dots()`. Bare numbers are a type error.
- **Resolution.** `dpmm` is the printer's: 6, 8, 12 or 24 for 152, 203, 300 or 600 dpi. Ask if it isn't known; 8 (203 dpi) is the most common. The same label at the wrong `dpmm` prints at the wrong size.
- **Text** is escaped for you, so user data is safe in `text` and barcode `data`. Never put user data in `raw()`, which adds ZPL as written.
- **Font 0** is the printer's scalable font, and the default. `height` is the character height; capitals are about three quarters of it.
- **Barcodes:** `code128` for general data, `ean13` (12 digits; the printer adds the check digit), `qrCode`, `dataMatrix` and about 30 more. Bars are 2 dots wide unless `^BY` changes it, with `label.add({ type: "BarcodeDefaults", moduleWidth: 3 })` before the barcode.
- **Shapes:** `box` (also lines, with one side as thin as the line), `ellipse`, `circle`.
- **Text options:** `block` wraps text in a box, `direction` prints it down or right to left, `clock: true` fills in `%Y-%m-%d %H:%M` from the printer's clock.
- **Copies and serial numbers:** `copies` on the label prints it more than once; `serial: {}` on text or a barcode counts the number at its end up on each copy (`BOX-001`, `BOX-002`…).
- **Anything else:** `field({ position, command: "^…", data })` wraps any command in a field and escapes its data. The ZPL command reference is at https://zplkit.fingal.dev/docs/commands.

## Settings that stay on the printer

`PrinterSetup` is for what changes the printer for every label after it, also labels sent later from other software: darkness (`setDarkness`), moving every label (`setLabelShift`, `setLabelTop`), mirroring (`setMirror`), and stored graphics and fonts. Don't put these in a label. Settings for one label, like `copies`, `speed` and `darkness`, are `Label` options. `PrintJob` sends setup and labels together.

## Check every label

Labels can't be tested without printing, so check them before saying they're done:

1. **Lint** for problems the printer won't report: unclosed fields, values out of range, fields outside the label, settings left on the printer. Fix errors, and fix or explain warnings.
2. **Render** and look at the image: is everything there, inside the label, readable, the right size?

With the zplkit MCP server, use `lint_zpl` and `render_zpl` (which returns the image). Without it, use the CLI:

```bash
npx @zplkit/cli lint label.zpl
npx @zplkit/cli render label.zpl -o label.png  # then look at label.png
```

In code, `label.lint()` returns the same problems.

Commands the renderer doesn't draw yet are named when rendering; say so instead of guessing what they print. For people to look at a label themselves, `viewer_link` (or `npx @zplkit/cli view label.zpl`) opens it in the web viewer.

## Existing ZPL

To work on ZPL someone already has, convert it to zplkit code with `convert_zpl` or `npx @zplkit/cli convert label.zpl`, then edit the code. The code makes the same label; commands without a method stay as `field()` or `raw()`.

To look up a command (`^FO`, `^BC`, `~DG`…), use `lookup_command` or the reference at https://zplkit.fingal.dev/docs/commands rather than recalling its parameters.

## Printing

`@zplkit/print` sends labels to network printers (port 9100) from Node, and over USB and Bluetooth from the browser. It's experimental. Only print when asked to: it makes real labels. Check the printer's status first, as `print_zpl` and `npx @zplkit/cli print` do.

## Pitfalls

- **Position:** `x` and `y` are a field's top left corner, measured from the label home. Keep fields inside the label width and height; lint warns when one starts outside.
- **Size:** the label's `width` and `height` set `^PW` and `^LL`. Printers with wider media center a narrower `^PW`.
- **Text that doesn't fit** runs off the label; use `block` with a width to wrap it.
- **Non-English letters:** labels use UTF-8 (`^CI28`), so Ł, Ø or Ş print in font 0. Greek, Cyrillic and other scripts need a font file on the printer (`font: { file: "E:ARIAL.TTF" }`).
- **Rotated fields:** use `orientation` on the font or barcode, or `setFieldOrientation`; positions are still the field's top left corner.
