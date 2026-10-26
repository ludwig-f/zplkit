# Fonts

## Font 0

ZPL's font 0 is Zebra's CG Triumvirate Bold Condensed, which is licensed and can't be redistributed. `font0.ttf` stands in for it, and the `font0` option replaces it with a font file of your own:

- **Shapes:** [Archivo](https://github.com/Omnibus-Type/Archivo) Bold at width 66, licensed under the SIL Open Font License (`OFL.txt`). It was chosen by rendering text with 13 open-licensed condensed fonts and comparing dot by dot with reference renders of font 0; it had the highest overlap.
- **Spacing:** `font0-advances.json` holds font 0's advance width for each character at `^A0N,100,100`, measured from reference renders. Glyphs are stretched to these widths, so text takes up the same space as on a printer. Characters font 0 doesn't have print nothing but advance like a space (29.5), as on a printer.

`font0.ttf` was made from Archivo's variable font with fontTools:

```bash
fonttools varLib.instancer "Archivo[wdth,wght].ttf" wght=700 wdth=66 -o archivo.ttf
pyftsubset archivo.ttf --unicodes=<the characters in font0-advances.json> --no-hinting \
  --layout-features='' --drop-tables+=GSUB,GPOS,GDEF,STAT --name-IDs='*' --output-file=font0.ttf
```

`scripts/generate-fonts.mjs` embeds it in `src/fonts/font0.ts`.

## Fonts A to H

ZPL's bitmap fonts A to H have fixed character cells and can only be magnified in whole steps. Their letter shapes come from [DejaVu Sans Mono](https://dejavu-fonts.github.io/) (bold for font B), licensed under the Bitstream Vera and DejaVu license (`LICENSE-DejaVu.txt`). Each font's cell, gap and baseline come from Zebra's ZPL II Programming Guide; where the letters sit in the cell was measured from reference renders. The table is in `src/text.ts`.

`scripts/generate-fonts.mjs` embeds them in `src/fonts/dejavu.ts`.
