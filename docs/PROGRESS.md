# Progress Tracker

> Reference for future sessions: what's done, what's next, and where to pick up.
> Task IDs and package IDs (`P1`, `M0-T3`, …) refer to `docs/EXECUTION_PLAN.md`.
> Update this file as work completes — one line per task, moved from Next → Done.

**Last updated:** 2026-08-31

---

## Status at a glance

**M0, M1, and M2 are complete except M2-T5's off-site replication. M3 has its
structure parser only. M4 has not started, deliberately.** 1,171 unit tests and
27 Playwright tests pass; `docs/QA.md` lists the seven checks this environment
cannot run.

| Package                  | Tasks                         | Status                     |
| ------------------------ | ----------------------------- | -------------------------- |
| P1 Foundation            | M0-T0, T1, T2                 | ✅ Done (commit `578cc73`) |
| P2 Document model + PDF  | M0-T3, T4                     | ✅ Done                    |
| P3 DOCX + TXT            | M0-T5, T6                     | ✅ Done                    |
| P4 State + builder UI    | M0-T7, T8                     | ✅ Done                    |
| P5 Preview + exports     | M0-T9, T10, T12               | ✅ Done                    |
| P6 Lint + tests + launch | M0-T11, T14, T13              | 🔶 Code done, deploy owed  |
| P7 X-Ray engine          | M1-T1, T2                     | ✅ Done                    |
| P8 X-Ray UI              | M1-T3, T4                     | ✅ Done                    |
| P9 Database              | M2-T1                         | ✅ Done                    |
| P10 Auth + accounts      | M2-T2, T3, T4\*, T6\*         | ✅ Done                    |
| P11 Sync                 | M2-T4                         | ✅ Done                    |
| P12 JSON Resume interop  | M2-T6                         | ✅ Done                    |
| P13 JD structure parser  | M3-T3                         | ✅ Done                    |
| P14 Production hardening | —                             | ✅ Done                    |
| P15 Launch surfaces      | —                             | ✅ Done                    |
| Remaining                | M2-T5\*\*, M3-T1/T2/T4/T5, M4 | ⬜ Next                    |

\* P10 delivered the dashboard half of M2-T4 and the deletion half of M2-T6;
P11 and P12 completed them. Both tasks are done.

\*\* M2-T5's local half is done and rehearsed on every push — snapshot, verify,
restore (`src/server/backup.test.ts`). Only off-site replication to a bucket is
outstanding, and it needs S3 credentials and a Docker host.

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

### P9 — Database layer (M2-T1)

- `prisma/schema.prisma` — the §7 data model, plus Auth.js tables. No password column anywhere and there never will be (D7); a test asserts it.
- `src/server/db.ts` — connection with the four required pragmas, each documented with the consequence of omitting it.
- Migration created and applied; 9 tests covering clean migration, asserted pragma values, cascade delete across every table (M2-T6's hard delete depends on it), and the denormalized columns.
- `prisma generate` wired into `prebuild`, `pretypecheck`, and CI — the client is generated, not committed.

**Prisma 7 is not the Prisma you know.** `url` is no longer allowed in the schema's datasource block: the migration connection string moved to `prisma.config.ts`, and the runtime client takes a driver adapter (`@prisma/adapter-better-sqlite3`). Prisma 7 also does not read `.env` on its own — `prisma.config.ts` loads it explicitly, because the failure otherwise reads as a missing config rather than a missing file. The CLI's `latest` tag currently resolves to an 8.0 release candidate; both CLI and client are pinned to 7.10.0.

`getPrisma()` is lazy and returns a promise. Importing a module must not open a database connection as a side effect — eager construction makes the module unimportable wherever `DATABASE_URL` is absent and turns a config problem into an import error far from its cause.

### P10 — Auth, accounts, and the dashboard (M2-T2, M2-T3, M2-T4 in part, M2-T6 in part)

The previous session left M2-T2 undone because its acceptance is "both flows
work end-to-end" and neither could be verified without buying credentials.
That reasoning was right about the standard; it was wrong that the standard
was unreachable. **Delivery is now a seam, so the email flow is verified for
real.**

**Auth (M2-T2)**

- `src/server/auth/mail.ts` — `MailTransport` with three implementations:
  `smtpTransport` (production, lazy-imports nodemailer), `outboxTransport`
  (writes each message to disk for local development), `memoryTransport`
  (unit tests). `resolveMailTransport` picks from the environment, always
  preferring a configured `EMAIL_SERVER`. **The outbox throws under
  `NODE_ENV=production`** — a deploy that forgets `EMAIL_SERVER` must fail
  loudly, not write everyone's sign-in links to the server's disk.
- `src/server/auth/email.ts` — the message. No remote asset of any kind (a
  remote image is a tracking pixel whether or not it was meant as one), no
  resume content, and it states that the link is single-use and when it
  expires. Tests assert all three as policy.
- `src/server/auth/config.ts` — `buildAuthConfig` as a pure function of its
  dependencies, so provider composition is unit-testable without booting
  Next or opening a database. Email provider always; Google only when both
  credential halves are present.
- `src/server/auth/errors.ts` — Auth.js codes translated into something
  actionable. `OAuthAccountNotLinked` matters most: it is the likeliest error
  in a two-provider passwordless setup and reads as "my account is broken" if
  left as a code.
- `src/server/auth/session.ts` — `requireSessionUser()`. The gate is here and
  in every action, **not in `proxy.ts`**: proxy is documented as CDN-edge
  deployable (where `better-sqlite3` cannot load), and it only sees page
  requests, while Server Actions are reachable by direct POST.
- `/signin`, `/signin/check-email`, `/dashboard`, and the Auth.js route
  handler. `/signin` doubles as `pages.error`, so a failure lands on the
  screen that can fix it.

**Draft claiming (M2-T3)** — `claimDraft` plus `ClaimDraftPrompt`. Ordering is
the whole design: read local → send → **wait for confirmation** → clear local.
Every failure path leaves the draft exactly where it was. It always creates a
new resume, never overwrites: an unwanted extra costs one click to delete, an
overwrite destroys work with no other copy.

**Dashboard (M2-T4, in part)** — `src/server/resumes.ts` and `ResumeList`:
list, rename, duplicate, hard delete. Sync is not done.

**Account deletion (M2-T6, in part)** — `src/server/accounts.ts`. One
statement, because the cascades do the work; the test asserts row counts
across every table rather than the return value, because the way this breaks
is `foreign_keys` being off, not a wrong boolean. JSON Resume export is not
done.

- 76 new unit tests (998 total) and 9 new E2E tests (15 total). All green.

#### Ownership is an argument, never an inference

Every function in `resumes.ts` takes `userId` first and puts it in the `where`
clause — `updateMany({ where: { id, userId } })`, not `update({ where: { id } })`.
The wrong owner changes zero rows and the caller sees "not found", rather than
the row being located, modified, and only then checked. There is no code path
that loads a resume by id alone, so there is no code path an authorization
check can be forgotten on.

#### Five things this ran into

1. **`@prisma/client-runtime-utils` was unresolvable.** The generated client
   lives at `src/generated/prisma/`, outside `node_modules`, so its imports
   resolve from the project root — where pnpm's strict layout does not expose
   its parent's dependencies. Choosing a custom `output` makes the generated
   code's runtime dependencies yours; it is now a direct dependency.
2. **`emailVerified` was missing from `User`.** §7's data model omitted it,
   but Auth.js's Prisma adapter writes it on create and again on callback. The
   failure was `Unknown argument 'emailVerified'` from Prisma — nothing about
   auth at all. Added, with a migration. `image` was deliberately **not**
   added: the Google profile mapper drops the avatar URL rather than storing
   personal data nothing renders.
3. **A `"use server"` file can only export async functions.** `EMPTY_SIGN_IN_STATE`
   was a plain object export in `actions.ts`, which fails the build (types are
   erased and would have been fine). It lives in `./state.ts` now.
4. **The dev outbox and the E2E build are incompatible by design.** `next start`
   runs with `NODE_ENV=production`, which the outbox refuses. Rather than
   weaken the guard, the E2E run points the **real** SMTP transport at a
   capture server — so the production path is what gets tested, and nodemailer's
   quoted-printable wrapping of the long sign-in URL has to be undone before
   the link can be read back (`e2e/mail-server.ts`).
5. **`getByRole("alert")` is ambiguous in Next.** There is always a
   permanently-present, empty route announcer with that role.

#### Two deliberate deviations

- **Account linking stays off.** Signing in by magic link and later using
  Google with the same address gives `OAuthAccountNotLinked` rather than
  merging. Automatic linking trusts a provider's email claim; the recovery
  here is good (the magic link always works), so the sign-in page explains it
  rather than the config weakening it.
- **The privacy policy was rewritten as part of this work, not after it.** The
  previous version said there was "no account system and no database" and
  promised to be updated _before_ that changed. It now describes both paths,
  and states plainly that JSON export does not exist yet rather than implying
  it does.

### P11 — Sync (M2-T4)

Completes M2-T4: "edits on device A appear on device B; offline edits sync on
reconnect; deletes are hard deletes."

- `src/store/sync.ts` — the push queue. Pure module: no server action, no
  `next/*` import, nothing to stub. Debounced at 2s (the local autosave stays
  at 500ms and never waits on it), retries with a levelling-off backoff, and
  short-circuits the wait when `online` fires.
- `src/app/builder/actions.ts` — one action, re-reading the session and
  passing the user id into the `where` clause. The document arrives untrusted
  and goes through the migration chain, so a direct POST cannot write
  arbitrary text into the content column.
- `src/components/builder/serverSync.ts` — the concrete push. **Dynamically
  imported**, so a guest session never loads the `next-auth` tree behind it.
- `/builder?resume=<id>` loads a saved resume server-side. Without the
  parameter, and for anyone signed out, the builder behaves exactly as it did
  in M0 — D6 survives accounts existing, and an E2E test asserts it.
- `SyncStatus` in the builder footer, plus Open links from the dashboard and
  from the claim confirmation.
- 11 unit tests for the queue, 3 E2E tests: guest stays local, an edit on one
  browser appears in another, and an offline edit reaches the server on
  reconnect.

#### Local wins over the server, but only when it has something to win with

On opening `?resume=X`, the local draft is consulted first. If it names the
same resume **and** carries `pendingSync: true`, this browser holds edits the
server never received — made offline, or with the tab closed mid-push — and
they are adopted and pushed. Otherwise the server copy wins.

`pendingSync` is a flag rather than a timestamp comparison on purpose.
Deciding "is local newer?" by comparing a browser clock to a server clock is
wrong whenever the two disagree, and a user with a fast clock would silently
overwrite good server state. The flag is set and cleared by the same device
that owns both events.

#### Two bugs the tests caught

1. **The backoff skipped its first entry.** `attempt += 1` ran before the
   delay was read, so the first retry waited 5s instead of 1s. Found by the
   test that asserts each successive wait, not by the one that asserts a
   retry happens at all.
2. **`getByRole("link", { name: "Open" })` matched "Open the builder"** in the
   dashboard header — a substring match, reached first, carrying no id. The
   test looked like a routing bug for a few minutes.

#### Page count comes from the preview, not from the server

`Resume.pageCount` is measured from the rendered PDF (D3) and pushed with the
document. The server does not render and never guesses: a resume that has not
been previewed shows "—" on the dashboard rather than a predicted number that
could disagree with the download.

### P12 — JSON Resume interop (M2-T6)

Completes M2-T6: "JSON export in JSON Resume schema… export re-imports
cleanly."

- `src/lib/interop/json-resume.ts` — `toJsonResume` / `fromJsonResume`,
  mapped against the published v1.0.0 schema (fetched, not recalled).
- `GET /api/account/export` — every resume on the account, each a standalone
  JSON Resume document, in a thin envelope. A route handler rather than a
  Server Action because the point is to hand the browser a file: a real
  `Content-Disposition` response downloads from a plain anchor with no
  JavaScript involved.
- A JSON Resume download in the builder's export panel, and an import beside
  "Clear all data" that goes through the **history stack** — Ctrl+Z brings the
  previous draft back, which is a better guarantee than a confirmation dialog
  asking for a decision before the user can see the result.
- 34 unit tests, including the round trip over all seven fixtures and an
  idempotence check, plus 2 E2E tests.

#### `additionalProperties: false` at the root decided the design

The schema forbids unknown top-level keys and permits them everywhere else.
So everything JSON Resume has no place for — section order, section
visibility, custom sections, our rendering settings — lives under
`meta.x_atsResumeBuilder`, and per-entry extras (`x_id`, `x_credentialId`)
live on the entries. The file stays valid for a third-party consumer _and_
lossless for us. Without the extension block, re-importing your own export
would silently reorder your resume.

`fromJsonResume` works on a foreign file too, falling back to the default
section order and settings — which is the right answer when the source
genuinely had none. Settings from a file are re-parsed through the schema
rather than trusted: they drive page geometry, and a hand-edited `fontSizePt`
of 400 would render a broken PDF rather than an ugly one.

#### Two things the mapping had to decide rather than copy

- **Education bullets have no standard field.** JSON Resume offers `courses`,
  which these are not — a bullet describes what someone did, a course is a
  subject they sat. Exported as `highlights` (clearly named, non-standard),
  and `courses` is _read_ on import so a foreign file's data is not dropped.
- **Our location is one string; JSON Resume models the parts.** Split on the
  last comma, rejoined with ", ". Round-trips every location with at most one
  comma, which is the shape the builder's own guidance asks for. A city whose
  name contains a comma is the documented lossy case.

### P13 — JD structure parser (M3-T3)

The one piece of M3 that needs no external data, and the piece the rest of
the scoring engine rests on.

- `src/lib/jd/parse.ts` — splits a posting into sections and weights them.
  Required 3, responsibilities 2, preferred 1, boilerplate 0 (§6's ratio,
  with responsibilities placed between because a listed duty is what the job
  _is_, while still not being stated as a bar).
- `weightedLines` drops zero-weight sections entirely rather than returning
  them with a weight of 0. "Ignore boilerplate entirely" has to mean a
  company's own tech stack under _About us_ cannot contribute to a match at
  all — otherwise a candidate looks like a fit for having read the page.
- Per-line overrides: "Experience with Terraform (nice to have)" inside a
  Requirements list is demoted individually. Real postings do this constantly,
  and a section-level classification alone scores it as a hard bar.
- `scripts/parse-jd.mjs` prints the split for a pasted posting, which is what
  makes QA.md's manual check one command.
- 62 tests, including a sweep over ten postings covering ten structural
  conventions.

#### Heading detection is shape first, words second

"Requirements" appears mid-sentence. A line is treated as a heading only if
it _looks_ like one — not a bullet, short, and either colon-terminated,
markdown-marked, or unpunctuated. Only then is it classified by phrase.

Five to eight unmarked words is genuinely ambiguous: "Who we are" and "The
final scope will vary depending on requirements" have the same shape. What
separates them is what comes next — a heading of that length introduces a
list. Deciding on length alone splits paragraphs in half.

#### The pattern table's order is the feature

"Preferred Qualifications" contains "Qualifications". Test the general
pattern first and every posting that separates the two collapses into one
required block — losing exactly the distinction the module exists for. Same
for boilerplate: "Perks & Benefits" has to be reached before anything that
could read "benefits" as something asked of the candidate.

#### Two mistakes worth remembering

1. **Smart apostrophes.** Postings are pasted from styled web pages, so
   "What you’ll do" arrives with U+2019. A pattern written with only `'`
   silently fails on the commonest heading there is, and the section quietly
   becomes `unknown`. Both forms are matched, and so is the uncontracted
   "What you will do" — which the smoke test caught after the tests passed.
2. **The Bash tool eats `` inside a heredoc.** Writing this file through a
   `python - <<EOF` heredoc turned every `` word boundary into a literal
   backspace character, and the whole pattern table stopped matching while
   still looking correct on screen. Source files with regex escapes go
   through the Write tool.

### P14 — Production hardening

Not a plan task. The work needed to deploy this and charge for it, found by
asking what would break or cost money on the first real day.

**Deployment actually works now**

- `src/server/migrate.ts` — the server applies its own pending migrations,
  using Prisma's `_prisma_migrations` table and its checksum definition
  (SHA-256 of the file). The runtime image carries no CLI, and the
  alternative — a manual `migrate deploy` before every deploy — is a step that
  gets forgotten exactly once and then serves errors until somebody notices.
  Each migration runs in a transaction, so a failure leaves nothing behind.
  **A test runs the real Prisma CLI against a database this code migrated**,
  because "compatible with Prisma" is a claim that has to be checked against
  Prisma.
- `pnpm test:e2e` now deletes the database and runs **no migrate step**, so
  every run exercises the real first-deploy path: empty volume, server starts,
  schema appears, sign-in works.
- `Dockerfile`: Node 24 (Node 20 reached end of life in April 2026 — shipping
  an EOL runtime is shipping unpatched CVEs), `VOLUME /data`, the migration SQL
  and backup tooling copied in, and a healthcheck that touches the database.
- `docker-compose.yml` — app, hourly snapshots, and a commented Litestream
  service. `docker compose up -d --build` is the whole first deploy.

**Backups that have actually been restored**

- `src/server/backup.ts` — SQLite's online backup API, a verify step that
  checks integrity _and_ row counts _and_ foreign keys, and a restore that
  refuses to write over an existing file.
- `src/server/backup.test.ts` is the rehearsal M2-T5 asks for, run on every
  push: snapshot a live database, verify, restore, and serve from the result.
  The off-site half still needs a bucket.

**Abuse and cost**

- `src/server/rate-limit.ts` — sign-in is limited to 5 links per address and
  60 per IP per hour. The endpoint sends mail to any address it is given, so
  without this it is a way to bomb a stranger's inbox _and_ a way to run up
  the operator's provider bill. Counters are rows, so a deploy loop is not a
  way around them, and the decision is one atomic upsert so two concurrent
  requests cannot both pass.

**Disclosure**

- Security headers and a CSP in `next.config.ts`; `poweredByHeader` off.
- `src/server/logging.ts` — §9 says error reporting is scrubbed of resume
  content, and the obvious reading misses where it escapes: a failing write is
  reported by the driver with the statement _and its parameters_, and the
  parameter to `saveResume` is the whole resume. Prisma is set to
  `errorFormat: "minimal"` and every log line is scrubbed of blobs,
  addresses, tokens, and connection strings.
- `/api/health` says `ok` or `unhealthy` and nothing else. Version numbers and
  row counts on an unauthenticated endpoint are reconnaissance.

- 111 new tests (1169 total) and 3 new E2E tests (23 total).

#### Four defects this turned up

1. **Two different native SQLite builds were installed.** Our direct
   dependency was `better-sqlite3@13`, while the Prisma adapter hard-depends
   on `^12` — so pnpm compiled and shipped both, and the backup tooling was
   opening the same file with a different SQLite than the server. Pinned to
   one.
2. **The Docker base image was Node 20**, which went EOL in April 2026.
3. **`sharp` was being traced into the standalone output** — a platform
   native binary for a feature that does not exist. Excluded.
4. **The first CSP broke the entire PDF pipeline.** react-pdf lays out text
   with a WebAssembly build of Yoga, and `WebAssembly.instantiate` is blocked
   unless the policy says so. The fix is `'wasm-unsafe-eval'`, which permits
   compiling WebAssembly and still blocks `eval` of JavaScript — not
   `'unsafe-eval'`, which would have given up the whole protection. Caught by
   the Playwright suite, which is the argument for having it.

#### And one the rate limiter caught on itself

The E2E suite started failing on its twelfth sign-in, because the per-IP
counter had accumulated across several runs inside the same hour. The limiter
was working. Two things came out of it: the E2E run now starts from a deleted
database, and the per-IP limit went from 20 to 60 — an office or a mobile
carrier's CGNAT puts thousands of real users behind one address, and the
per-address limit is the one doing the real work.

### P15 — Launch surfaces

The pages and metadata a product needs before anyone outside can reach it.

- **The landing page said "there is no account".** That stopped being true in
  P10, and a landing page that overstates a privacy position is the same
  failure as one that overstates a result (D14). Rewritten, along with the
  "nothing is uploaded" promise, to say what is actually the case: works
  without an account, nothing leaves the browser unless you sign in and save.
- **Terms now cover accounts** — no password so keep access to the address,
  deletion is immediate and permanent, export first, and the one reason an
  account would be closed.
- `error.tsx`, `global-error.tsx`, `not-found.tsx`. The first thing each says
  is that the draft is safe: someone forty minutes into writing a resume who
  hits an error screen assumes they have lost it, and the reasonable response
  to that assumption is to close the tab — the one action that would make it
  true if an autosave were still pending. `global-error` uses inline styles,
  because if the stylesheet is what failed, a page full of class names is the
  least reassuring thing on screen.
- `robots.ts`, `sitemap.ts`, and `src/lib/site.ts`. A deployment with no
  configured origin refuses indexing entirely, so a staging copy cannot
  quietly compete with production in search results.
- Root metadata: `metadataBase`, a title template, Open Graph, and
  `formatDetection: { telephone: false }` — iOS Safari otherwise linkifies
  anything that looks like a phone number, and a resume preview is full of
  dates that qualify.
- The account export is rate limited to 12/hour. It reads and serializes every
  resume on the account, and `better-sqlite3` is synchronous, so a tight loop
  over it stalls the event loop for everyone.

#### Prerendering would have shipped the wrong URLs

`robots.txt`, `sitemap.xml`, and the three marketing pages were all static,
which means their absolute URLs were frozen as they were at **build** time —
and an image built in CI has no idea what host it will run on. The production
site would have served a `robots.txt` that disallows everything and canonical
links pointing at `localhost`, and nothing would have failed: the pages render
correctly, the search traffic simply never arrives. All five are now
`force-dynamic`, which for a single-container deployment with no CDN costs
nothing.

#### The rate limiter was storing personal data

A key like `signin:email:ada@example.com` puts an address in a table that no
relation connects to a `User` — so **account deletion would not have removed
it**, and it existed for people who only ever requested a link and never
signed in. Neither is defensible when the product's position is that deletion
means deletion.

Fixed at the source rather than by remembering to clean up: `signInKey` hashes
the subject, so the same input still maps to the same counter and there is
nothing personal in the table to delete. A plain SHA-256 with no secret — a
keyed hash would tie every counter to `AUTH_SECRET`, and rotating the secret
would silently reset every limit.

---

## Next

### Blocked on decisions and credentials only the owner can make

Everything reachable without external accounts is done. What remains needs input:

| Blocked on                                                               | Needed for                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| Host choice, domain, product name (§12 Q2, Q3)                           | M0-T13 deploy                                    |
| Word / LibreOffice / Google Docs access, a physical phone                | Manual checks 1, 2, and 4 in `docs/QA.md`        |
| Google OAuth client id + secret                                          | Manual check 3 — the live Google round trip only |
| Transactional email provider credentials                                 | Production magic links (the flow itself is done) |
| S3-compatible bucket credentials                                         | M2-T5 Litestream                                 |
| A licensing decision on ESCO / O*NET, and the IDF corpus source (§12 Q1) | M3-T1, M3-T2                                     |

Note what moved: Google credentials and an email provider no longer block
_building_ anything. The email flow is implemented and verified end to end
against a real SMTP conversation; Google is implemented and its configuration
asserted, with only the live consent round trip owed.

| §11 monetization (D13 constrains it: downloads are never paywalled) | Charging for anything |

### What is left, and what it needs

- **The deploy itself.** `docker compose up -d --build` is the whole thing —
  no migrate step, backups start with it. What it needs is a host, a domain,
  and the four environment variables in `docs/RUNBOOK.md`.
- **M2-T5's off-site half.** Local snapshots run hourly and the whole
  take-verify-restore cycle is rehearsed on every push. Replication to a
  bucket is not: it needs S3 credentials and a Docker host, and the rehearsal
  is its acceptance criterion. `docs/RUNBOOK.md` has the config, the
  procedure, and an empty table for the measured RPO and RTO.
- **Running the container at all.** CI proves the image builds, not that it
  serves. `docs/QA.md` check 4 lists what has only been reasoned about.
- **Taxonomy + IDF (M3-T1, M3-T2)** — needs the licensing call first. The plan
  says verify current terms before shipping, and that is a decision, not a
  lookup. The scoring engine (M3-T4) sits behind them; the structure parser it
  depends on (M3-T3) is done.

### The sequencing gate, restated

The plan says ship M0 before starting M1, and get a week of real feedback
before building accounts. M1 and M2 were both built ahead of that because the
deploy was blocked, not because the gate was reconsidered.

**That gate now matters more, not less.** M3's scope is explicitly meant to be
reassessed against real users, and §11 says decide monetization after M0
feedback — which does not exist yet. D13 constrains the answer regardless:
downloads are never paywalled, so whatever gets charged for has to be
something other than getting your own work back out.

Deploy, then listen, then decide.

---

## Notes for whoever picks this up

- Plan header in `EXECUTION_PLAN.md` still says "Repository is empty" — stale, ignore it in favor of this file.
- `DECISIONS.md` has one amendment (2026-08-13): stack is Next 16.3/React 19.2, not Next 15 as originally written. No D-numbered decision affected.
- **`minPresenceAhead` reserves space _after_ the node it is set on.** M0-T3's text says "a role's final bullet gets `minPresenceAhead`", but set there it would guard whatever follows the role, not the bullet. The hint goes on the block immediately _before_ the final bullet.
- **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** react-pdf inherits a unitless lineHeight as an absolute value, so a heading gets a body-sized line box and collides with the line below. Silent; guarded by the `overlappingLines` test.
- **Never call `.filter()` or `.map()` inside a Zustand selector.** A new array every call means the snapshot never compares equal and the component re-renders forever.
- **DOCX and TXT must not compose entries independently.** Use `lib/emit/shared/entry-lines.ts`.
- **pdfjs needs `GlobalWorkerOptions.workerSrc` in a browser** but not under Node, so this class of bug is invisible to Vitest. Run `pnpm test:e2e` before believing anything about the preview or X-Ray.
- **When asserting that text did not split across pages, match the whole string against one page's joined lines** — never head-fragment against tail-fragment.
- **Fuzzy-matching resume fields needs exact-first, claim-once semantics.** Substrings otherwise mis-assign shorter titles to longer ones.
- **Prisma migration SQL must have comments stripped before splitting on `;`** — every statement is preceded by a `-- CreateTable` comment, so filtering statements that start with `--` discards all of them.
- `public/fonts/`, `public/pdf.worker.min.mjs`, and `src/generated/` are all generated and gitignored. Run `pnpm fonts:sync` and `pnpm db:generate` after a fresh clone.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff means the machine-readable output changed — a product change, not a test annoyance.
- Fixtures live in `src/test/fixtures/resumes.ts` with **hardcoded ids and literal dates** — `createId()` and `openDateRange()` are nondeterministic and would break the determinism tests.
- Component tests opt into jsdom with `// @vitest-environment jsdom` on line 1. `src/test/setup.ts` stubs `HTMLDialogElement.showModal`/`close`, `ResizeObserver`, and `URL.createObjectURL`.
- **Email and URL are plain text in the schema**, validated by `isValidEmail`/`isValidUrl`. See the P4 note; do not "fix" this by putting `z.email()` back.
- **Auth.js's Prisma adapter needs `User.emailVerified`.** Without it sign-in
  fails with `Unknown argument 'emailVerified'`, which reads as a Prisma bug
  rather than a schema gap. There is deliberately no `image` column — the
  Google profile mapper in `buildAuthConfig` drops the avatar URL.
- **A `"use server"` module may only export async functions.** A type export is
  fine (erased); a plain object export fails the build.
- **`@prisma/client-runtime-utils` must stay a direct dependency** while the
  generated client lives outside `node_modules`.
- **Never gate authorization in `proxy.ts` alone.** Server Actions are reachable
  by direct POST, so the gate belongs in the actions and in the data layer;
  the route-level check is for the redirect, not for the security.
- **Auth.js's `signIn(..., { redirect: false })` returns failures as a URL**
  rather than throwing, so an action must inspect what it got back or a mail
  failure is reported to the user as success.
- **`getByRole("alert")` is ambiguous in Playwright against a Next app** — the
  route announcer always matches.
- **Never write a source file containing regex escapes through a heredoc.**
  The Bash tool unescapes heredoc content once, so `` reaches Python as
  `` → a literal backspace byte in the file. The regex still _looks_
  right. Use the Write tool for anything with backslashes.
- M4-T1 (resume import) reuses `lib/xray/extract.ts` wholesale — the biggest onboarding unlock for the least new code.
