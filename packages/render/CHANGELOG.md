# Changelog

## [0.2.0](https://github.com/ludwig-f/zplkit/compare/render-v0.1.0...render-v0.2.0) (2026-10-28)


### Features

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

* **render:** center ^FB lines like printers when the space doesn't fit ([6c1e893](https://github.com/ludwig-f/zplkit/commit/6c1e8933cf26512294bae72be651a619a586dbc9))
* **render:** right-justify fields with ^FO, ^FT and ^FW ([9b8c928](https://github.com/ludwig-f/zplkit/commit/9b8c928e0bda848bee4da5f7f2171d4d1474fa7c))
* **render:** space single-row GS1 DataBar Expanded as printers do ([c0a47a2](https://github.com/ludwig-f/zplkit/commit/c0a47a2f0c69ed169e01099af99a6c6987c89d28))

## 0.1.0 (2026-10-27)


### Features

* add ^FW to the builder and JSX ([639e3fe](https://github.com/ludwig-f/zplkit/commit/639e3fed800049b36ee77b498484ff37267750da))
* API reference generated from the TypeScript types ([2744969](https://github.com/ludwig-f/zplkit/commit/274496961d4b2145faf080e63f8c95b210bd8327))
* clearer command reference, JSX first, and warnings for ignored text ([193d5dc](https://github.com/ludwig-f/zplkit/commit/193d5dcbc6a4064b0b24a242dba5688fd6b47faa))
* EAN-8, UPC-A, UPC-E, UPC/EAN add-ons, Code 93, Codabar and ^B0 ([00b8a23](https://github.com/ludwig-f/zplkit/commit/00b8a23d9210a7e0a0722da3eaffdd8235a08662))
* Industrial and Standard 2 of 5, LOGMARS, MSI and Plessey ([0d9623f](https://github.com/ludwig-f/zplkit/commit/0d9623f3c69ac5fff97a2f44618713beae3d1fd7))
* POSTNET, PLANET, Intelligent Mail, GS1 DataBar and MicroPDF417 ([208c0de](https://github.com/ludwig-f/zplkit/commit/208c0deefd2998f279c6ae6892c2c2f325e39120))
* **preview:** render with @zplkit/render ([6251e8a](https://github.com/ludwig-f/zplkit/commit/6251e8ae0be7585a1998ebccebff9e8559ab0471))
* publish the main package as @zplkit/core ([d71720f](https://github.com/ludwig-f/zplkit/commit/d71720f787531f2feeaeddaeb1a70c9466678473))
* **render:** draw Aztec, MaxiCode and graphic symbols ([f99a690](https://github.com/ludwig-f/zplkit/commit/f99a690a9bc45755c8af30b92fbea96044e9ee9b))
* **render:** draw bitmap fonts A to H ([9a9c42d](https://github.com/ludwig-f/zplkit/commit/9a9c42d1da141f6ecee999732734e4b1baf97f46))
* **render:** draw Code 128 barcodes ([ff2e5a0](https://github.com/ludwig-f/zplkit/commit/ff2e5a0d30378d0d06795328a43c21c19569405f))
* **render:** draw Code 39, Interleaved 2 of 5 and PDF417 ([e50c87b](https://github.com/ludwig-f/zplkit/commit/e50c87b159340a5ff8c234b0a2f9e144e2bdefae))
* **render:** draw EAN-13, Code 11, QR and Data Matrix barcodes ([f2ad673](https://github.com/ludwig-f/zplkit/commit/f2ad673f67d7854e5fef5e45cc849e859ae26d2f))
* **render:** draw font 0 with your own font file ([7d2bc11](https://github.com/ludwig-f/zplkit/commit/7d2bc11789bb8280eb44f8f1048701af89599c82))
* **render:** draw text in downloaded and passed-in TrueType fonts ([e3134e8](https://github.com/ludwig-f/zplkit/commit/e3134e8f4a87a519da0ce52e6447a43989043bfb))
* **render:** draw text in font 0 ([fedd961](https://github.com/ludwig-f/zplkit/commit/fedd961a78f85276c04f259a324a43262b2481f0))
* **render:** render boxes, circles, diagonals and images in TypeScript ([b010dac](https://github.com/ludwig-f/zplkit/commit/b010dac257e94b0a34c5b11264f6989e33cc2698))
* **render:** rotate text with ^A orientations and ^FW ([3619eaa](https://github.com/ludwig-f/zplkit/commit/3619eaa5b65ada2a7a3dec56ca1b37a545b84125))
* **render:** show a placeholder for barcodes it can't draw yet ([45a9831](https://github.com/ludwig-f/zplkit/commit/45a98317125f59bda84a2e49512404474461224b))
* **render:** stored formats, ^PO, ^FV and ^IL ([54612e3](https://github.com/ludwig-f/zplkit/commit/54612e3e6fcd9685774f7d49bf1577240deea769))
* **render:** wrap text in ^FB blocks ([58f473a](https://github.com/ludwig-f/zplkit/commit/58f473a580ca35d326bab79f6f77166011ec9046))
* **site:** give the command reference its own page and keep the site header on docs ([0cf450e](https://github.com/ludwig-f/zplkit/commit/0cf450e2f2707da3e234dda8bc2ac3a23f730093))
* **site:** ZPL commands become part of the docs ([1d1b409](https://github.com/ludwig-f/zplkit/commit/1d1b4090ba2b52f326aa4546b751d2de5f0dd3be))


### Bug Fixes

* **render:** keep thin strokes in small text ([865ffdc](https://github.com/ludwig-f/zplkit/commit/865ffdc119f84d0f6851d80776b9ac4bd4cdf19a))
* **render:** print font 0's marks where a printer puts their ink ([1ce3ba0](https://github.com/ludwig-f/zplkit/commit/1ce3ba0851932ba59291cf47ceaeb716878acc45))
* **render:** read base64 image data (:B64: and :Z64:) ([a246fcd](https://github.com/ludwig-f/zplkit/commit/a246fcdc57d4c5fd38bb422867c57510d7bceafa))
* **render:** refuse labels too large to render ([05f5772](https://github.com/ludwig-f/zplkit/commit/05f5772e6ee1e3e6419ab5460fcc9e5fd7edb8c6))
* **render:** size placeholders for their text, and name invalid parameters ([96d467c](https://github.com/ludwig-f/zplkit/commit/96d467cf0d4e886ec8e5ac14031bab740f2812a3))


### Performance Improvements

* **render:** bundle only the bwip-js encoders we use ([bfae224](https://github.com/ludwig-f/zplkit/commit/bfae2243ac51b03408ae88e01f7b4b4cc47d5a27))
* **render:** only scan the rows a shape covers with printer dots ([39ebd59](https://github.com/ludwig-f/zplkit/commit/39ebd591111a03326e8a078fa1b700084974947b))
