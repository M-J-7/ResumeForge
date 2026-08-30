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
| P6 Lint + tests + launch | M0-T11, T14, T13 | 🔶 Code done, deploy owed  |
| P7 X-Ray engine          | M1-T1, T2        | ✅ Done                    |
| P8 X-Ray UI              | M1-T3, T4        | ✅ Done                    |
| P9–P14 (M2–M3)           | —                | ⬜ Next                    |

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

### P6 — Lint, verification, launch prep (M0-T11, M0-T14, M0-T13)

**Lint engine (M0-T11) — done**

- `src/lib/lint/types.ts`, `rules.ts`, `engine.ts`. ESLint framing per D11: stable namespaced id, severity, message, and a one-line _why this matters_, dismissible with a required reason.
- All 12 M0 rules implemented: missing name · no email or phone · malformed email · missing location · no evidence at all · end date before start · inconsistent date precision · paragraph bullets · duty phrasing · first-person pronouns · weak opening verb · no quantified outcome · word count outside 300–800 · empty visible section.
- `IssuesPanel.tsx` shows **"3 issues left"** per D12 — never a 0–100 score. Info findings are listed but not counted, so the number can actually reach zero; a checklist that never completes stops being read.
- 50 tests, including a pass and a fail fixture per rule, plus meta-tests asserting no rule's _why_ text is generic filler and no rule promises a guarantee (D14).

**Verification suite (M0-T14) — automated parts done**

- Three fixtures added: `nonLatinNameResume` (extended Latin, Þ/Đ/ø), `longOrganizationNamesResume` (wraps the right-aligned date column), `onlyOneSectionResume`. Seven fixtures total.
- `pagination.test.tsx` — property-based invariants over 24 **seeded** random documents. Seeded deliberately: a property failure that cannot be reproduced gets dismissed as a fluke.
- Right-margin overflow check added across every fixture — text past the page edge is clipped, so the words are lost from both print and extraction.
- `.github/workflows/ci.yml` — verify, E2E with Chromium, and a Docker build.

**Launch prep (M0-T13) — code done, deploy owed**

- `src/app/page.tsx` replaces the create-next-app default. Honest positioning per D14, with an explicit "what we will not tell you" section.
- `/privacy` and `/terms` — required live before launch per §9.
- `Dockerfile` (`node:20-bookworm-slim`, multi-stage, non-root, healthcheck) and `output: "standalone"` in `next.config.ts`. `.dockerignore` excludes the generated `public/fonts`, which the build regenerates.
- README rewritten, including the **Vercel cannot host this** warning the plan asks for.

#### A false positive the property test taught us to avoid

Five of 24 seeds initially failed the "bullet never splits across pages" check. The bullets were fine — the assertion compared a _head_ fragment against a _tail_ fragment, and with a small generated vocabulary the tail matched a different bullet on another page. The correct check is that the bullet's **entire** text is recoverable from one page's joined lines. The same flaw was in the P2 test and is fixed there too. Generated bullet text now carries its role index so a real failure names exactly one bullet.

#### Still owed before M0 can be called shipped

`docs/QA.md` records three manual checks that cannot be automated here, each with a checklist and a "not yet run" result:

1. **DOCX opens cleanly in Word, LibreOffice, and Google Docs** — needs those applications; LibreOffice is not installed in this environment.
2. **Cross-format page parity** — needs a Word-compatible layout engine. LibreOffice headless converting DOCX→PDF is the practical route.
3. **End-to-end build on a real phone** — an emulator answers the wrong question.

Also owed: choosing a host, a domain, and running the actual deploy.

### P7 + P8 — X-Ray (M1-T1, M1-T2, M1-T3, M1-T4)

The wedge: every competitor _claims_ ATS-friendliness; this measures it, because we hold the ground truth the extraction can be graded against.

- `src/lib/xray/extract.ts` — two deliberately different PDF strategies plus DOCX.
  - **A, stream order:** items as emitted, what a naive parser sees.
  - **B, geometric:** cluster by baseline, sort by x — what a good parser does.
  - `extractDocxStructure` parses `word/document.xml` for paragraph _styles_, the structural signal PDF has no equivalent for and the reason D4 favours DOCX.
- `src/lib/xray/scorecard.ts` — recovers name (first-line heuristic), email, phone (validated by `libphonenumber-js`, not regex alone), and per role title/organization/start/end. Weighted: contact details and the most recent role count most, because they carry the most consequence.
- `src/components/xray/` — the three layers per M1-T3: scorecard first (the answer), parser disagreements second, raw extracted text last, with a toggle between the two reading orders.
- Wired as a **tab beside Preview** in the preview pane, kept mounted so switching does not discard the extraction.
- M1-T4 is satisfied by the recovery tests running in the normal suite: CI fails if any field regresses.
- 41 X-Ray tests, plus an E2E test proving it works in a real browser. Dependency added: `libphonenumber-js`.

**100% recovery on all seven fixtures, across both PDF strategies and DOCX.**

#### Two things the strategies taught us

**The two-column role header reads differently under each strategy — and that is correct.** A role header is visually one line (title left, date right), so geometric reports it as one line while stream order sees the whole left column and then the right. Neither is wrong; the difference is exactly what layer 3 shows the user. The scorecard handles both layouts rather than scoring our own output down for something a real parser reads fine.

**Substring matching silently mis-assigned roles.** "Backend Engineer" is a substring of "Senior Backend Engineer", so a greedy match handed the junior role the senior role's employer and dates, then reported the mismatch as a parse failure that never happened. Roles are now claimed exact-first, each recovered role used once. Worth remembering anywhere resume fields get fuzzy-matched — M3's keyword scoring will hit the same shape.

---

## Next

### Still owed: ship M0

M0 and M1 are both code-complete and green — 913 unit tests, 7 Playwright tests. But the plan says **ship M0 publicly before starting M1**, and that gate is still unmet: three manual checks and the deploy remain, all listed with checklists in `docs/QA.md`. M1 was built ahead of it because the deploy needs decisions only the owner can make (host, domain, product name — §12 open questions 2 and 3), not because the sequencing was reconsidered.

The feedback loop the plan wants — a week of real users before building accounts — has not happened. Weigh that before starting M2.

### P9 — Database + auth (M2-T1, M2-T2)

- [ ] Prisma + better-sqlite3. On **every connection**: `PRAGMA journal_mode=WAL; busy_timeout=5000; synchronous=NORMAL; foreign_keys=ON`. Assert the pragma values in a test.
- [ ] `better-sqlite3` is **synchronous** — a slow query blocks the event loop for every user. Keep queries indexed and small; note it in code comments.
- [ ] `Json` columns on SQLite are TEXT and are **not queryable or indexable**. Denormalize anything sortable into real columns (`lastScore`, `pageCount`, `wordCount`) — the schema in §7 of the plan already does this.
- [ ] Auth.js v5, Google OAuth + email magic link, **no passwords ever** (D7). Prisma adapter, sessions in the same SQLite file.
- [ ] Accept: migrations run clean; both auth flows work end to end; sessions survive restart.

### Then P10 (sync + dashboard), P11 (Litestream + **rehearsed** restore — the largest tail risk in the architecture, §10), P12–P14 (M3 scoring)

---

## Notes for whoever picks this up

- Plan header in `EXECUTION_PLAN.md` still says "Repository is empty" — stale, ignore it in favor of this file.
- `DECISIONS.md` has one amendment (2026-08-13): stack is Next 16.3/React 19.2, not Next 15 as originally written. No D-numbered decision affected.
- **`minPresenceAhead` reserves space _after_ the node it is set on.** M0-T3's text says "a role's final bullet gets `minPresenceAhead`", but set there it would guard whatever follows the role, not the bullet. The hint goes on the block immediately _before_ the final bullet. Documented at the top of `lib/layout/document.ts`.
- **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** react-pdf inherits a unitless lineHeight as an absolute value, so a heading inherits a body-sized line box and collides with the line below. Silent failure; guarded by the `overlappingLines` test.
- **Never call `.filter()` or `.map()` inside a Zustand selector.** A new array every call means the snapshot never compares equal and the component re-renders forever. Select the stable reference and derive during render.
- **DOCX and TXT must not compose entries independently.** Use `lib/emit/shared/entry-lines.ts`. The parity test fails loudly on drift, but the shared module is what prevents it.
- **pdfjs needs `GlobalWorkerOptions.workerSrc` in a browser** but not under Node, so this class of bug is invisible to the Vitest suite. Run `pnpm test:e2e` before believing anything about the preview or X-Ray.
- **When asserting that text did not split across pages, match the whole string against one page's joined lines** — never head-fragment against tail-fragment.
- **Fuzzy-matching resume fields needs exact-first, claim-once semantics.** Substrings otherwise mis-assign shorter titles to longer ones. See the P7 note.
- `public/fonts/` and `public/pdf.worker.min.mjs` are generated and gitignored. If the preview 404s on a font, run `pnpm fonts:sync`.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff there means the machine-readable output changed; treat it as a product change, not a test annoyance.
- Fixtures live in `src/test/fixtures/resumes.ts` with **hardcoded ids and literal dates** — `createId()` and `openDateRange()` are nondeterministic and would break the determinism tests.
- Component tests opt into jsdom with `// @vitest-environment jsdom` on line 1. `src/test/setup.ts` stubs `HTMLDialogElement.showModal`/`close`, `ResizeObserver`, and `URL.createObjectURL`, none of which jsdom implements.
- **Email and URL are plain text in the schema**, validated by `isValidEmail`/`isValidUrl` in the form and the lint engine. See the P4 note for why; do not "fix" this by putting `z.email()` back.
- M4-T1 (resume import) reuses `lib/xray/extract.ts` wholesale — it is the biggest onboarding unlock for the least new code.
