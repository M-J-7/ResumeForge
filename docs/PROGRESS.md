# Progress Tracker

> Reference for future sessions: what's done, what's next, and where to pick up.
> Task IDs and package IDs (`P1`, `M0-T3`, …) refer to `docs/EXECUTION_PLAN.md`.
> Update this file as work completes — one line per task, moved from Next → Done.

**Last updated:** 2026-08-30

---

## Status at a glance

| Package                  | Tasks            | Status                     |
| ------------------------ | ---------------- | -------------------------- |
| P1 Foundation            | M0-T0, T1, T2    | ✅ Done (commit `578cc73`) |
| P2 Document model + PDF  | M0-T3, T4        | ✅ Done                    |
| P3 DOCX + TXT            | M0-T5, T6        | ✅ Done                    |
| P4 State + builder UI    | M0-T7, T8        | ✅ Done                    |
| P5 Preview + exports     | M0-T9, T10, T12  | ✅ Done                    |
| P6 Lint + tests + launch | M0-T11, T14, T13 | ⬜ Next                    |
| P7–P14 (M1–M3)           | —                | ⬜ Not started             |

---

## Done

### P1 — Foundation (M0-T0, M0-T1, M0-T2) — commit `578cc73`

- Next.js 16.3 / React 19.2 scaffold, TypeScript strict, Tailwind, ESLint, Prettier, Vitest.
- `src/lib/resume/schema.ts` — Zod schemas for the full `ResumeDocument` tree (contact, sections, settings). `CURRENT_SCHEMA_VERSION = 1`.
- `src/lib/resume/dates.ts` — structural `PartialDate`/`DateRange`, month-name formatting, en-dash separator.
- `src/lib/resume/migrate.ts` — migration chain (`detectVersion`, `migrate`, `safeMigrate`), v0→v1 identity-ish migration, contiguity enforced.
- `src/lib/resume/factory.ts` — constructors for new resume content (`createEmptyResume`, per-entry factories, `createId` via `crypto.randomUUID()`).
- `src/lib/fonts/` — 5 vendored OFL font pairs (Tinos/Arimo/Carlito/EB Garamond/IBM Plex Sans) with OFL.txt per family, subsetted via `scripts/fetch-fonts.mjs`. `pairs.ts` (data), `files.ts` (filename mapping), `register.ts` (react-pdf `Font.register`, hyphenation disabled), `paths.node.ts` (Node filesystem resolver), `charset.ts`/`charset.json` (required glyph list, shared by fetch script and tests).
- Tests: schema round-trip, migration chain, glyph coverage, PDF render smoke test per font pair (`render.test.tsx`).

### P2 — Document model + PDF (M0-T3, M0-T4)

- `src/lib/layout/document.ts` — `buildDocument(resume): DocumentBlock[]`. Flat, ordered, discriminated-union block list carrying `keepWithNext` / `keepTogether` / `minPresenceAhead` hints. The four break rules are encoded here once, for all three emitters.
- `src/lib/emit/pdf/` — `styles.ts` (all geometry derived from `settings`), `blocks.tsx` (hint → react-pdf prop mapping), `ResumePdf.tsx` (`resumePdfElement`, pinned PDF metadata), `render.ts` (`renderPdf` → `{ blob, bytes, pageCount }`), `determinism.ts` (`pdfFingerprint`).
- `src/lib/pdf/read.ts` — pdfjs-dist loader. Page count read back from the artifact (D3); text reconstructed into visual lines geometrically. Shared with the preview (M0-T9) and X-Ray (M1-T1).
- Fixtures added: `longCareerResume` (5 roles), `singleBulletRoleResume`, `buildOverflowFixture(n)`.
- Tests: 18 document-model unit tests, 36 emitter tests (golden text snapshots for 4 fixtures, determinism, page-count, layout sanity, break rules, 12-step page-boundary sweep, hard constraints).
- Dependency added: `pdfjs-dist@6.3.289`.

**Decision-point outcome (plan §2.5): react-pdf's break control is sufficient. No escape hatch needed.** The 12-iteration sweep walking the page break across a role boundary holds all three invariants declaratively via `wrap={false}` + `minPresenceAhead`. The Chromium/Playwright fallback in §10 stays unused.

#### Three defects found and fixed in P2

1. **`lineHeight` inheritance (layout-wide, silent).** react-pdf resolves a unitless `lineHeight` to an _absolute_ point value at the element declaring it; descendants inherit that absolute value, not the ratio. Every style with a `fontSize` different from the page body size therefore got a body-sized line box and collided with the line below — the name overlapped the contact line by ~11pt. Fixed by restating `lineHeight` alongside every `fontSize` in `styles.ts`. Guarded by the `overlappingLines` regression test, which also runs across all five font pairs.
2. **Bare heading for an empty visible section.** `buildDocument` emitted a section heading with no content beneath it, which both looks wrong and violates break rule 1 (nothing to be "kept with", so it could end a page). Caught by the pagination invariant on the fresher fixture. Empty sections now emit nothing; reporting them is the lint engine's job (M0-T11).
3. **Skills label/content split.** A fixed-width label column wrapped longer labels ("Languages & Frameworks") onto their own line, separating the label from the skills it introduces. Now one flowing `Text` with a nested bold label.

#### Determinism: what M0-T4's criterion actually means here

Byte-for-byte identity is not achievable, for two reasons both in _serialization_ rather than content:

- pdfkit tags each embedded font subset with six `Math.random()` letters, with no seed or override exposed.
- react-pdf subsets fonts asynchronously, so font stream objects are flushed in completion order, which varies run to run. Object numbers and total byte length are stable; only write order moves.

`pdfFingerprint` normalizes the subset tags, re-sorts objects by number, and drops the xref table (pure offset bookkeeping derived from the objects themselves). Equal fingerprints mean an identical document. Tests assert a stable fingerprint _and_ a stable byte length across 4 renders, and that real content/settings changes still change the fingerprint — so the check keeps its power to catch nondeterministic layout.

### P3 — DOCX + TXT (M0-T5, M0-T6)

- `src/lib/emit/shared/entry-lines.ts` — **shared composition** for DOCX and TXT. Both render the same `{ heading, dateLabel, meta, firstBullet }`, so the "mammoth extraction matches TXT" criterion is guaranteed by construction rather than merely detected. The PDF emitter deliberately does not use it (its role header is a two-column tab-stop layout with no plain-text equivalent); what all three share is `DocumentBlock[]` and the break rules.
- `src/lib/emit/docx/styles.ts` — exact page sizes in twips (A4 `11906×16838`, Letter `12240×15840`), half-point/twip conversions, style ids.
- `src/lib/emit/docx/render.ts` — `renderDocx(resume) -> { blob, bytes }`. Real named paragraph styles (`Normal`, `Title`, `Heading1`, `Heading2`, `ContactInfo`, `EntryMeta`, `ResumeBullet`), native numbering for bullets, right tab stop for dates (never a table), fonts by name per D5.
- `src/lib/emit/text/render.ts` — `renderText(resume) -> string`. Caps headings, `- ` bullets, one blank line between records, trailing newline.
- Tests: 32 DOCX + 19 TXT.
- Dependencies added: `docx@9.7.1`, and dev-only `mammoth@1.12.2`, `fflate@0.8.3`.

#### Hint mapping to Word

`keepWithNext` → `keepNext: true`; `keepTogether` → `keepLines: true`. `minPresenceAhead` has **no Word equivalent** — it is react-pdf's points-of-lookahead concept. The rule it implements (rule 4, don't strand a role's final bullet) is expressed in Word as `keepNext` on the preceding paragraph, so a block carrying `minPresenceAhead` gets `keepNext: true`.

#### The ASCII rule in TXT

Everything _we_ inject is ASCII; characters the user typed pass through untouched (mangling "José" in the body would be a correctness bug — M0-T12 transliterates for the download _filename_ only). The one active fold is the en dash in date labels, which is safe because date labels are generated wholly by us from structured data. A test asserts every non-ASCII character in the output appears somewhere in the user's own input.

#### Two acceptance criteria that cannot be automated here

M0-T5 asks for "opens clean in Word, LibreOffice, and Google Docs" and "page count matches the PDF". Both need a Word-compatible layout engine; LibreOffice is not installed in this environment. Automated instead: valid OPC package, required parts present, named styles defined and referenced, native numbering with no literal `•` in body text, exact page geometry, no tables/images/text boxes/headers/footers, no embedded font binaries, and word-for-word parity with the TXT emitter. **The application-level and page-parity passes remain owed to M0-T14 and belong in `docs/QA.md`.**

### P4 — State + builder UI (M0-T7, M0-T8)

**Store (M0-T7)**

- `src/store/history.ts` — undo/redo as whole-document snapshots, bounded at 50. Coalescing by field key within a 700ms window, so typing a bullet is one undo step. Undo clears the coalesce key so the next keystroke cannot extend the entry just stepped out of.
- `src/store/persistence.ts` — IndexedDB via `idb-keyval` behind an injectable `KeyValueBackend` (tests use a memory backend, mirroring the `FontSourceResolver` seam). 500ms debounced autosave with an explicit `flush()`; writes are serialized so a flush racing the timer cannot commit the older payload.
- `src/store/resume.ts` — the Zustand store. **Zustand's `persist` middleware is deliberately unused**: it writes on every change, rehydrates synchronously, and offers no clean hook for routing reads through `migrate()` (D10). The store does those three things itself.
- `installAutosaveFlush()` binds `visibilitychange`, `blur`, and `pagehide` — not `beforeunload`, which mobile browsers routinely skip when killing a backgrounded tab, losing exactly the edits it appears to protect.
- Snapshots rather than inverse-command diffs: a document is a few KB, and a snapshot undo cannot desynchronize from the document.

**Builder UI (M0-T8)**

- `src/components/ui/control.tsx` — Input, Textarea, Select, Button, Field, Toggle.
- `src/components/builder/` — `BuilderShell`, `StepNav` (progress + free navigation), `CommandPalette` (Ctrl/Cmd+K, on native `<dialog>`), `SectionManager` (reorder + show/hide), `BulletEditor` (Ctrl/Cmd+Enter adds and focuses the next bullet; Backspace on an empty bullet removes it), `SortableList` (dnd-kit with `KeyboardSensor`, so reordering works without a mouse), `DateRangeFields` (two selects — never a typed date string, per M0-T1), `EntryCard`, `empty-states.tsx`, `progress.ts`.
- 8 step forms in `src/components/builder/steps/`, plus `src/app/builder/page.tsx`.
- Tests: 45 store/history/persistence, 12 progress, 14 component (jsdom + Testing Library).
- Dependencies added: `zustand`, `idb-keyval`, `@dnd-kit/{core,sortable,modifiers,utilities}`, `clsx`, `tailwind-merge`; dev-only `@testing-library/{react,user-event,jest-dom}`, `jsdom`.

#### Schema amendment: email and URL are plain text now

M0-T1 used `z.email()` / `z.url()`, but M0-T7 persists on every keystroke and the migration chain parses on load — so typing `jo` on the way to `jose@example.com` and then refreshing would have made the whole draft unparseable and discarded it. Both fields are now `text()`, with `isValidEmail` / `isValidUrl` exported from `lib/resume/schema.ts` and used by the builder forms (inline message as you type) and later by the lint engine (M0-T11). This makes the schema consistent with its own stated rule — structural integrity here, content quality in the lint engine — rather than weakening it. No D-numbered decision affected; no migration needed, since loosening a constraint keeps old documents valid.

#### react-hook-form is installed but unused

The store is the source of truth and owns undo/redo. RHF wants to own form state, and reconciling the two means either fighting the caret on every external change or reimplementing RHF's dirty-tracking against the history stack. Instead, inputs are controlled directly from the store and each step remounts on `externalRevision` — a counter bumped only by undo, redo, rehydrate, and clear. Validation is per-field and advisory, which is what the schema amendment above requires anyway. The dependency is left in place for P5/P6 in case a genuinely form-shaped surface appears; if none does, drop it.

#### shadcn/ui components are hand-written

The locked stack names shadcn/ui, whose model is "copy the component into your project and own it" — the CLI is a convenience, not the library. Running `init` would rewrite `globals.css` and the Tailwind config and add a `components.json` needing reconciliation with the existing Tailwind 4 setup. The primitives follow the same conventions, so any shadcn component can drop in beside them.

#### One real bug found by the component tests

`CustomStep` selected its sections with `.filter()` _inside_ the Zustand selector, which returns a new array each call, so the snapshot compared unequal on every render — an infinite render loop that would have hit any user opening the Custom step. Fixed by selecting the stable array and filtering during render.

### P5 — Preview + exports (M0-T9, M0-T10, M0-T12)

**Font delivery (the blocker)**

- `scripts/sync-public-fonts.mjs` copies the vendored `.ttf` files into `public/fonts/`, plus pdfjs's `pdf.worker.min.mjs`. Wired to `predev`/`prebuild`, so a fresh clone needs no extra step. `public/fonts/` and the worker are gitignored — the 2.8MB of fonts stays in the repo exactly once.
- `src/lib/fonts/paths.browser.ts` — `browserFontResolver`, the URL counterpart to the existing Node filesystem resolver.

**Preview (M0-T9)**

- `src/components/preview/render.worker.ts` — generates the PDF off the main thread. `usePdfPreview` debounces 400ms, discards responses it has outrun by request id, and falls back to main-thread rendering if a worker cannot be constructed.
- `PdfCanvas.tsx` rasterizes each page detached and swaps them in complete, so a half-painted page is never shown and the previous frame stays up during a re-render. Backing store capped at 2x DPR — an A4 page at 3x on a phone allocates a canvas large enough to be refused.
- `PreviewPane.tsx` — page chrome (discrete pages, shadow, ring), zoom (fit-width / fit-page / 100%), the fit indicator, and the export panel. Split view on desktop, tabbed on mobile; the preview stays mounted across the tab switch so it does not re-render from scratch.

**Page fit (M0-T10)**

- `src/lib/layout/fit.ts` — `analyzeFit` turns the measured geometry into "1.2 pages — 4 lines over 1". `suggestFit` offers exactly one suggestion, ordered by what the reader loses least: margins, then density, then font size, then the longest bullet. Font size stops at 10pt and margins at 0.6" — a resume squeezed to fit and then thrown away is not a win. The bullet suggestion is a no-op `apply`: it names the problem and leaves the words to the user (D8).

**Exports (M0-T12)**

- `src/lib/emit/filename.ts` — `FirstName_LastName_Resume.pdf`, transliterated for the **filename only**. Characters with no NFKD decomposition (Ł, Ø, Đ, ß, Æ) are mapped explicitly rather than silently deleted. Unsafe characters become separators, not deletions, so distinct names cannot collapse onto one filename.
- `ExportPanel.tsx` — all three formats, never paywalled (D13). The PDF handed over is the exact blob the preview is showing (D2). Includes the per-destination recommendation table.

**Testing**

- Playwright added (locked stack) with 6 E2E tests in `e2e/` covering what jsdom cannot model: the worker actually producing a PDF, pdfjs painting it to canvas, IndexedDB surviving a real reload, downloads with correct filenames, and a keyboard-only build. Run separately with `pnpm test:e2e`.
- 17 fit tests, 13 filename tests, 6 page-count tests.

#### Page count no longer goes through pdfjs

`renderPdf` runs _inside_ our render worker, and pdfjs refuses to run in a browser without `GlobalWorkerOptions.workerSrc` — which would have meant spawning a nested worker purely to read one integer. `src/lib/pdf/page-count.ts` reads `/Count` from the PDF's own page tree instead, which is what pdfjs does for `numPages` anyway. Still measured from the artifact per D3, and `page-count.test.ts` asserts it agrees with pdfjs on every fixture and across a multi-page sweep, so the cheap path cannot quietly drift. `readPages` still uses pdfjs (it needs real text geometry) and sets `workerSrc` when a `window` exists.

#### Found by running it in a real browser

The preview failed with `No "GlobalWorkerOptions.workerSrc" specified` — invisible to the unit suite, since pdfjs falls back to a fake worker under Node. Only the Playwright run surfaced it. This is the argument for keeping the E2E tests: three of P5's moving parts (worker, canvas, IndexedDB) have no Node equivalent.

---

## Next

### P6 — Lint + tests + launch (M0-T11, M0-T14, M0-T13)

**M0-T11 — lint engine (6h)**

- [ ] `lib/lint/` with ESLint framing (D11/D12): stable rule id, severity, message, a one-line _why this matters_, dismissible with a reason.
- [ ] M0 rules: missing contact fields · no email or phone · date format inconsistency · end date before start date · bullets that are paragraphs (>2 lines or >40 words) · `responsible for` / `helped with` / `duties included` · first-person pronouns · weak or missing leading action verb · no quantified outcome in a role · word count outside 300–800 · empty visible section.
- [ ] UI: **"3 issues left"** during editing (D12), expanding to the list on click. No live 0–100 score.
- [ ] Reuse `isValidEmail` / `isValidUrl` from `lib/resume/schema.ts` — already the single definition, used by the builder forms.
- [ ] Accept: every rule has a unit test with a passing and a failing fixture, and non-generic _why_ text.

**M0-T14 — verification suite (8h)**

- [ ] Remaining fixtures: non-Latin names, very long company names, every section empty but one.
- [ ] Property-based pagination invariants over randomly generated content lengths (P2 shipped a bounded 12-step sweep; this is the exhaustive version).
- [ ] Cross-format page parity: PDF and DOCX page counts agree on every fixture. **Needs a Word-compatible renderer** — LibreOffice headless converting DOCX→PDF is the practical option, skipped gracefully when absent.
- [ ] **Manual pass, still owed**: open each DOCX in Word, LibreOffice, and Google Docs; build a resume end-to-end on a real phone. Document in `docs/QA.md`.
- [ ] Wire the whole suite into CI, including `pnpm test:e2e`.

**M0-T13 — landing page and deploy (6h)**

- [ ] Replace the create-next-app default at `src/app/page.tsx` with honest positioning (D14): free downloads forever, nothing sent to an AI, works without an account. No "beat the bots".
- [ ] Privacy policy and terms — required _before_ launch (§9).
- [ ] Dockerfile (`node:20-bookworm-slim`), deploy to a VM host, custom domain, HTTPS. **Vercel cannot host this** (§1) — note it in the README.
- [ ] Accept: public URL, Lighthouse ≥ 90 on the landing page, builder interactive under 3s throttled.

---

## Notes for whoever picks this up

- Plan header in `EXECUTION_PLAN.md` still says "Repository is empty" — stale, ignore it in favor of this file.
- `DECISIONS.md` has one amendment (2026-08-13): stack is Next 16.3/React 19.2, not Next 15 as originally written. No D-numbered decision affected.
- **`minPresenceAhead` reserves space _after_ the node it is set on.** M0-T3's text says "a role's final bullet gets `minPresenceAhead`", but set there it would guard whatever follows the role, not the bullet. The hint goes on the block immediately _before_ the final bullet. Documented at the top of `lib/layout/document.ts`.
- **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** react-pdf inherits a unitless lineHeight as an absolute value, so a heading inherits a body-sized line box and collides with the line below. Silent failure; guarded by the `overlappingLines` test.
- **Never call `.filter()` or `.map()` inside a Zustand selector.** A new array every call means the snapshot never compares equal and the component re-renders forever. Select the stable reference and derive during render.
- **DOCX and TXT must not compose entries independently.** Use `lib/emit/shared/entry-lines.ts`. The parity test fails loudly on drift, but the shared module is what prevents it.
- **pdfjs needs `GlobalWorkerOptions.workerSrc` in a browser** but not under Node, so this class of bug is invisible to the Vitest suite. Run `pnpm test:e2e` before believing anything about the preview.
- `public/fonts/` and `public/pdf.worker.min.mjs` are generated and gitignored. If the preview 404s on a font, run `pnpm fonts:sync`.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff there means the machine-readable output changed; treat it as a product change, not a test annoyance.
- Fixtures live in `src/test/fixtures/resumes.ts` with **hardcoded ids and literal dates** — `createId()` and `openDateRange()` are nondeterministic and would break the determinism tests.
- Component tests opt into jsdom with `// @vitest-environment jsdom` on line 1. `src/test/setup.ts` stubs `HTMLDialogElement.showModal`/`close`, `ResizeObserver`, and `URL.createObjectURL`, none of which jsdom implements.
- Manual QA still owed (M0-T14): open generated DOCX in Word, LibreOffice, Google Docs; confirm DOCX page count matches the PDF; build a resume end-to-end on a real phone. Record in `docs/QA.md`.
