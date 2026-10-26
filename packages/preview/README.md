# @zplkit/preview

[![npm](https://img.shields.io/npm/v/@zplkit/preview)](https://www.npmjs.com/package/@zplkit/preview)

`<zpl-preview>` is a web component that shows ZPL labels as images. Rendering happens locally in the browser with [`@zplkit/render`](https://github.com/ludwig-f/zplkit/tree/main/packages/render), so label data never leaves the page. Because it's a standard custom element, it works the same in plain HTML, React, Vue, Svelte and Angular.

```bash
npm install @zplkit/preview
```

## Usage

Importing the package registers the element:

```html
<script type="module">
  import "@zplkit/preview";
</script>

<zpl-preview zpl="^XA^PW400^LL200^FO20,20^A0,40^FDHello^FS^XZ"></zpl-preview>
```

Set the `zpl` property instead of the attribute to pass a `Label` from [`@zplkit/core`](https://github.com/ludwig-f/zplkit/tree/main/packages/zpl#readme), or anything else with a `toZPL()` method:

```ts
import { Label, mm } from "@zplkit/core";
import "@zplkit/preview";

document.querySelector("zpl-preview").zpl = new Label({
  width: mm(50),
  height: mm(25),
  dpmm: 8,
}).text({
  position: { x: mm(3), y: mm(3) },
  text: "Hello",
  font: { height: mm(4) },
});
```

### Attributes and properties

| Attribute   | Property    | Default           | Description                                                                           |
| ----------- | ----------- | ----------------- | ------------------------------------------------------------------------------------- |
| `zpl`       | `zpl`       |                   | ZPL to show. The property also accepts objects with `toZPL()`.                        |
| `width`     | `width`     | `^PW`, else 4 in  | Label width in millimeters                                                            |
| `height`    | `height`    | `^LL`, else 6 in  | Label height in millimeters                                                           |
| `dpmm`      | `dpmm`      | 8                 | Dots per millimeter: 6, 8, 12 or 24 for 152, 203, 300 or 600 dpi                      |
| `smoothing` | `smoothing` | 0.4               | How much to smooth edges, from 0 (the printer's exact dots) to 1 (fully anti-aliased) |
| `fade`      | `fade`      | off               | Fade labels in when they first appear, over `--zpl-fade-duration` (200 ms by default) |
|             | `fonts`     |                   | Fonts stored on the printer, by path like `"E:ARIAL.TTF"`, as `Uint8Array`s           |
|             | `font0`     |                   | A font file to draw font 0 with instead of the open-licensed stand-in                 |

Thermal printers print hard-edged dots, which look rough on screen. `smoothing` softens the edges by blending the printer's dots with an anti-aliased render. Set it to 0 to see exactly what the printer prints.

ZPL with several labels shows one image per label. Changes made together, like setting `dpmm` and `zpl` one after the other, render once.

### Events

- `zpl-render-start`: a render started, with `event.detail.zpl`. Use it to show a loading state.
- `zpl-render`: `event.detail.images` holds the rendered PNGs as data URLs, with the label `width` and `height` in millimeters, the `dpmm` used and the `duration` in milliseconds.
- `zpl-error`: `event.detail.error` is the rendering error. The element also shows its message.

### Styling

The label images, the element around them and the error message are exposed as [parts](https://developer.mozilla.org/en-US/docs/Web/CSS/::part): `zpl-preview::part(label)`, `zpl-preview::part(labels)` and `zpl-preview::part(error)`.

## Loading the renderer

The renderer, with its fonts and barcode encoders, is loaded with a dynamic `import()` the first time a preview renders, so bundlers put it in a separate chunk and pages without previews never download it.

You can also use a different renderer entirely. It receives the ZPL, the size and whether anti-aliased output is wanted (`grayscale`), and returns one base64 PNG per label:

```ts
configure({
  render: async (zpl, { widthMm, heightMm, dpmm, grayscale }) => {
    // e.g. call your own rendering service
  },
});
```

## Frameworks

### React

React 19 passes props to custom elements as properties, so `zpl` can be a `Label`. Import `@zplkit/preview/react` to register the element and add its props to React's JSX types:

```tsx
import "@zplkit/preview/react";

<zpl-preview
  zpl={label}
  dpmm={8}
  onzpl-render={(event) => console.log(event.detail.images)}
/>;
```

React 18 sets everything on custom elements as attributes, so pass ZPL text there, or set the `zpl` property through a ref.

### Vue

Tell Vue that `zpl-preview` is a custom element (`compilerOptions.isCustomElement` in your Vue or Vite config), then bind the property with `.prop`:

```vue
<zpl-preview :zpl.prop="label" dpmm="8" @zpl-render="onRender" />
```

### Svelte

Svelte supports custom elements directly:

```svelte
<zpl-preview zpl={label} dpmm={8} on:zpl-render={onRender}></zpl-preview>
```

### Angular

Add `CUSTOM_ELEMENTS_SCHEMA` to the component's `schemas`, then bind the property:

```html
<zpl-preview
  [zpl]="label"
  dpmm="8"
  (zpl-render)="onRender($event)"
></zpl-preview>
```

## Server rendering

Importing the package where there is no DOM, such as during server rendering, is safe: the element is only registered in the browser.
