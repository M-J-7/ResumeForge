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

---

## Next

### P3 — DOCX + TXT (M0-T5, M0-T6)

- [ ] `lib/emit/docx/` using the `docx` package. Real named paragraph styles (`Heading1`/`Heading2`/`Normal`) — DOCX parses well precisely because its XML exposes style names.
- [ ] Hints map natively: `keepWithNext` → `keepNext: true`, `keepTogether` → `keepLines: true`.
- [ ] Native numbering definitions for bullets, not literal `•` characters.
- [ ] Page size in twips: A4 `11906 × 16838`, Letter `12240 × 15840`. Fonts by **name** per D5 (`docxName` + `docxFallback` already in `lib/fonts/pairs.ts`).
- [ ] `lib/emit/text/` — plain text, caps headings, `- ` bullets. Doubles as the canonical extraction target.
- [ ] Accept: DOCX opens clean in Word/LibreOffice/Google Docs; `mammoth` extraction matches TXT modulo whitespace; page count matches PDF on all fixtures.
- [ ] Dependencies to add: `docx`, and `mammoth` for the extraction test.

**Depends on:** M0-T3 (`buildDocument`) — done. Both emitters consume the same `DocumentBlock[]`; do not re-derive layout rules.

### Then P4 — State + builder UI (M0-T7, M0-T8)

Not started. `store/` and `components/builder/` are still empty placeholders.

---

## Notes for whoever picks this up

- Plan header in `EXECUTION_PLAN.md` still says "Repository is empty" — stale, ignore it in favor of this file.
- `DECISIONS.md` has one amendment (2026-08-13): stack is Next 16.3/React 19.2, not Next 15 as originally written. No D-numbered decision affected.
- **`minPresenceAhead` reserves space _after_ the node it is set on.** M0-T3's text says "a role's final bullet gets `minPresenceAhead`", but set there it would guard whatever follows the role, not the bullet. The hint goes on the block immediately _before_ the final bullet. Documented at the top of `lib/layout/document.ts`.
- **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** See defect 1 above — this is not optional and the failure is silent.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff there means the machine-readable output changed; treat it as a product change, not a test annoyance.
- Fixtures live in `src/test/fixtures/resumes.ts` with **hardcoded ids and literal dates** — `createId()` and `openDateRange()` are nondeterministic and would break the determinism tests.
