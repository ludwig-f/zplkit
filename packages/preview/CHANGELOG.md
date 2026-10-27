# Changelog

## 0.1.0 (2026-10-27)


### ⚠ BREAKING CHANGES

* drawText, drawBox, drawGraphic, drawStoredGraphic, drawField and the drawCode128-style barcode methods are now text, box, graphic, storedGraphic, field, code11, code39, code128, ean13, interleaved2of5, pdf417, aztec, maxiCode, dataMatrix and qrCode.
* install @zplkit/core and import from "@zplkit/core", "@zplkit/core/jsx" and "@zplkit/core/image". JSX projects set jsxImportSource to "@zplkit/core".
* install zplkit instead of node-zpl, and import from "zplkit", "zplkit/jsx" and "zplkit/image". JSX projects set jsxImportSource to "zplkit".
* node-zpl and @node-zpl/preview need Node 22 or newer and no longer have separate CommonJS entries.

### Features

* API reference generated from the TypeScript types ([2744969](https://github.com/ludwig-f/zplkit/commit/274496961d4b2145faf080e63f8c95b210bd8327))
* example images in the reference, and more preview events ([e9d7356](https://github.com/ludwig-f/zplkit/commit/e9d735615a597b3ec87c088706d0a70ae13537af))
* fade previews in, and slide reference rows open the first time ([7a0b5f9](https://github.com/ludwig-f/zplkit/commit/7a0b5f96111f18499b63ec346f388ed98563c5fb))
* name builder methods after what they draw ([91781f4](https://github.com/ludwig-f/zplkit/commit/91781f411bf174dc82cfaca6d8a7b13427103c0d))
* **preview:** add &lt;zpl-preview&gt;, a web component that renders ZPL ([7e14620](https://github.com/ludwig-f/zplkit/commit/7e146205c1ed7bc36945c55c0d1baf3d88f0e0ae))
* **preview:** fonts and font0 properties on &lt;zpl-preview&gt; ([0534c6d](https://github.com/ludwig-f/zplkit/commit/0534c6d3c59770a7e3ef11fb7d3041070547e374))
* **preview:** render with @node-zpl/render ([6251e8a](https://github.com/ludwig-f/zplkit/commit/6251e8ae0be7585a1998ebccebff9e8559ab0471))
* **preview:** smooth label edges, adjustable with the smoothing attribute ([e4025d1](https://github.com/ludwig-f/zplkit/commit/e4025d1f79cffcd1b658d0b41590476798aef367))
* publish ES modules only and require Node 22 ([f4e189b](https://github.com/ludwig-f/zplkit/commit/f4e189b1d4aceae298bb071ae2c58a2bffd5f273))
* publish the main package as @zplkit/core ([d71720f](https://github.com/ludwig-f/zplkit/commit/d71720f787531f2feeaeddaeb1a70c9466678473))
* rename node-zpl to zplkit ([23d6525](https://github.com/ludwig-f/zplkit/commit/23d6525a96b64a951ab5a15780aecadb091bf996))
* **site:** docs site with the playground at zpl.fingal.dev ([f2ac552](https://github.com/ludwig-f/zplkit/commit/f2ac552d591e284d3f712b8446d95398454f5642))


### Bug Fixes

* convert inches with the printer's dpi ([bc89f63](https://github.com/ludwig-f/zplkit/commit/bc89f631bc4d254fc1c584c302ade9deec32b7e1))
* **preview:** render only once the element is in the page ([6567dc4](https://github.com/ludwig-f/zplkit/commit/6567dc4ad62823ad5dab73f6f2574d4ad7e4c036))
