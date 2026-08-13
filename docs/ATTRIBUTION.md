# Third-Party Attribution

## Fonts

All five families are open-licensed and may be embedded in generated PDFs. That is the entire point of choosing them — see [D1](DECISIONS.md#d1--metric-compatible-ofl-fonts). The proprietary faces they stand in for (Arial, Calibri, Times New Roman, Georgia) **may not** be embedded, because generating a PDF redistributes the font binary.

| Family        | License | Metric twin of         | Source                                                                                      |
| ------------- | ------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| Arimo         | OFL 1.1 | Arial / Helvetica      | [google/fonts `ofl/arimo`](https://github.com/google/fonts/tree/main/ofl/arimo)             |
| Tinos         | OFL 1.1 | Times New Roman        | [google/fonts `ofl/tinos`](https://github.com/google/fonts/tree/main/ofl/tinos)             |
| Carlito       | OFL 1.1 | Calibri                | [google/fonts `ofl/carlito`](https://github.com/google/fonts/tree/main/ofl/carlito)         |
| EB Garamond   | OFL 1.1 | — (reference Garamond) | [google/fonts `ofl/ebgaramond`](https://github.com/google/fonts/tree/main/ofl/ebgaramond)   |
| IBM Plex Sans | OFL 1.1 | —                      | [google/fonts `ofl/ibmplexsans`](https://github.com/google/fonts/tree/main/ofl/ibmplexsans) |

License texts are committed beside the font binaries in `src/lib/fonts/files/` as `<Family>-OFL.txt`, together with each family's upstream `METADATA.pb`, which carries the authoritative license declaration and copyright line.

**Note on Tinos:** its `google/fonts` directory ships no license file, unlike the other four. `METADATA.pb` declares `license: "OFL"`, and the text committed here comes from the upstream project at [googlefonts/tinos](https://github.com/googlefonts/tinos). Recorded because it is an upstream inconsistency someone will otherwise re-discover.

### How the files were produced

`pnpm fonts:fetch` (see [`scripts/fetch-fonts.mjs`](../scripts/fetch-fonts.mjs)) downloads each face from the Google Fonts CSS API and subsets it. Two details are load-bearing:

1. **A vintage user-agent string.** react-pdf cannot select a weight from a variable font, and three of the five families ship only variable TTFs upstream. The Google Fonts API instantiates static faces server-side, but which _format_ it returns depends on the requesting user-agent — MSIE 6 gets EOT, Safari 5.1 and Firefox 27 get WOFF, anything modern gets WOFF2. Only a Safari 4-era string yields plain TTF. Do not modernise it.

2. **Subsetting to `src/lib/fonts/charset.json`.** Full faces total ~6 MB. Because the preview renders the real PDF in the browser (D2), the user downloads these files, so that is not shippable. Subsetting brings the set to ~2.7 MB, and only the selected pair loads at runtime. The glyph coverage test reads the same JSON, so the subset cannot silently drop a character we claim to support.

### Script coverage — a known gap

The charset covers Latin (Basic, Latin-1, Extended-A, Extended-B), Greek, Cyrillic, the punctuation we emit, and currency symbols. Together that covers European and most Latin-script names.

**It does not cover Devanagari, Bengali, Tamil, Han, Hangul, Kana, Arabic, Hebrew, or Thai** — and neither do the source fonts, so this is not a subsetting artifact. A name written in any of those scripts will render as `.notdef` boxes.

This matters because the product targets a global audience, and it is precisely the silent trust failure the glyph test exists to prevent — just displaced from "we dropped a glyph" to "the family never had one". The mitigation, when it becomes a priority, is a Noto fallback chain registered after the primary family (the risk register in the execution plan §10 already anticipates this). Until then, `UNSUPPORTED_SCRIPTS` in [`src/lib/fonts/charset.ts`](../src/lib/fonts/charset.ts) records the gap in code.

## Libraries

Runtime and build dependencies are listed in `package.json` with their own licenses. Notable choices:

- **@react-pdf/renderer** (MIT) — PDF generation. Real vector text, not a rasterised screenshot; see D2 and D3.
- **subset-font** (BSD-3-Clause) — build-time glyph subsetting via HarfBuzz.
- **fontkit** (MIT) — font introspection in the glyph coverage test.
- **zod** (MIT) — the resume document schema.
