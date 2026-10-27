# @zplkit/core

[![npm](https://img.shields.io/npm/v/@zplkit/core)](https://www.npmjs.com/package/@zplkit/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Build, parse and lint ZPL, the language Zebra label printers speak, from TypeScript.

- **JSX and a typed builder**: write labels as JSX components or with method calls, in millimeters, inches or dots, with field data escaped for you.
- **Parser**: read existing ZPL into typed commands and write it back unchanged.
- **Linter**: catch the mistakes printers stay quiet about, like values they clamp and labels that never print.
- **No runtime dependencies** except two small image decoders, used only by `ImageConverter`.

Try it in the [playground](https://zplkit.fingal.dev/playground), or read the [docs](https://zplkit.fingal.dev/docs).

## Installation

```bash
npm install @zplkit/core
```

`@zplkit/core` is an ES module and needs Node 22 or newer. CommonJS projects can load it with `require()`, which Node supports for ES modules since 22.12. The builder, JSX, parser and linter also run in the browser.

## Usage

A label with some text and an EAN-13 barcode:

```typescript
import { Label, Orientation, mm, dots } from "@zplkit/core";

const zpl = new Label({ width: mm(57), height: mm(19), dpmm: 12 })
  .text({
    position: { x: mm(2), y: mm(2) },
    text: "Hello ^ world",
    font: { height: mm(4) },
  })
  .ean13({
    position: { x: mm(2), y: mm(8) },
    data: "123456789012",
    height: mm(7),
    orientation: Orientation.Normal,
  })
  .toZPL();
```

> [!TIP]
> To see what a label looks like, paste its ZPL into the [ZPL viewer](https://zplkit.fingal.dev/viewer), or render it to an image with [`@zplkit/render`](https://github.com/ludwig-f/zplkit/tree/main/packages/render).

### JSX

Labels can also be written as JSX. It compiles to the same commands as the builder, so everything else in this README applies. Set up TypeScript (or your bundler) to use `@zplkit/core` as the JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@zplkit/core"
  }
}
```

```tsx
import { Label, Text, Box, Code128, build, inches, mm, dots } from "@zplkit/core/jsx";
import type { Length } from "@zplkit/core";

const order = { id: 10442, barcode: "10442-B3", express: true };

const ReturnAddress = (props: { x: Length; y: Length }) => (
  <Text x={props.x} y={props.y} height={mm(3)}>Harbor Parts Co.</Text>
);

const zpl = build(
  <Label width={inches(4)} height={inches(2)} dpmm={8}>
    <ReturnAddress x={mm(5)} y={mm(5)} />
    <Text x={mm(5)} y={mm(14)} height={mm(4)}>
      Order #{order.id}
    </Text>
    <Box x={mm(5)} y={mm(21)} width={mm(91)} height={dots(3)} thickness={dots(3)} />
    <Code128 x={mm(5)} y={mm(25)} height={mm(13)}>{order.barcode}</Code128>
    {order.express && <Text x={mm(70)} y={mm(5)} height={mm(7)}>EXPRESS</Text>}
  </Label>
).toZPL();
```

`build()` returns the same `Label` object as the builder API, with `toZPL()`, `validate()` and `commands`. Text and barcode data go in children, `false`, `null` and `undefined` children are skipped, and lists from `.map()` work as you'd expect. Elements can be reused across labels with different resolutions, since millimeters are converted when the label is built.

#### In React projects

No setup is needed: label elements also work when compiled by React's JSX runtime, so labels can live next to your React components and use the same JSX settings. Components that return a `<Label>` can be passed to `build()` directly:

```tsx
const ShippingLabel = ({ order }: { order: Order }) => (
  <Label width={mm(50)} height={mm(25)} dpmm={8}>
    <Text x={mm(2)} y={mm(2)} height={mm(4)}>Order {order.id}</Text>
  </Label>
);

const zpl = build(<ShippingLabel order={order} />).toZPL();
```

Label components are plain functions that `build()` calls, not React components, so hooks and React context don't work inside them, and a `<Label>` can't be rendered into a React page.

### Units

Every length takes an explicit unit: `mm(10)` for millimeters, `inches(0.5)` for inches or `dots(80)` for printer dots, ZPL's native unit. Millimeters are converted to dots using the label's `dpmm` (dots per millimeter: 6, 8, 12 or 24 for 152, 203, 300 or 600 dpi printers), and inches using the printer's dpi, so `inches(6)` at 300 dpi is 1800 dots. Passing a bare number is a type error, so mixing up units can't happen by accident.

### Escaping

Field data such as text and bar code contents is escaped automatically. Characters that ZPL would otherwise read as commands (`^` and `~`) are hex-encoded using `^FH`, so user input can't break the label.

### Fields with any command

Elements without their own method can be drawn with `field`, which wraps any command in a field and escapes its data:

```typescript
label.field({ position: { x: mm(2), y: mm(2) }, command: "^B8N,100,Y,N", data: "1234567" });
```

### Commands as data

Labels are built from typed command nodes, which you can inspect with `label.commands`. Commands that have no builder method yet can be added as nodes with `label.add(...)`, or as raw ZPL with `label.raw(...)`:

```typescript
label.add({ type: "GraphicCircle", diameter: 80, thickness: 4 });
label.raw("^MMC"); // cut after each label
```

Copies, print speed and darkness are label options, since ZPL keeps them with the label they apply to: `new Label({ ..., copies: 3, speed: 4, darkness: 5 })`.

### Parsing ZPL

`parse` reads existing ZPL into the same command nodes, so you can inspect, check or modify labels you didn't build with `@zplkit/core`:

```typescript
import { parse, serialize } from "@zplkit/core";

const { commands, diagnostics } = parse("^XA^FO50,50^A0N,30^FDHello^FS^XZ");
// commands: [{ type: "StartFormat", span: { start: 0, end: 3 } }, { type: "FieldOrigin", x: 50, y: 50, ... }, ...]

serialize(commands); // "^XA^FO50,50^A0N,30^FDHello^FS^XZ"
```

- Every node has a `span` with its position in the input.
- Commands without a typed node yet are kept as `Raw` nodes, so nothing is lost.
- Commands with invalid parameters are kept as `Raw` nodes and reported in `diagnostics`. Text the printer skips, like the `G` in `^FSG`, is reported too.
- Prefix and delimiter changes (`^CC`, `^CT`, `^CD`) are applied while parsing, so `serialize` always writes standard `^`, `~` and `,`.

### Converting ZPL to code

`convert` turns existing ZPL into code that builds the same labels, as JSX or, with `{ style: "builder" }`, Label method calls:

```typescript
import { convert } from "@zplkit/core/convert";

convert("^XA^PW400^LL200^FO40,40^A0N,32^FDHello^FS^XZ");
// const label = build(
//   <Label width={mm(50)} height={mm(25)} dpmm={8}>
//     <Text x={mm(5)} y={mm(5)} font="0" height={mm(4)} orientation={Orientation.Normal}>Hello</Text>
//   </Label>
// );
```

Each field is checked by building it again, and anything without a matching element is kept as raw ZPL, so the converted label prints the same. Lengths are in millimeters when they convert back to exactly the same dots, and in dots otherwise.

### Linting

Printers don't report mistakes. They quietly clamp values, ignore commands or never print a label. `lint` finds these problems before you print:

```typescript
import { parse, lint } from "@zplkit/core";

lint(parse("^XA^FO10,10^GB1,64,2^FS^FO40,40^BE^FD123^FS").commands);
// [
//   { rule: "box-smaller-than-line", severity: "warning", index: 2, span: { start: 11, end: 20 },
//     message: "The box is 1 dot wide but its line is 2 dots thick, so the printer widens it to 2 dots." },
//   { rule: "ean13-data", severity: "warning", ... },
//   { rule: "missing-end-format", severity: "error", ... },
// ]
```

Labels built with `Label` or JSX can be checked with `label.lint()`. Pass the media size in dots, `lint(commands, { width: 812, length: 406 })`, to also check labels that don't set `^PW` and `^LL`.

| Rule | Severity | Finds |
| --- | --- | --- |
| `missing-start-format` | error | Commands before the first `^XA` |
| `missing-end-format` | error | A label that never ends with `^XZ` |
| `unclosed-field` | error | A field without `^FS` |
| `command-outside-format` | warning | Commands between `^XZ` and the next `^XA` |
| `separator-without-field` | warning | `^FS` without `^FO` or `^FT` |
| `field-outside-label` | warning | Fields that start outside the label |
| `box-smaller-than-line` | warning | Boxes narrower or shorter than their line |
| `value-out-of-range` | warning | Values outside what the printer accepts |
| `ean13-data` | warning | EAN-13 data that isn't 12 digits |
| `barcode-without-data` | warning | Barcodes without `^FD` |
| `unknown-command` | warning | Commands that don't exist in ZPL |
| `printer-command-in-label` | warning | Tilde commands like `~SD` inside a label, which act on the printer as soon as they're read |

### Printer setup and print jobs

`PrinterSetup` holds commands that change the printer itself, like its darkness or stored graphics, and `PrintJob` sends setup and labels together, in order:

```typescript
import { PrinterSetup, PrintJob } from "@zplkit/core";

const job = new PrintJob(new PrinterSetup().setDarkness(20), label);
job.toZPL(); // send this to the printer
job.lint(); // checks the whole job
```

### Images

`ImageConverter` turns a PNG or JPEG file into a ZPL graphic. It reads files with Node APIs, so it has its own entry point:

```typescript
import { Label, mm, dots } from "@zplkit/core";
import { ImageConverter } from "@zplkit/core/image";
import { readFileSync } from "fs";

const graphic = await new ImageConverter().toZPL(
  readFileSync("./assets/test-image.png")
);

const zpl = new Label({ width: mm(57), height: mm(19), dpmm: 12 })
  .graphic({ position: { x: dots(0), y: dots(0) }, graphic })
  .toZPL();
```

### Supported commands

<!-- commands:start (generated by scripts/commands.mjs) -->

zplkit currently supports 77 of the 175 commands in Zebra's ZPL II Programming Guide. Other commands are kept as they are by `parse()` and can be added with `raw()`. The [full reference](https://zplkit.fingal.dev/docs/commands) has notes on each command.

| Category | Supported |
| --- | --- |
| Labels and formats (17 of 19) | `^CC` `~CC` `^CD` `~CD` `^CT` `~CT` `^DF` `^LH` `^LL` `^LR` `^LS` `^LT` `^PO` `^PW` `^XA` `^XF` `^XZ` |
| Fields (9 of 14) | `^FD` `^FN` `^FO` `^FR` `^FS` `^FT` `^FV` `^FW` `^FX` |
| Text and fonts (9 of 13) | `^A` `^A@` `^CF` `^CI` `^CW` `~DT` `~DU` `^FB` `^FH` |
| Graphics and images (11 of 17) | `~DG` `~DY` `^GB` `^GC` `^GD` `^GE` `^GF` `^GS` `^ID` `^IL` `^XG` |
| Barcodes (27 of 30) | `^B0` `^B1` `^B2` `^B3` `^B5` `^B7` `^B8` `^B9` `^BA` `^BC` `^BD` `^BE` `^BF` `^BI` `^BJ` `^BK` `^BL` `^BM` `^BO` `^BP` `^BQ` `^BR` `^BS` `^BU` `^BX` `^BY` `^BZ` |
| Printer and media (4 of 82) | `^MD` `^PQ` `^PR` `~SD` |

<!-- commands:end -->

For a command without support yet, use `raw()`, which `Label` and `PrinterSetup` both have:

```typescript
import { PrinterSetup } from "@zplkit/core";

// Put a battery-powered printer to sleep after 10 seconds
const zpl = new PrinterSetup().raw("^ZZ10").toZPL();
```

## Contributing

Contributions are welcome, from bug reports to new commands. See [CONTRIBUTING.md](https://github.com/ludwig-f/zplkit/blob/main/CONTRIBUTING.md) to get started.

## License

[MIT](./LICENSE)
