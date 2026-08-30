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
| P3 DOCX + TXT            | M0-T5, T6        | ⬜ Next                    |
| P4 State + builder UI    | M0-T7, T8        | ⬜ Not started             |
| P5 Preview + exports     | M0-T9, T10, T12  | ⬜ Not started             |
| P6 Lint + tests + launch | M0-T11, T14, T13 | ⬜ Not started             |
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

Everything *we* inject is ASCII; characters the user typed pass through untouched (mangling "José" in the body would be a correctness bug — M0-T12 transliterates for the download *filename* only). The one active fold is the en dash in date labels, which is safe because date labels are generated wholly by us from structured data. A test asserts every non-ASCII character in the output appears somewhere in the user's own input.

#### Two acceptance criteria that cannot be automated here

M0-T5 asks for "opens clean in Word, LibreOffice, and Google Docs" and "page count matches the PDF". Both need a Word-compatible layout engine; LibreOffice is not installed in this environment. Automated instead: valid OPC package, required parts present, named styles defined and referenced, native numbering with no literal `•` in body text, exact page geometry, no tables/images/text boxes/headers/footers, no embedded font binaries, and word-for-word parity with the TXT emitter. **The application-level and page-parity passes remain owed to M0-T14 and belong in `docs/QA.md`.**

---

## Next

### P4 — State + builder UI (M0-T7, M0-T8)

- [ ] `store/resume.ts` — Zustand store persisted to **IndexedDB** via `idb-keyval` as the `persist` storage adapter (localStorage is too small and synchronous). Nothing leaves the browser in M0 (D6).
- [ ] Undo/redo: bounded command history (~50 entries) with coalescing, so typing a bullet is one undo step and not forty.
- [ ] Autosave: 500ms debounce after last keystroke, plus flush on blur and `visibilitychange`.
- [ ] "Clear all data" control that genuinely empties IndexedDB.
- [ ] `components/builder/` — step forms with react-hook-form + zod resolvers: Contact → Summary → Experience → Education → Skills → Projects → Certifications → Custom.
- [ ] Repeatable entries with add/remove/reorder (`dnd-kit`); section reorder and show/hide.
- [ ] **Empty states carry this product** — every section needs a real, well-written example, not "No items yet". The Projects empty state is the single most important screen for a fresher.
- [ ] Keyboard-first: `Ctrl/Cmd+Enter` adds the next bullet, `Ctrl/Cmd+K` command palette, correct tab order.
- [ ] Accept: full resume buildable by keyboard alone; every field validates with a useful message; usable at 390px.
- [ ] Dependencies to add: `zustand`, `idb-keyval`, `react-hook-form`, `@hookform/resolvers`, `@dnd-kit/*`, and shadcn/ui components.

**Depends on:** M0-T1 (schema) — done. This is a ~20h package with no natural mid-point; the plan says to expect it to span sittings and not read that as slippage.

### Then P5 — Preview + exports (M0-T9, T10, T12)

Needs a browser font resolver: the PDF font seam (`FontSourceResolver`) currently only has the Node/filesystem implementation in `lib/fonts/paths.node.ts`. The browser resolves by URL, so the font files must be served (copied to `public/fonts/` or imported as bundler assets).

---

## Notes for whoever picks this up

- Plan header in `EXECUTION_PLAN.md` still says "Repository is empty" — stale, ignore it in favor of this file.
- `DECISIONS.md` has one amendment (2026-08-13): stack is Next 16.3/React 19.2, not Next 15 as originally written. No D-numbered decision affected.
- **`minPresenceAhead` reserves space *after* the node it is set on.** M0-T3's text says "a role's final bullet gets `minPresenceAhead`", but set there it would guard whatever follows the role, not the bullet. The hint goes on the block immediately *before* the final bullet. Documented at the top of `lib/layout/document.ts`.
- **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** react-pdf inherits a unitless lineHeight as an absolute value, so a heading inherits a body-sized line box and collides with the line below. Silent failure; guarded by the `overlappingLines` test.
- **DOCX and TXT must not compose entries independently.** Use `lib/emit/shared/entry-lines.ts`. The parity test will fail loudly if they drift, but the shared module is what stops it happening.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff there means the machine-readable output changed; treat it as a product change, not a test annoyance.
- Fixtures live in `src/test/fixtures/resumes.ts` with **hardcoded ids and literal dates** — `createId()` and `openDateRange()` are nondeterministic and would break the determinism tests.
- Manual QA still owed (M0-T14): open generated DOCX in Word, LibreOffice, Google Docs; confirm DOCX page count matches the PDF. Record in `docs/QA.md`.
