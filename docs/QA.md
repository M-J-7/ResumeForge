# QA

Automated coverage lives in the test suites; this file records the checks that
**cannot** be automated in this environment, who still owes them, and the result
when they are done.

M0-T14 requires a manual pass before launch. Two of its acceptance criteria are
listed as outstanding below — they are not optional, and M0 is not "shipped"
until they are recorded here with a date and an outcome.

---

## What CI already proves

Run by `pnpm verify` and `pnpm test:e2e` on every push.

| Check                                                                    | Where                                  |
| ------------------------------------------------------------------------ | -------------------------------------- |
| Schema round-trip, migration chain                                       | `src/lib/resume/*.test.ts`             |
| Glyph coverage across all font pairs                                     | `src/lib/fonts/charset.test.ts`        |
| Golden extracted text, 7 fixtures                                        | `src/lib/emit/pdf/render.test.tsx`     |
| Determinism (stable fingerprint and byte length across renders)          | `src/lib/emit/pdf/render.test.tsx`     |
| Pagination invariants, 24 seeded random documents                        | `src/lib/emit/pdf/pagination.test.tsx` |
| No overlapping lines, no margin overflow, all fixtures and font pairs    | `src/lib/emit/pdf/render.test.tsx`     |
| DOCX structure: named styles, native numbering, no tables/images/headers | `src/lib/emit/docx/render.test.ts`     |
| DOCX ↔ TXT word-for-word parity                                          | `src/lib/emit/docx/render.test.ts`     |
| Page count agrees with pdfjs                                             | `src/lib/pdf/page-count.test.ts`       |
| Lint rules, pass and fail fixture each                                   | `src/lib/lint/rules.test.ts`           |
| Live PDF preview, IndexedDB reload, downloads, keyboard-only build       | `e2e/builder.spec.ts`                  |

---

## Outstanding — owed before launch

### 1. DOCX opens cleanly in real word processors

**Why this cannot be automated here:** it needs Word, LibreOffice, and Google
Docs. LibreOffice is not installed in the development environment, and the other
two are not automatable at all.

Generate a DOCX for each fixture (the emitter tests write none to disk by
default; add a temporary `writeFileSync` or use the builder's download button),
then for **each of Word, LibreOffice, and Google Docs**:

- [ ] Opens without a repair prompt or compatibility warning.
- [ ] Section headings show as **Heading 1** in the style pane — not as
      manually-bolded body text. This is the property D4 rests on.
- [ ] Bullets are a real list (the list controls in the ribbon are active when
      the cursor is in one), not literal `•` characters.
- [ ] Accented and extended-Latin characters render correctly — check the
      `non-latin-name` fixture specifically (Zoë Đurđević-Þórsdóttir).
- [ ] No text is clipped at the right margin — check `long-organization-names`.
- [ ] Dates sit at the right margin via a tab stop, and stay there when the
      window is resized.

**Result:** _not yet run._

### 2. Cross-format page parity

**Why this cannot be automated here:** needs a Word-compatible layout engine.
The practical option is LibreOffice headless converting DOCX→PDF and counting
pages, skipped gracefully when `soffice` is absent — worth adding when a machine
with it is available.

- [ ] For every fixture, the DOCX page count in Word matches the page count the
      PDF preview showed.
- [ ] Note that Word, LibreOffice, and Google Docs paginate slightly
      differently. Record which was used; a one-page difference between _those
      three_ is expected, a difference against our own PDF is a bug.

**Result:** _not yet run._

### 3. Build a resume end-to-end on a real phone

**Why this cannot be automated here:** the criterion is about whether it is
usable, not whether it renders. An emulator answers the wrong question.

- [ ] Complete a resume start to finish on a physical phone, portrait, one
      handed where possible.
- [ ] The 390px viewport is the target width; check nothing overflows
      horizontally.
- [ ] The Edit/Preview tabs are reachable and the preview is legible.
- [ ] The on-screen keyboard does not cover the field being typed into.
- [ ] Download all three formats and confirm they open on the device.

**Result:** _not yet run._

---

## Known limitations, recorded deliberately

- **Scripts the vendored fonts do not cover** — Devanagari, Bengali, Tamil, Han,
  Hangul, Kana, Arabic, Hebrew, Thai. Names in these render as `.notdef` boxes.
  Recorded in `src/lib/fonts/charset.ts` and `docs/ATTRIBUTION.md`; the
  mitigation (a Noto fallback chain) is not in M0.
- **Byte-for-byte PDF determinism is not achievable.** pdfkit randomizes the
  embedded font subset tag and react-pdf flushes font streams in async
  completion order. `pdfFingerprint` normalizes both; the document is identical,
  the serialization is not. See `src/lib/emit/pdf/determinism.ts`.
- **`ResizeObserver`, `HTMLDialogElement.showModal`, and `URL.createObjectURL`
  are stubbed in jsdom** (`src/test/setup.ts`). Anything depending on their real
  behaviour must be covered by the Playwright suite instead.
