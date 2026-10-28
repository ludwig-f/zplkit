# Changelog

## [2.2.0](https://github.com/ludwig-f/zplkit/compare/v2.1.0...v2.2.0) (2026-10-28)


### Features

* **core:** format() lays out ZPL to read ([cb01d7d](https://github.com/ludwig-f/zplkit/commit/cb01d7d3b5cad0bf0e5de02c467da08321798574))

## [2.1.0](https://github.com/ludwig-f/zplkit/compare/v2.0.0...v2.1.0) (2026-10-28)


### Features

* **core:** build ellipses, circles, serial numbers and text options ([f251790](https://github.com/ludwig-f/zplkit/commit/f251790bf8bae953e815f93fc42b092518418bb3))
* **core:** warn when a label leaves settings on the printer ([e5eb7d0](https://github.com/ludwig-f/zplkit/commit/e5eb7d0d2666955e30b0b7ca2a922c8988c9ae41))
* draw ellipses with ^GE ([2a1156a](https://github.com/ludwig-f/zplkit/commit/2a1156aa947f279c0ab0db0e6e1c4bc254dce874))
* draw stored graphics with ^IM ([919f068](https://github.com/ludwig-f/zplkit/commit/919f0683f8d75e8138453666549193e9cc1eefd8))
* fill in dates and times with ^FC ([b64be3f](https://github.com/ludwig-f/zplkit/commit/b64be3f45d9c05dcd4465e0e2773d8b2104391fc))
* measure in millimeters or inches with ^MU ([753fc52](https://github.com/ludwig-f/zplkit/commit/753fc5229e6cf82b6c14248000a481b342deb096))
* print mirror images with ^PM ([b320d29](https://github.com/ludwig-f/zplkit/commit/b320d291783a83b61599d5f6f8a89ff07e3d130d))
* print text down, right to left or spaced out with ^FP ([ebb21fa](https://github.com/ludwig-f/zplkit/commit/ebb21fa9f369107b3ac38c918be7e2cdfb1b3f74))
* render copies and serial numbers with ^PQ, ^SN and ^SF ([aa470bf](https://github.com/ludwig-f/zplkit/commit/aa470bfeae9f2a44df645a5a8f6ddbae3fdf6bd5))
* shift labels with ^LS and ^LT ([ae249c2](https://github.com/ludwig-f/zplkit/commit/ae249c27970954a512f129db08e1a42e2e5d2f86))
* wrap text in ^TB text blocks ([edd54ae](https://github.com/ludwig-f/zplkit/commit/edd54ae7a1ef4610bca19153860678fff9f0674f))


### Bug Fixes

* **core:** ignore spaces around parameters, as printers do ([84ecf20](https://github.com/ludwig-f/zplkit/commit/84ecf2099e4bf7afc17d980bfa7d6c60ef190c41))
* **core:** keep labels in millimeters or inches as ZPL when converting ([0cef70e](https://github.com/ludwig-f/zplkit/commit/0cef70e3b6b5426309e8f00eb7b4d73d4f1c16af))
* **render:** space single-row GS1 DataBar Expanded as printers do ([c0a47a2](https://github.com/ludwig-f/zplkit/commit/c0a47a2f0c69ed169e01099af99a6c6987c89d28))

## [2.0.0](https://github.com/ludwig-f/zplkit/compare/v1.0.5...v2.0.0) (2026-10-27)


### ⚠ BREAKING CHANGES

* drawText, drawBox, drawGraphic, drawStoredGraphic, drawField and the drawCode128-style barcode methods are now text, box, graphic, storedGraphic, field, code11, code39, code128, ean13, interleaved2of5, pdf417, aztec, maxiCode, dataMatrix and qrCode.
* ImageConverter no longer reads BMP, GIF or TIFF files.
* install @zplkit/core and import from "@zplkit/core", "@zplkit/core/jsx" and "@zplkit/core/image". JSX projects set jsxImportSource to "@zplkit/core".
* Node 22 or newer is required, and there are no longer separate CommonJS entries.
* Label and PrinterSetup take options objects with mm() and dots() lengths, drawGraphic takes a graphic object, drawDataMatrix's height is now moduleSize, storeGraphics is now storeGraphic, startField and endField are replaced by add(), and ImageConverter is imported from @zplkit/core/image.

### Features

* add ^FW to the builder and JSX ([639e3fe](https://github.com/ludwig-f/zplkit/commit/639e3fed800049b36ee77b498484ff37267750da))
* API reference generated from the TypeScript types ([2744969](https://github.com/ludwig-f/zplkit/commit/274496961d4b2145faf080e63f8c95b210bd8327))
* build labels on a typed ZPL command AST ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* clearer command reference, JSX first, and warnings for ignored text ([193d5dc](https://github.com/ludwig-f/zplkit/commit/193d5dcbc6a4064b0b24a242dba5688fd6b47faa))
* Code 39, Interleaved 2 of 5 and PDF417 barcodes ([2760453](https://github.com/ludwig-f/zplkit/commit/276045375af396a89b9d2c5cca53979626935f17))
* convert ZPL to zplkit code ([f36cb90](https://github.com/ludwig-f/zplkit/commit/f36cb90d24062dcc6794e24e945aae283022e201))
* copies, speed and darkness as label options, and a lint rule for printer commands ([fc84627](https://github.com/ludwig-f/zplkit/commit/fc84627e56bbd4526adc3d3b14973d8226b7a5e8))
* **core:** add inches() for lengths in inches ([b59f418](https://github.com/ludwig-f/zplkit/commit/b59f418a282aef1263427f7dc9d19b4882ef4850))
* **core:** make Label's dpmm public ([6b9b6cc](https://github.com/ludwig-f/zplkit/commit/6b9b6ccc6efb9cda734bef8221f9484fe76348e7))
* decode images with pngjs and jpeg-js instead of jimp ([5ae012a](https://github.com/ludwig-f/zplkit/commit/5ae012a136afa87d4795c147dda73410d40e6701))
* draw QR codes, and fields with any command ([af1d3fc](https://github.com/ludwig-f/zplkit/commit/af1d3fc9054e91f4415a192314a1d44e692a2edb))
* EAN-8, UPC-A, UPC-E, UPC/EAN add-ons, Code 93, Codabar and ^B0 ([00b8a23](https://github.com/ludwig-f/zplkit/commit/00b8a23d9210a7e0a0722da3eaffdd8235a08662))
* example images in the reference, and more preview events ([e9d7356](https://github.com/ludwig-f/zplkit/commit/e9d735615a597b3ec87c088706d0a70ae13537af))
* font files with ^A@, ^CW, ~DU, ~DT and ~DY ([73d7767](https://github.com/ludwig-f/zplkit/commit/73d7767536bf4b5f3ac971558f7107c29281ce54))
* Industrial and Standard 2 of 5, LOGMARS, MSI and Plessey ([0d9623f](https://github.com/ludwig-f/zplkit/commit/0d9623f3c69ac5fff97a2f44618713beae3d1fd7))
* lint labels for problems printers don't report ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* make label JSX work with React's JSX runtime ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* name builder methods after what they draw ([91781f4](https://github.com/ludwig-f/zplkit/commit/91781f411bf174dc82cfaca6d8a7b13427103c0d))
* parse ZPL into command nodes ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* **parse:** parse ^FW field orientation ([63f00ca](https://github.com/ludwig-f/zplkit/commit/63f00cad2c02be4552663f7e3ac43a06c4015391))
* POSTNET, PLANET, Intelligent Mail, GS1 DataBar and MicroPDF417 ([208c0de](https://github.com/ludwig-f/zplkit/commit/208c0deefd2998f279c6ae6892c2c2f325e39120))
* PrintJob, for setup and labels sent together ([85c3351](https://github.com/ludwig-f/zplkit/commit/85c3351190249f75259e63624ed7237457aea923))
* publish ES modules only and require Node 22 ([f4e189b](https://github.com/ludwig-f/zplkit/commit/f4e189b1d4aceae298bb071ae2c58a2bffd5f273))
* publish the main package as @zplkit/core ([d71720f](https://github.com/ludwig-f/zplkit/commit/d71720f787531f2feeaeddaeb1a70c9466678473))
* **site:** a playground for zplkit code ([ec6000b](https://github.com/ludwig-f/zplkit/commit/ec6000b5e93117f8d04c5848320d1dc9d26db82d))
* **site:** docs site with the playground at zplkit.fingal.dev ([f2ac552](https://github.com/ludwig-f/zplkit/commit/f2ac552d591e284d3f712b8446d95398454f5642))
* **site:** give the command reference its own page and keep the site header on docs ([0cf450e](https://github.com/ludwig-f/zplkit/commit/0cf450e2f2707da3e234dda8bc2ac3a23f730093))
* **site:** move the playground to /viewer ([2f16880](https://github.com/ludwig-f/zplkit/commit/2f168800bde8fad84930d21794c06f223211435c))
* **site:** tool cards on the home page, inch-sized examples ([124dcf1](https://github.com/ludwig-f/zplkit/commit/124dcf157fc68eaa476289a25b0f199bbe287af0))
* **site:** ZPL commands become part of the docs ([1d1b409](https://github.com/ludwig-f/zplkit/commit/1d1b4090ba2b52f326aa4546b751d2de5f0dd3be))
* templates, print orientation, symbols, Aztec and MaxiCode ([89edd8f](https://github.com/ludwig-f/zplkit/commit/89edd8fb9bb5912878a94ecdeef87789ddabd711))
* write labels as JSX ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))


### Bug Fixes

* convert inches with the printer's dpi ([bc89f63](https://github.com/ludwig-f/zplkit/commit/bc89f631bc4d254fc1c584c302ade9deec32b7e1))
* **core:** reject resolutions printers don't have ([322a615](https://github.com/ludwig-f/zplkit/commit/322a6151d4f2a2342a7e73a784be5ea867e92862))
* **core:** say what's missing when a label has no dpmm or a length ([72b41e6](https://github.com/ludwig-f/zplkit/commit/72b41e65599c8fb03133ea96a74f3b80b7fbda3c))
* draw boxes in black by default instead of white ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* escape ^ and ~ in field data with ^FH ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))
* stop toZPL from adding a second ^XZ when minify is off ([5d0a491](https://github.com/ludwig-f/zplkit/commit/5d0a491227a21752873deaadd173d4eb769c447c))

## [1.0.5](https://github.com/ludwig-f/zplkit/compare/v1.0.4...v1.0.5) (2024-03-19)


### Bug Fixes

* improve validation ([a2e4682](https://github.com/ludwig-f/zplkit/commit/a2e46822ab939bf04dedbf19d8c133dd677e1341))

## [1.0.4](https://github.com/ludwig-f/zplkit/compare/v1.0.3...v1.0.4) (2024-03-19)


### Bug Fixes

* fix broken esm config ([119cb9a](https://github.com/ludwig-f/zplkit/commit/119cb9a145f72044e6fc5b7d64e45d888fe096da))

## [1.0.3](https://github.com/ludwig-f/zplkit/compare/v1.0.2...v1.0.3) (2024-03-19)


### Bug Fixes

* fix broken default imports (hopefully) ([b2aede8](https://github.com/ludwig-f/zplkit/commit/b2aede82a3487c76d74c8daa51bc7fc8414259c3))

## [1.0.2](https://github.com/ludwig-f/zplkit/compare/v1.0.1...v1.0.2) (2024-03-18)


### Bug Fixes

* actually build project before publishing it 🤦 ([54391c6](https://github.com/ludwig-f/zplkit/commit/54391c62594b2935c6a43a7afeca771d3a4f466a))

## [1.0.1](https://github.com/ludwig-f/zplkit/compare/v1.0.0...v1.0.1) (2024-03-18)


### Bug Fixes

* fix invalid files ref in package.json ([21202e5](https://github.com/ludwig-f/zplkit/commit/21202e5889a30d75cd32eecfd86013de6abe8d3b))

## 1.0.0 (2024-03-18)


### Features

* create main package ([45a9b46](https://github.com/ludwig-f/zplkit/commit/45a9b464120a5d88e07a66592d7c1df4466c0367))
