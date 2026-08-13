# ATS Resume Builder — Execution Plan

> **Status:** Approved blueprint, not yet started. Repository is empty.
> **Owner:** solo, part-time. **Audience:** global. **Intent:** real product, launched.

---

## 0. How To Use This Document

This is the execution reference. It is written so that a future session can pick up any single task without re-deriving context.

**To execute:** name the task ID — _"execute M0-T4"_, _"do M1-T1 through M1-T3"_, _"start M2"_. Each task states its goal, the files it touches, and its acceptance criteria. Do not start a task whose dependencies are unmet.

**Task IDs:** `M<milestone>-T<number>`. Milestones ship independently and in order.

**Rules for whoever executes this:**

1. **§1 decisions are locked.** They were argued and settled. Do not relitigate mid-build. If evidence emerges that a decision is wrong, stop, say so, and get an explicit reversal — then update §1 and note the reversal date.
2. **Acceptance criteria are binary.** A task is done when its criteria pass, not when the code exists.
3. **Never log, transmit, or persist resume content anywhere outside the user's own storage.** This is a product promise, not a preference. It constrains error reporting, analytics, and debugging.
4. **Tests in the same task as the code.** The verification tasks in each milestone are integration-level; unit tests ship with their feature.
5. When reality contradicts an estimate, report the new estimate. Do not silently absorb overrun.

**Estimates** are in focused hours for one part-time developer. Multiply by ~1.4 for calendar weeks at ~10 hrs/week.

---

## 1. Locked Decisions

Each decision below was made against a specific alternative, and the reason is recorded so it survives.

| #   | Decision                                                                                                                                                                                  | Rejected alternative                                | Reason                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Metric-compatible OFL fonts** (Arimo, Carlito, Tinos, Gelasio, EB Garamond, Source Sans 3, Source Serif 4, IBM Plex Sans)                                                               | Arial, Calibri, Georgia, Times New Roman            | Generating a PDF **embeds** the font — that is redistribution of a proprietary binary we have no license for. Metric-compatible substitutes are visually indistinguishable         |
| D2  | **PDF preview = the actual PDF blob**, rendered client-side                                                                                                                               | HTML/Tailwind preview + separate PDF export         | Two layout engines disagree on line wrapping → pagination → page count. Single engine makes drift structurally impossible; also zero server CPU per export                         |
| D3  | **react-pdf paginates; we control breaks declaratively.** Page count is _read back_ from the rendered PDF                                                                                 | Custom layout engine computing pagination ourselves | Own-pagination requires font-metric text measurement and line-breaking from scratch — weeks of work for the same guarantees `wrap={false}` + `minPresenceAhead` already give       |
| D4  | **PDF + DOCX + TXT all ship in M0**                                                                                                                                                       | DOCX deferred to phase 3                            | 2026 cross-platform testing: DOCX ~97% parse accuracy vs ~76% text-PDF vs ~53% designed-PDF. An ATS-first product cannot ship the weaker format first                              |
| D5  | **DOCX references real font names** (Arial, Calibri…); **PDF embeds the OFL twin**                                                                                                        | Same font handling for both                         | Referencing a font _name_ in a document is not redistribution; only embedding is. Because the twins are metric-compatible, both outputs render near-identically. D1 pays off twice |
| D6  | **Guest drafts live in IndexedDB only**                                                                                                                                                   | Anonymous rows in the server DB                     | No anonymous PII, no GC policy, no GDPR erasure obligation to an unidentifiable person. Also: builder works with the server down                                                   |
| D7  | **Google OAuth + email magic link. No passwords, ever**                                                                                                                                   | Credentials auth                                    | Deletes password reset, email verification, breach exposure, and login rate limiting — weeks of security-sensitive work. Resume content still never leaves our infrastructure      |
| D8  | **No AI/LLM API in the product path**                                                                                                                                                     | AI bullet writer                                    | Generic output recruiters now recognize; invents accomplishments users must defend in interviews. "We won't write lies for you" is a marketing asset, not a limitation             |
| D9  | **Litestream → S3-compatible bucket, from M2**                                                                                                                                            | Periodic file copy, or nothing                      | A file DB with no continuous backup means one bad volume loses every user's resumes. Litestream gives point-in-time restore for ~10 lines of config                                |
| D10 | **`schemaVersion` + migration chain from commit one**                                                                                                                                     | Add versioning when needed                          | The single most-regretted omission in JSON-blob apps. The first template change breaks every saved resume without it                                                               |
| D11 | **Rules-based lint**                                                                                                                                                                      | Self-hosted LanguageTool                            | 2–4 GB RAM for marginal gain on a ~200 MB container                                                                                                                                |
| D12 | **"3 issues left" during editing; numeric score on demand**                                                                                                                               | Live 0–100 score badge                              | Gamifying a partly-heuristic number trains users to optimize the number instead of the resume                                                                                      |
| D13 | **PDF/DOCX download is never paywalled**                                                                                                                                                  | Pay-to-download                                     | The most-hated pattern in this category. Free downloads are the marketing hook; monetize tailoring, versions, cover letters                                                        |
| D14 | **Honest ATS claims.** Single-column is "highest-reliability across the widest set of parsers," not "or you get rejected." Filename convention is for the human recruiter, not ATS search | Competitor-standard fear marketing                  | Accuracy is defensible positioning; folklore is not, and §4 makes us the only party who can prove claims                                                                           |

**Stack (locked):** Next.js 15 App Router · TypeScript strict · Tailwind + shadcn/ui · Zustand + IndexedDB · react-hook-form + zod · `@react-pdf/renderer` · `docx` · `pdfjs-dist` · Prisma + better-sqlite3 (M2+) · Auth.js v5 (M2+) · Vitest + Playwright · pnpm.

**Deployment (locked):** Docker on a VM with a persistent volume — Railway, Render, Fly, or a VPS. **Vercel cannot host this** (ephemeral filesystem, no persistent volume for SQLite). Put that in the README; Next.js defaults push everyone to Vercel.

---

## 2. Milestone Map

| Milestone | Delivers                                               | Hours   | Ships to users?         |
| --------- | ------------------------------------------------------ | ------- | ----------------------- |
| **M0**    | Local-first builder, 3 export formats, real pagination | ~99     | **Yes — launchable**    |
| **M1**    | X-Ray parse-back proof                                 | ~35–45  | Yes — this is the wedge |
| **M2**    | Accounts, cloud sync, backups                          | ~45–60  | Yes                     |
| **M3**    | JD matching engine                                     | ~50–65  | Yes                     |
| **M4**    | Depth: import, versions, cover letters, fit assistant  | ongoing | Continuous              |

**Ship M0 publicly before starting M1.** It is a complete, useful product. Feedback from real users before building accounts is worth more than any amount of additional planning.

---

## 2.5 Work Packages — The Invocation Unit

Individual tasks are too granular to commission one at a time; milestones are too large for one sitting. These 14 packages are the unit to work in. **Say "do P3" and this table defines the scope.**

Each package is coherent, ends in something observable, and respects all task dependencies.

| Part                         | Tasks            | Hrs | Done when you can…                                                                               |
| ---------------------------- | ---------------- | --- | ------------------------------------------------------------------------------------------------ |
| **P1** Foundation            | M0-T0, T1, T2    | 13  | Run the app; schema + migration chain tested; all 5 font pairs render with the glyph test green  |
| **P2** Document model + PDF  | M0-T3, T4        | 18  | Turn a fixture JSON into a real PDF on disk, correct pagination, byte-identical across runs      |
| **P3** DOCX + TXT            | M0-T5, T6        | 10  | Produce all three formats from the same model; DOCX opens clean in Word with matching page count |
| **P4** State + builder UI    | M0-T7, T8        | 20  | Type a full resume through every section, refresh, lose nothing; undo/redo works                 |
| **P5** Preview + exports     | M0-T9, T10, T12  | 18  | See live PDF preview with real page chrome, page count, and download all three formats           |
| **P6** Lint + tests + launch | M0-T11, T14, T13 | 20  | "3 issues left" works, full CI suite green, public URL live                                      |
| **P7** X-Ray engine          | M1-T1, T2        | 20  | Re-parse your own PDF/DOCX and score field recovery against ground truth                         |
| **P8** X-Ray UI              | M1-T3, T4        | 14  | Show users the machine's view of their resume; round-trip tests guard it in CI                   |
| **P9** Database + auth       | M2-T1, T2        | 13  | Sign in with Google or a magic link; sessions survive restart                                    |
| **P10** Sync + dashboard     | M2-T3, T4        | 15  | Claim a guest draft on signup; edit on one device, see it on another                             |
| **P11** Backups + privacy    | M2-T5, T6        | 11  | Restore the DB from Litestream to a fresh volume; hard-delete and JSON-Resume export work        |
| **P12** Taxonomy + IDF       | M3-T1, T2        | 16  | Resolve skill aliases; "Kubernetes" outweighs "team"                                             |
| **P13** Scoring engine       | M3-T3, T4        | 18  | Score a resume against a JD — and a stuffed resume scores _lower_ than an honest one             |
| **P14** Score UI             | M3-T5            | 8   | Three gauges with per-keyword provenance, every number traceable to specific text                |

**~214 focused hours total.** P1–P6 (99h) is the launchable product; every part after that ships independently. M4 (§8) is a ranked backlog to pull from against real feedback, not a sequence — do not schedule it here.

### Sequencing notes

**P2 is the decision point.** The top entry in the risk register (§10) is react-pdf's break control proving insufficient. Its natural trigger — the pagination invariants in M0-T14 — sits in P6, which would surface the problem at hour ~91, after the entire UI is built on the assumption. **Therefore: a minimal pagination-invariant test ships inside P2, not P6.** Assert on two fixtures that no role header splits from its first bullet, no bullet splits mid-content, and no page ends on a section heading. If react-pdf cannot hold that line declaratively, take the Chromium escape hatch having spent 31 hours rather than 91. The remaining property-based invariants stay in M0-T14.

**P4 will span sittings.** 20 hours of forms with no natural mid-point — the store alone is not demoable. This is expected; do not read it as slippage.

**M0-T11 (lint) is position-flexible.** It depends only on the schema, so it can move up to P2 if quality feedback while building forms is worth more than shipping the engine at the end.

**Do not reorder across a dependency.** Every package's tasks list its own `depends:` line in §3–6; those bind.

---

## 3. M0 — Local-First Builder

**Goal:** anyone can build an ATS-safe resume and download PDF, DOCX, and TXT. No accounts, no server, no database.

**Definition of Done:** a stranger lands on the URL, builds a two-page resume with an accented name, downloads all three formats, and the DOCX opens in Word with the same page count as the PDF preview showed.

### M0-T0 — Repository and docs (2h)

Scaffold `pnpm create next-app` (TypeScript, App Router, Tailwind, ESLint), add shadcn/ui, Prettier, Vitest, `.editorconfig`, strict `tsconfig`.

Keep `docs/EXECUTION_PLAN.md` (this file) and extract `docs/DECISIONS.md` from §1. `git init`, first commit.

```
src/
  app/(marketing)/          landing
  app/builder/              the builder (client-heavy)
  lib/resume/               schema, types, migrations
  lib/layout/               document model + break hints
  lib/emit/pdf/             react-pdf emitter
  lib/emit/docx/            docx emitter
  lib/emit/text/            plain-text emitter
  lib/fonts/                font registry + files
  lib/lint/                 rule engine (M0 subset)
  components/builder/       step forms
  components/preview/       PDF viewer, page chrome
  store/                    Zustand + persistence
  test/fixtures/            golden resumes
docs/
```

**Accept:** `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint` all pass clean on a bare scaffold.

### M0-T1 — Resume schema, types, migrations (6h) · _depends: T0_

The foundation everything else reads. Get it right; changing it later is expensive.

Zod schemas in `lib/resume/schema.ts` for: `Contact`, `Summary`, `ExperienceEntry`, `EducationEntry`, `SkillGroup`, `ProjectEntry`, `CertificationEntry`, `CustomSection`, and the root `ResumeDocument`.

Root document carries: `schemaVersion: number`, `sections: Section[]` (ordered, each with `visible: boolean`), and `settings: { pageSize: 'A4' | 'LETTER', fontPair: FontPairId, accent: string, density: 'compact' | 'comfortable', margins: number }`.

Dates: store as `{ year: number, month: number | null }` plus a `current: boolean` on end dates. **Never store a formatted date string** — formatting is a render concern, and month-name output (`Jan 2023 – Present`) is chosen precisely because it is locale-unambiguous, unlike `03/04/2023`.

Migration chain in `lib/resume/migrate.ts`: `migrate(doc: unknown): ResumeDocument` applying `v1→v2→v3…` in sequence, with a registry of migration functions. Ship v1 with an identity migration and a test proving the chain runs — the mechanism must exist before it is needed.

**No fields for photo, date of birth, marital status, gender, or nationality.** Their absence is a deliberate product position (M4-T6 handles regions where conventions differ).

**Accept:** round-trip parse/serialize test; migration chain test with a synthetic v0 document; `pnpm test` green.

### M0-T2 — Font pipeline (5h) · _depends: T0_

Vendor the OFL font files into `lib/fonts/files/` (regular, bold, italic, bold-italic per family). Include each family's `OFL.txt` — this is a license condition, not optional.

`lib/fonts/registry.ts` exports font pair definitions:

```ts
{ id: 'classic',   heading: 'Tinos',         body: 'Tinos',         docxName: 'Times New Roman' }
{ id: 'modern',    heading: 'Arimo',         body: 'Arimo',         docxName: 'Arial' }
{ id: 'clean',     heading: 'Carlito',       body: 'Carlito',       docxName: 'Calibri' }
{ id: 'editorial', heading: 'EB Garamond',   body: 'EB Garamond',   docxName: 'Garamond' }
{ id: 'technical', heading: 'IBM Plex Sans', body: 'IBM Plex Sans', docxName: 'Segoe UI' }
```

Register with react-pdf's `Font.register`. Load the same files as `@font-face` webfonts for canvas text measurement (M0-T9).

**Glyph coverage test** — the highest-value cheap test in the project. Assert every family renders `é ñ ü ł ş ā ç ø đ å ö ß ı ğ` without `.notdef`. This bug reaches production silently because you will test with ASCII names.

**Accept:** all pairs render a sample PDF; glyph test passes; total vendored font weight under ~3 MB after subsetting.

### M0-T3 — Document model and break hints (8h) · _depends: T1_

Per **D3**, we do **not** compute pagination. We produce an ordered, semantic block list carrying _keep-together hints_; each emitter enforces them natively.

`lib/layout/document.ts`: `buildDocument(resume: ResumeDocument): DocumentBlock[]` where a block is `{ type, content, keepWithNext?: boolean, keepTogether?: boolean, minPresenceAhead?: number }`.

Rules encoded here, once, for all three emitters:

- A section heading is `keepWithNext` — never ends a page alone.
- A role header (title + company + dates) plus its **first** bullet is `keepTogether` — never split.
- A bullet is `keepTogether` — never splits mid-bullet across pages.
- A role's final bullet gets `minPresenceAhead` so a single orphan bullet cannot land alone on page 2.

Section headings emit the exact ATS-standard strings: `Experience`, `Education`, `Skills`, `Projects`, `Certifications`, `Summary`. Custom sections use the user's label but are ordered last by default.

**Accept:** unit tests asserting hint assignment for a fixture with 1 role, 5 roles, and a role with a single bullet.

### M0-T4 — PDF emitter (10h) · _depends: T2, T3_

`lib/emit/pdf/` — react-pdf components consuming `DocumentBlock[]`.

Map hints to react-pdf props: `keepTogether` → `<View wrap={false}>`; `keepWithNext` / `minPresenceAhead` → `minPresenceAhead` on the preceding view. Page size from `settings.pageSize` — A4 and Letter differ ~6% in height, which changes pagination, so both are first-class.

Hard constraints, enforced by the emitter having no capability to do otherwise: single column, no `<Image>`, no fixed headers/footers, no absolute positioning, real text only.

`renderPdf(resume): Promise<{ blob: Blob, pageCount: number }>` — render via `pdf(doc).toBlob()`, then read `numPages` with `pdfjs-dist`. **Page count is measured from the artifact, never estimated.**

**Determinism:** pin the PDF `CreationDate` and document ID to fixed values so identical input yields byte-identical output. This makes diffing and caching real and catches nondeterministic layout bugs.

**Accept:** golden-file test — render 4 fixtures, snapshot extracted text; byte-identical output across two runs; no fixture violates a break rule.

### M0-T5 — DOCX emitter (8h) · _depends: T3_

`lib/emit/docx/` using the `docx` package. This output is the one most ATS parse best (**D4**) — treat it as primary, not a fallback.

- Use **real named paragraph styles** (`Heading1`, `Heading2`, `Normal`). DOCX parses well precisely because its XML exposes style names; literal bold runs throw that signal away.
- Hints map natively: `keepWithNext` → `keepNext: true`; `keepTogether` → `keepLines: true`.
- Bullets via **native numbering definitions**, not literal `•` characters.
- Page size in twips: A4 `11906 × 16838`, Letter `12240 × 15840`. Margins converted from the shared settings.
- Fonts by **name** per **D5** — `docxName` from the registry, with a fallback chain for machines lacking it.
- No tables, no text boxes, no headers/footers, no images. Same constraints as PDF.

**Accept:** generated DOCX opens clean in Word, LibreOffice, and Google Docs; `mammoth` extraction matches the TXT emitter's output modulo whitespace; page count matches the PDF for all fixtures.

### M0-T6 — Text emitter (2h) · _depends: T3_

Plain text for pasting into application textareas. Section headings in caps, `- ` bullets, blank line between sections, no box-drawing or Unicode decoration. Doubles as the canonical extraction target for tests.

**Accept:** output is pure ASCII except for characters the user actually typed; round-trips through a textarea unchanged.

### M0-T7 — Store, persistence, undo/redo (6h) · _depends: T1_

Zustand store in `store/resume.ts`. Persist to **IndexedDB** (`idb-keyval` as the `persist` storage adapter — `localStorage` is too small and synchronous). Per **D6**, nothing leaves the browser in M0.

Undo/redo via a bounded command history (~50 entries) with coalescing so typing a bullet is one undo step, not forty. Users editing prose need this and will assume it exists.

Autosave: debounce 500ms after last keystroke, plus flush on blur and on `visibilitychange`.

**Accept:** hard refresh mid-edit loses nothing; undo/redo across all field types; a "clear all data" control that genuinely empties IndexedDB.

### M0-T8 — Builder UI (14h) · _depends: T7_

Step forms in `components/builder/` using react-hook-form + zod resolvers, in order: Contact → Summary → Experience → Education → Skills → Projects → Certifications → Custom.

- Repeatable entries: add / remove / reorder (drag-and-drop via `dnd-kit`).
- Progress indicator across steps; steps are freely navigable, not a forced wizard.
- **Empty states carry this product.** Every section needs a real, well-written example — not "No items yet." For a fresher with no jobs, the Projects empty state is the single most important screen in the app.
- Keyboard-first: `Ctrl/Cmd+Enter` adds the next bullet, `Ctrl/Cmd+K` opens a command palette to jump sections, correct tab order throughout.
- Section reorder and show/hide toggles.

**Accept:** full resume buildable with keyboard only; every field validates with a useful message; mobile viewport usable at 390px.

### M0-T9 — Preview pane (10h) · _depends: T4, T8_

Per **D2**, the preview _is_ the PDF. Render the blob with `pdfjs-dist` to canvas.

- Debounce re-render ~400ms after last edit; render in a Web Worker so typing never stutters.
- **Show real page chrome**: discrete pages with drop shadows, visible boundaries, page count. Not an infinite scroll of content — this single detail is most of what makes the product feel like a document tool instead of a form.
- Zoom with fit-width / fit-page / 100%.
- Keep the previous rendered frame visible during re-render; never flash blank.
- Desktop: split screen. Mobile: tabbed.

Also build `lib/layout/measure.ts` — canvas `measureText` against the same webfont at the same size and column width, to answer "how many lines is this bullet?" for M0-T10 and M4. Authoritative page count still comes from the rendered PDF (**D3**); this is only for line-level hints.

**Accept:** typing stays at 60fps during continuous edits; preview matches downloaded PDF exactly (it is the same artifact); page count visible at all times.

### M0-T10 — Page-fit indicator (4h) · _depends: T9_

M0 scope is the indicator only; the full assistant is M4-T3.

Show `1.0 pages` / `1.3 pages — 4 lines over`. When within ~15% of a page boundary, offer the one highest-value suggestion with live before/after preview: margin tightening, density change, or the specific bullet whose length is causing the overflow (from `measure.ts`).

**Accept:** overflow amount is accurate to within one line across all fixtures; accepting a suggestion visibly changes page count.

### M0-T11 — Lint engine, M0 rule subset (6h) · _depends: T1_

`lib/lint/` — ESLint framing per **D11/D12**: each rule has a stable ID, severity (`error` / `warning` / `info`), a message, a one-line _why this matters_, and is dismissible with a reason.

M0 rules: missing contact fields · no email or phone · date format inconsistency · end date before start date · bullets that are paragraphs (>2 lines or >40 words) · `responsible for` / `helped with` / `duties included` · first-person pronouns · weak or missing leading action verb · no quantified outcome in a role · word count outside 300–800 · empty visible section.

UI: **"3 issues left"** during editing (**D12**), expanding to the list on click.

**Accept:** each rule has a unit test with a passing and failing fixture; each has non-generic _why_ text.

### M0-T12 — Export UI (4h) · _depends: T4, T5, T6_

Download buttons for all three formats. Filename `FirstName_LastName_Resume.pdf` — noting in the tooltip that this is for the **human recruiter's downloads folder**, per **D14**, not ATS search.

**Per-destination format recommendation** — a feature no competitor ships, costing one lookup table: _"Applying through Workday or Taleo? Download DOCX. Greenhouse, Lever, Ashby, or emailing a person? PDF."_

**Accept:** all three download correctly in Chrome, Firefox, Safari; filename correct including accented names (transliterate for the filename only, never the content).

### M0-T13 — Landing page and deploy (6h) · _depends: all_

Honest positioning per **D14** — no "beat the bots" fear marketing, no "guaranteed to pass." Lead with what is true: free downloads forever, nothing sent to an AI, works without an account.

Dockerfile (`node:20-bookworm-slim`), deploy to a VM host, custom domain, HTTPS. Privacy policy and terms — required before launch, not after (§9).

**Accept:** public URL, Lighthouse ≥ 90 on the landing page, builder loads under 3s on a throttled connection.

### M0-T14 — Verification suite (8h) · _depends: all_

Because "ATS-safe" is the claim being monetized, it needs a test suite rather than a design review.

- **Fixtures** in `test/fixtures/`: one-page fresher · two-page mid-career · no experience (projects only) · accented and non-Latin names · very long company names · 15-year career · every section empty but one.
- **Golden-file tests** — render each fixture to PDF and DOCX, snapshot extracted text. Any layout change altering extraction fails CI.
- **Pagination invariants** — property tests over randomly generated content lengths: no orphaned bullet, no split role header, no page ending on a section heading.
- **Glyph coverage** (from M0-T2) wired into CI.
- **Determinism** — same input twice, byte-identical PDF.
- **Cross-format page parity** — PDF and DOCX page counts agree on every fixture.
- **Manual pass** — build a resume end-to-end on a real phone; open each DOCX in Word, LibreOffice, and Google Docs (they paginate differently; verify the count holds).

**Accept:** all green in CI; manual pass documented in `docs/QA.md`.

> **Ship M0 here.** Post it publicly. Gather feedback for a week before M1.

---

## 4. M1 — X-Ray (The Wedge)

**Goal:** stop _claiming_ ATS-friendly and start _proving_ it. Every competitor claims; none proves. We can, because we hold the ground truth.

**Definition of Done:** a user sees the literal machine-extracted text of their own resume, plus a field-recovery scorecard graded against the data they entered.

### M1-T1 — Extraction layer (8h)

`lib/xray/extract.ts`. PDF via `pdfjs-dist` `getTextContent()`; DOCX via `mammoth` plus direct `word/document.xml` parsing for structure.

Two deliberately different PDF strategies:

- **A — stream order:** items in content-stream order (what a naive parser sees).
- **B — geometric:** sort by descending y with tolerance-based line clustering, then x (what a good parser does).

**Accept:** both strategies run on all M0 fixtures; output is stable across runs.

### M1-T2 — Field recovery scorecard (12h) · _depends: T1_

The crucial trick: **we know the correct answer.** Re-parse our own output and grade it against `ResumeDocument`, producing a _measured_ score where competitors can only offer heuristics.

Extract from the text: name (first-line heuristic), email (regex), phone (`libphonenumber-js`), and per role: title, company, start date, end date. Compare to ground truth with normalized fuzzy matching. Score = weighted % recovered — contact fields and the most recent role weighted highest.

**Accept:** 100% recovery on every M0 fixture. Anything less is a bug in _our_ emitters, and finding those bugs is exactly the point of this feature.

### M1-T3 — X-Ray UI (10h) · _depends: T1, T2_

- **Layer 1:** side-by-side — rendered resume, and the plain text a machine recovers. Instantly legible, instantly convincing.
- **Layer 2:** the scorecard, field by field, green/red, with the recovered value shown next to the true value.
- **Layer 3:** where strategies A and B disagree, flag it — that is precisely where real-world parsers diverge.

Copy: _"Every other builder tells you it's ATS-friendly. We show you what the machine actually read."_

**Accept:** a deliberately broken fixture (photo, header contact, two-column) surfaces visible failures; a clean fixture shows 100%.

### M1-T4 — Round-trip tests in CI (4h) · _depends: T2_

M1-T2 running as a test: generate → re-parse → assert every field recovers, on every fixture, both formats. This is the regression net that keeps the central product claim true as the emitters evolve.

**Accept:** CI fails if any field recovery regresses.

---

## 5. M2 — Accounts and Cloud

**Goal:** save resumes across devices, without weakening the privacy position.

### M2-T1 — Prisma, SQLite, pragmas (5h)

Schema per §7. On every connection: `PRAGMA journal_mode=WAL; busy_timeout=5000; synchronous=NORMAL; foreign_keys=ON`.

Note in code comments that `better-sqlite3` is **synchronous** — a slow query blocks the event loop for every user. Keep queries indexed and small.

`Json` columns on SQLite are TEXT and are **not queryable or indexable** — denormalize anything sortable or filterable (`lastScore`, `pageCount`, `wordCount`) into real columns.

**Accept:** migrations run clean; pragma values asserted in a test.

### M2-T2 — Auth.js: Google + magic link (8h) · _depends: T1_

Per **D7**, no passwords. Prisma adapter, sessions in the same SQLite file. Transactional email provider for magic links (allowed infra — it carries a login link, never resume content).

**Accept:** both flows work end-to-end; sessions survive restart; sign-out clears everything.

### M2-T3 — Draft claiming (5h) · _depends: T2_

On first sign-in, detect the IndexedDB draft and offer to claim it: local → server, then clear local. Handle the conflict case (existing server resumes) by creating a new resume rather than overwriting.

**Accept:** guest → signup → draft preserved intact; no data loss on any path including mid-flow abandonment.

### M2-T4 — Sync, dashboard, multiple resumes (10h) · _depends: T3_

Server autosave alongside local (local stays the write-through cache, so the builder still works offline). Dashboard listing resumes with title, updated date, page count, last score. Duplicate, rename, delete.

**Accept:** edits on device A appear on device B; offline edits sync on reconnect; deletes are hard deletes.

### M2-T5 — Litestream and restore rehearsal (5h) · _depends: T1_

Litestream sidecar streaming the WAL to an S3-compatible bucket (**D9**).

**Then actually restore it.** Take a real backup, restore to a fresh volume, verify data integrity, and write the runbook in `docs/RUNBOOK.md`. An untested backup is not a backup, and this is the single largest tail risk in the whole architecture.

**Accept:** documented, rehearsed restore with a measured RPO/RTO.

### M2-T6 — Privacy and account controls (6h) · _depends: T4_

Hard-delete account and all resumes. JSON export in **JSON Resume schema** (`jsonresume.org`) — interop, portability, a trust signal, and GDPR data-export for free. No third-party analytics on builder routes, ever. Error reporting scrubbed of resume content.

**Accept:** delete removes every row across all tables (test asserts this); export re-imports cleanly.

---

## 6. M3 — JD Matching Engine

**Goal:** a keyword score that is accurate, explainable, and structurally impossible to game. A naive TF-IDF + overlap design produces a number that rewards exactly the keyword-stuffing we want to prevent; this fixes all four failure modes.

### M3-T1 — Skill taxonomy (10h)

Ingest **ESCO** (~13k skills, CC BY 4.0) and **O\*NET** (CC BY 4.0) into `data/skills.json`: canonical name, aliases, category. Add a hand-curated tech alias list — `JS`/`JavaScript`/`ES6`, `GCP`/`Google Cloud Platform`, `RN`/`React Native`, `k8s`/`Kubernetes`.

**Verify current license terms before shipping** and record attribution in `docs/ATTRIBUTION.md`.

Fixes the synonym failure: without this, users see obviously-wrong "missing keywords" and stop trusting the tool immediately.

**Accept:** alias lookup resolves a 50-case test set; bundle under ~2 MB.

### M3-T2 — IDF corpus (6h)

TF-IDF needs document frequency across _many_ documents; a single pasted JD provides none, which is why a naive design weights "team" like "Kubernetes."

Ship a **precomputed IDF table** as a static asset, built from a public job-posting dataset. Weaker but acceptable fallback: a general English word-frequency list used as an inverse proxy (rare word → high weight).

**Accept:** "Kubernetes" outweighs "team" by a wide margin on a spot-check set.

### M3-T3 — JD structure parser (6h)

Real JDs are structured. Detect `Requirements` / `Required` / `Must have` vs `Preferred` / `Nice to have` / `Bonus` vs `Responsibilities` vs `About us`. Weight required ≈ 3× preferred; ignore boilerplate sections entirely.

**Accept:** correct section split on 10 real JDs collected from public postings.

### M3-T4 — Scoring engine (12h) · _depends: T1, T2, T3_

- **Section-weighted evidence:** a skill demonstrated in an Experience bullet scores far more than the same word in a Skills list. Say so in the UI — it teaches the right behavior.
- **Per-keyword caps:** the 8th mention of "Python" earns nothing.
- **Explicit anti-stuffing penalty:** density above threshold _deducts_, with the reason shown. Reaching 100 by stuffing must be structurally impossible.
- **Provenance on every keyword:** _"'Terraform' — 3 mentions in the JD, including under Requirements. Not found in your resume."_
- Combine with formatting (from the lint engine) and impact/action-verb scores into a breakdown — never one opaque number.

**Accept:** a stuffed resume scores _lower_ than an honest one against the same JD. This is the acceptance test that matters.

### M3-T5 — Score UI (8h) · _depends: T4_

Three independent gauges plus the checklist, not a single number. Every component links to a one-line "why this matters." Missing-keyword list is advisory, with an explicit note that stuffing is detected and penalized.

**Accept:** every score component is traceable to specific resume text.

---

## 7. Data Model

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  resumes   Resume[]
}

model Resume {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title         String
  content       Json                          // ResumeDocument
  schemaVersion Int      @default(1)          // D10 — never remove
  pageSize      String   @default("A4")       // "A4" | "LETTER"
  lastScore     Int?                          // denormalized: Json is not queryable on SQLite
  pageCount     Float?
  wordCount     Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  versions      ResumeVersion[]
  scoreChecks   ScoreCheck[]
  parseChecks   ParseCheck[]
  @@index([userId, updatedAt])
}

model ResumeVersion {                          // required for diffing — cannot be retrofitted
  id        String   @id @default(cuid())
  resumeId  String
  resume    Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  content   Json                               // immutable snapshot
  label     String?                            // "Sent to Google, 12 Aug"
  createdAt DateTime @default(now())
  @@index([resumeId, createdAt])
}

model ScoreCheck {
  id             String   @id @default(cuid())
  resumeId       String
  resume         Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  jobTitle       String?
  jobDescription String
  overallScore   Int
  breakdown      Json
  createdAt      DateTime @default(now())
}

model ParseCheck {                             // X-Ray results
  id            String   @id @default(cuid())
  resumeId      String
  resume        Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  format        String                         // "PDF" | "DOCX"
  fieldRecovery Json                           // per-field pass/fail vs ground truth
  recoveryScore Int
  createdAt     DateTime @default(now())
}
```

**No `Template` model.** With one layout engine, a "template" is four values in `settings` (font pair, accent, density, section order) and belongs inside `content`.

`onDelete: Cascade` everywhere is what makes M2-T6's hard delete actually complete.

---

## 8. M4 — Depth (Ongoing, Prioritized)

Ordered by value per hour. Reassess against real user feedback after M0 ships rather than committing now.

| #      | Feature                                     | Hours | Notes                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4-T1  | **Resume import** (PDF/DOCX → prefill)      | 12    | Reuses the entire M1 extraction layer; biggest onboarding unlock                                                                                                                                                                                                     |
| M4-T2  | **Version diff**                            | 10    | Needs `ResumeVersion` from M2; visual diff of two snapshots                                                                                                                                                                                                          |
| M4-T3  | **Full one-page fit assistant**             | 14    | Ranked suggestions + bounded auto-fit: margins 0.5–0.85in, body 10–11.5pt, leading 1.0–1.25, with hard legibility floors. Binary-search the parameter space in a worker against real rendered page counts                                                            |
| M4-T4  | **Cover letter builder**                    | 12    | Reuses the data model; top-3 requested feature everywhere. Move earlier if users ask                                                                                                                                                                                 |
| M4-T5  | **Application autofill preview**            | 8     | Shows the Workday-style form pre-filled as it will actually land. Marginal cost is UI — the engine is M1-T2                                                                                                                                                          |
| M4-T6  | **Regional convention engine**              | 10    | Photo expected in Germany / liability in the US-UK; DOB conventional in parts of Asia, never in North America; page-length norms; signature lines. Nearly free given the global audience, and genuinely unique                                                       |
| M4-T7  | **Bullet Coach** (scaffold, never generate) | 12    | Parse a bullet into Action / What / How / Outcome, detect the missing part, ask a question — _"no measurable result. What changed? Think %, time saved, count, scale."_ Never writes text (**D8**)                                                                   |
| M4-T8  | **Fresher mode**                            | 8     | Beyond reordering: evidence sourcing — coursework projects, hackathons, club leadership, TA work, open source, competitive programming, plus a "what counts as experience" guide. Most builders assume you already have jobs; that assumption is why students bounce |
| M4-T9  | **Recruiter 6-second view**                 | 6     | F-pattern overlay. Cheap (we own the coordinates), striking, shareable                                                                                                                                                                                               |
| M4-T10 | **Truth-preserving JD tailoring**           | 10    | Rank the user's _existing_ bullets by JD relevance; never generate. Gaps listed as things to honestly address                                                                                                                                                        |

---

## 9. Cross-Cutting Requirements

Apply to every task; not separately scheduled.

**Privacy (product promise, not preference).** Resume content is never logged, never sent to third parties, never used for training, never passed to an AI API. Error reports are scrubbed. No third-party analytics on builder routes. Self-hosted or no analytics.

**Data protection.** GDPR applies given the global audience: hard delete, data export (JSON Resume), data minimization (no photo/DOB/marital-status fields at all), privacy policy live before launch.

**Claims discipline.** Never state or imply "guaranteed to pass ATS," "beat the bots," or a specific interview-rate lift. Per **D14**, accuracy is the position — and per §4, we are the only ones who can actually substantiate a parse claim.

**Accessibility.** Builder is keyboard-navigable end to end; WCAG AA contrast; accent-color picker rejects combinations failing contrast against white.

**Performance budget.** Builder interactive under 3s on throttled 4G; preview re-render under 400ms; typing never drops frames.

---

## 10. Risk Register

| Risk                                              | Impact                      | Mitigation                                                                                                                                                                 | Trigger to act                                                     |
| ------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| react-pdf break control proves insufficient       | High — core layout          | Escape hatch: headless Chromium (Playwright) printing HTML, giving real `break-inside: avoid`, `orphans`/`widows`, tagged PDF. Costs ~400 MB image + per-export server CPU | A pagination invariant in M0-T14 cannot be satisfied declaratively |
| Client-side PDF render too slow on low-end phones | Medium                      | Worker + 400ms debounce already planned; fall back to render-on-demand rather than live                                                                                    | p95 render >1s on a mid-range Android                              |
| Font glyph gaps for non-Latin names               | High — silent trust failure | M0-T2 glyph test in CI; consider Noto fallback chain                                                                                                                       | Any user report, or CI failure                                     |
| SQLite write contention at scale                  | Low near-term               | WAL + short queries. Prisma makes the Postgres migration a config change, not a rewrite                                                                                    | Sustained `SQLITE_BUSY` in logs                                    |
| Volume loss                                       | **Catastrophic**            | Litestream + **rehearsed** restore (M2-T5)                                                                                                                                 | Must be closed before M2 ships                                     |
| ESCO/O\*NET license terms changed                 | Medium                      | Verify at M3-T1; keep the curated alias list independent and owned                                                                                                         | At ingest time                                                     |
| Part-time velocity slips                          | Certain                     | Every milestone independently shippable; M0 alone is a real product                                                                                                        | Report new estimates, don't absorb overrun                         |

---

## 11. Monetization (Decide After M0 Feedback)

Per **D13**, downloads are never paywalled — that is the marketing hook. Candidate paid tier: JD tailoring beyond N/month · version history · cover letters · more than 3 resumes. Free forever: unlimited builds, all three export formats, X-Ray, lint.

Do not build billing before M3. Talk to the first hundred users first.

---

## 12. Open Questions

Not blocking; resolve when the relevant task starts.

1. **IDF corpus source** (M3-T2) — a public job-posting dataset, or the word-frequency proxy? Decide at task start based on what is actually available and cleanly licensed.
2. **Hosting** (M0-T13) — Railway, Render, Fly, and a plain VPS all work. Pick on price at deploy time; the Docker image is portable across all of them.
3. **Domain and product name** — needed before M0-T13.
4. **Whether M4-T4 (cover letters) jumps ahead of M3** — decide from post-M0 user feedback, not from this document.

---

## Appendix — Source Notes

ATS parsing claims in D4 and D14 rest on:

- [How Resume Parsers Actually Work: Inside Workday, Greenhouse, Lever, iCIMS, Taleo](https://resumeoptimizerpro.com/blog/how-resume-parsers-actually-work)
- [Workday Resume Format: What the Parser Actually Reads](https://resumeoptimizerpro.com/blog/workday-resume-format)
- [PDF vs DOCX Resume: ATS Parsing Data (2026)](https://resumeoptimizerpro.com/blog/why-not-to-use-pdf)
- [Resume File Format in 2026: PDF vs DOCX vs Google Doc — HiroCV](https://hirocv.com/blog/resume-file-format-pdf-vs-docx)
- [The State of Resume Parsing: Does ATS Read Two-Column Resumes? — Enhancv](https://enhancv.com/blog/ats-resume-parsing/)
- [Are Two-Column Resumes ATS-Friendly? (2026 Test) — ATS Verification](https://atsverification.com/blog/two-column-resume-ats-friendly/)
- [10 Most Common ATS Resume Parsing Failures (2026)](https://atsverification.com/blog/10-most-common-ats-parsing-failures/)

Note the two-column evidence is genuinely contested between sources — which is precisely why D14 states single-column as _highest-reliability_ rather than _mandatory_.
