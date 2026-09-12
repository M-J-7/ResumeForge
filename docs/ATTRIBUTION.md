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

## Data formats

### JSON Resume (MIT)

The account export and the builder's import read and write the **JSON Resume**
schema, v1.0.0 — <https://jsonresume.org>, schema at
<https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json>.
The schema is MIT-licensed. Nothing from the project is vendored here: the
mapping in [`src/lib/interop/json-resume.ts`](../src/lib/interop/json-resume.ts)
is written against the published field names, and the schema URL appears in
exported files as a `$schema` reference only.

Using someone else's format is the point rather than a convenience. An export
in a format we invented would be a file only we can read, which is not
portability; M2-T6 asks for interop, and interop means the format has to
outlive us.

## Skill vocabulary

### O\*NET Technology Skills (CC BY 4.0) — attribution is a licence condition

`data/skills.json` is built from the **Technology Skills** file of the O\*NET
29.1 database, published by the U.S. Department of Labor, Employment and
Training Administration (USDOL/ETA) and used under the
[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).
O\*NET® is a trademark of USDOL/ETA. Source:
<https://www.onetcenter.org/database.html>.

The build step is [`scripts/build-skills.mjs`](../scripts/build-skills.mjs)
(`pnpm skills:build`); the output is committed, so nothing at runtime or test
time reaches the network. About 7,400 distinct technology names survive
de-duplication and the placeholder filter described in that script.

Unlike the fonts, **attribution here is a condition of use rather than good
manners** — CC BY requires it. It is recorded in three places on purpose: this
file, the `sources` field inside `data/skills.json` itself, and the script
that produced it.

### ESCO — considered, not shipped

The execution plan names ESCO alongside O\*NET, and its terms are the more
permissive of the two: under Commission Decision 2011/833/EU it may be reused
for any purpose, free of charge.

It is absent for delivery reasons rather than licensing ones. ESCO publishes
bulk downloads behind a registration form, and its open API is a per-query
search endpoint — harvesting ~13k skills through paginated search would be a
slow, fragile build step whose failure mode is a half-populated vocabulary.
O\*NET plus the curated list already clears M3-T1's acceptance. `source` on
each entry exists so ESCO can be added later with its provenance visible.

### The curated list (ours)

[`src/lib/skills/curated.ts`](../src/lib/skills/curated.ts) is written by us
and owned by us. It is what maps `k8s` to Kubernetes and `JS` to JavaScript —
relationships no public taxonomy carries, and the ones that decide whether the
matcher looks credible. The risk register calls for keeping it independent of
any ingested source precisely so a licence change upstream cannot take the
half that does most of the work.

### Word commonality — deliberately not ingested

[`src/lib/skills/common-words.ts`](../src/lib/skills/common-words.ts) is also
written rather than borrowed, and that was a licensing decision before it was
an engineering one.

The obvious source is the widely-copied `google-10000-english` list. Its own
licence says: _"I do not recommend using this data for commercial purposes
without licensing it from the Linguistic Data Consortium."_ It is derived from
the Google Web Trillion Word Corpus, distributed by the LDC. This product has
a monetisation plan, so that is a licence we would be depending on and do not
hold. M3-T1 says to verify licence terms before shipping; this is that check
coming back negative, recorded so nobody re-runs it.

Writing the list turned out to be the better answer anyway. What the scorer
needs is not general-English frequency but "does this word say anything about
whether this candidate fits this job" — and general-English frequency is a
poor proxy for it. "Excel" is uncommon in prose and ubiquitous in postings; a
borrowed list gets that exactly backwards.

## Phrase library

### O\*NET Occupation Data, Alternate Titles and Task Statements (CC BY 4.0)

`data/phrases.json` is built from three files of the **O\*NET 29.1** database
— `Occupation Data`, `Alternate Titles` and `Task Statements` — published by
the U.S. Department of Labor, Employment and Training Administration
(USDOL/ETA) and used under the
[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).
O\*NET® is a trademark of USDOL/ETA. Source:
<https://www.onetcenter.org/database.html>. The build step is
[`scripts/build-phrases.mjs`](../scripts/build-phrases.mjs)
(`pnpm phrases:build`); the version and the access date are recorded in the
`sources` field of the generated file, and a test asserts they are there —
CC BY makes attribution a condition, so it is checked rather than trusted.

**What is reproduced and what is not.** Occupation titles and alternate
titles are reproduced: about 941 occupations and 11,000 alternate titles,
which is what makes a job title findable by whatever the user actually calls
it. **Task statements are not.** They are read at build time to decide which
topics an occupation touches, by keyword, and then discarded — the text never
reaches `data/phrases.json` and is never shown to a user.

That is a product decision rather than a licensing one, and it is the reason
the phrase library exists in the shape it does. O\*NET tasks are duty-shaped
— _"Analyze user needs and software requirements to plan and design
systems"_ — and `bullets/duty-phrasing` in our own lint engine exists to flag
exactly that construction. Shipping them as suggested bullets would have the
product mark its own suggestions as defects in front of the user.

### The bullet scaffolds (ours)

[`src/lib/phrases/scaffolds.ts`](../src/lib/phrases/scaffolds.ts) is written
by us and owned by us. Every suggested bullet in the product comes from
there, carries at least one blank for the user to fill, and contains no
number of its own — which is what keeps the feature inside D8. Same reasoning
as the curated skill list above: no upstream licence change can take away the
half that does the work.

## Libraries

Runtime and build dependencies are listed in `package.json` with their own licenses. Notable choices:

- **@react-pdf/renderer** (MIT) — PDF generation. Real vector text, not a rasterised screenshot; see D2 and D3.
- **subset-font** (BSD-3-Clause) — build-time glyph subsetting via HarfBuzz.
- **fontkit** (MIT) — font introspection in the glyph coverage test.
- **zod** (MIT) — the resume document schema.
