# zplkit

[![npm](https://img.shields.io/npm/v/@zplkit/core?label=%40zplkit%2Fcore)](https://www.npmjs.com/package/@zplkit/core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

TypeScript tools for ZPL, the language Zebra label printers speak. Build labels with typed code or JSX, check them for the mistakes printers stay quiet about, and see them before you print.

**[Docs](https://zplkit.fingal.dev/docs)** live at [zplkit.fingal.dev](https://zplkit.fingal.dev), with two tools that run in the browser: the **[playground](https://zplkit.fingal.dev/playground)**, to write labels in code, and the **[ZPL viewer](https://zplkit.fingal.dev/viewer)**, to preview ZPL before it prints.

```tsx
import { Label, Text, Code128, build, mm } from "@zplkit/core/jsx";

const zpl = build(
  <Label width={mm(50)} height={mm(25)} dpmm={8}>
    <Text x={mm(3)} y={mm(3)} height={mm(4)}>Order 10442</Text>
    <Code128 x={mm(3)} y={mm(10)} height={mm(10)}>10442-B3</Code128>
  </Label>
).toZPL();
// ^XA^PW400^LL200^LRN^CI28^LH0,0^FO24,24^A0,32^FDOrder 10442^FS^FO24,80^BC,80^FD10442-B3^FS^XZ
```

## Packages

| Package | What it does |
| --- | --- |
| [`@zplkit/core`](./packages/zpl) | Build labels with method calls or JSX, and parse and lint existing ZPL |
| [`@zplkit/render`](./packages/render) | Render ZPL to images the way a printer draws it, in Node or the browser, in plain TypeScript |
| [`@zplkit/preview`](./packages/preview) | `<zpl-preview>`, a web component that shows ZPL as images in any framework |
| [`@zplkit/print`](./packages/print) | Send labels to printers and read their status, over the network, USB or Bluetooth (experimental) |
| [`@zplkit/cli`](./packages/cli) | The `zplkit` command: render, lint, convert, view and print labels from a terminal |

## Contributing

Bug reports, ideas and pull requests are welcome. [CONTRIBUTING.md](./CONTRIBUTING.md) explains how to set up the repository and run the tests.

## License

[MIT](./LICENSE)
