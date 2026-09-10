# Implementation

> **The single authoritative document for what is built, what binds new work, and what to build next.**
>
> Supersedes and replaces `EXECUTION_PLAN.md`, `Revised implementation.md` and `PROGRESS.md`, which were deleted after their still-binding content was folded in here. The five documents that remain beside this one each have a job this one does not: `DECISIONS.md` (locked constraints, cited from code by D-number), `RUNBOOK.md` (operations, cited from `docker-compose.yml` and `src/server/db.ts`), `QA.md` (manual checks, cited from the test suites), `ATTRIBUTION.md` (a CC BY licence condition, not a courtesy), `BLOCKERS.md` (what is stopping work, and what would clear it).
>
> **Last updated:** 2026-09-03 · **Owner:** solo, part-time.

---

## 1. Status

The build is feature-complete through P37 — every package in the roadmap. **1,627 unit tests and 77 Playwright tests pass.** Everything below the line is either deferred by decision or blocked on hardware, credentials or third-party software — not on code. `docs/BLOCKERS.md` holds those blockers in full, with what would clear each.

| Milestone                                                       | Delivered                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** — Document model, three emitters, builder, preview, lint | Resume schema with a D10 migration chain · `buildDocument` → one block list for all three emitters, with the four break rules encoded once · PDF (react-pdf, fonts embedded, deterministic fingerprint) · DOCX (real named styles, native numbering, right tab stops, no tables) · TXT · Zustand store with snapshot undo/redo and debounced IndexedDB autosave · 8-step builder · live preview that **is** the PDF blob (D2) · page fit analysis · 14-rule lint engine |
| **M1** — X-Ray                                                  | Two deliberately different PDF extraction strategies plus DOCX style parsing · field recovery scorecard (name, email, libphonenumber-validated phone, per-role title/org/dates) · **100% recovery across all seven fixtures on both PDF strategies and DOCX** · three-layer UI                                                                                                                                                                                          |
| **M2** — Accounts and sync                                      | Passwordless auth (magic link + Google), no password column anywhere · draft claiming · multi-device sync with a push queue · JSON Resume export **and** import · hard account deletion by cascade · local backup with a rehearsed restore                                                                                                                                                                                                                              |
| **M3** — Match engine                                           | JD structure parser with section weighting · O\*NET skill taxonomy (7,432 terms) plus an owned alias list · owned IDF tiering · scoring engine on four anti-gaming rules · Match tab with three gauges and per-keyword provenance                                                                                                                                                                                                                                       |
| **M4-T4** — Cover letters                                       | Composer under D8 — every sentence is the user's own text or a claim-free committed template · additive emitter blocks, so letters reuse the resume's geometry · `/letters` and `/letters/[id]` · guests compose and download with nothing hitting the server                                                                                                                                                                                                           |
| **Hardening**                                                   | Self-applying migrations with a snapshot taken first · rate limiting on hashed subjects · CSP and security headers · scrubbed logging · health endpoint · error/not-found surfaces · robots and sitemap read at runtime, never baked at build                                                                                                                                                                                                                           |
| **Redesign**                                                    | Design tokens with a two-ground scheme (chrome flips, paper does not) · theme with no flash and no dead `dark:` classes · ~24 hand-rolled icons · 13 UI primitives · app shell · landing, sign-in, dashboard · `DesignPanel`, the settings surface that had no UI · multiple named resumes                                                                                                                                                                              |
| **P31** — Resume import and `/check`                            | Extraction split so the browser-safe half carries no `mammoth` · PDF and DOCX parsed into a `ResumeDocument` entirely client-side · a per-field confidence report, because import is lossy and saying so is the position · one file input for PDF, DOCX and JSON Resume · `/check`, the free ATS check: public, no account, and the file provably never leaves the tab                                                                                                  |
| **P36/P37** — Content and brand                                 | Eight complete example resumes, each publishing **the plain text a parser reads from it** as the page body — which is what a crawler indexes and what an image never is · four guides written to answer their question rather than to exist · trust signals that survive being checked, with the numeric ones measured against this repository by a test                                                                                                                |
| **P34/P35** — Coach and bands                                   | A bullet decomposed into Action / What / How / Outcome, with the missing part asked about rather than written · one question on first open that reorders the rail and swaps the advice · the fresher copy that already existed now routed to the band it was written for                                                                                                                                                                                                |
| **P33** — Phrase bank                                           | O\*NET supplies the topic index and 11,106 alternate titles; the achievement-shaped scaffolds are written here and owned · a drawer that inserts blanks, never a finished sentence (D8) · five one-click section presets · **the whole bank passes our own lint engine**, which is how two bad scaffolds were caught before anyone saw them                                                                                                                             |
| **P32** — Templates                                             | Two style axes with a D10 migration that reproduces the v1 appearance exactly · twelve named presets, each a complete `Settings` plus a section order · thumbnails that are real renders, never a mock-up asset that can drift · a public `/templates` gallery whose text survives with JavaScript off · `applyTemplate`, so a template is one undo step                                                                                                                |

### Not done, and why

|                                                                                 | Blocked on                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deploy** (P17) — no host, no domain, no product name                          | A host and a registrable domain. **Deferred by decision, 2026-09-02** — feature work first.                                                                                             |
| **Off-site backups** (P18) — `litestream.yml` written, never run                | S3-compatible bucket credentials                                                                                                                                                        |
| **Live Google sign-in** (P20) — code done, `pnpm auth:google` pre-flight exists | A registrable domain. Google rejects redirect URIs on Public Suffix List hosts, so `*.duckdns.org` will not work                                                                        |
| **Manual QA** (P30) — 4 checks                                                  | Word/LibreOffice/Google Docs · a real phone at 390px · a Google consent screen · ten real job postings                                                                                  |
| **Monetization**                                                                | Nothing. The original plan's answer stands: ship free, talk to the first hundred users. Constrained by **D13** regardless — the paid thing can never be getting your own work back out. |

---

## 2. What binds every change

Read this section before touching anything. Each item below has already cost someone a debugging session.

### 2.1 Locked decisions

`docs/DECISIONS.md` holds D1–D14 in full with the argument for each. They are locked: if evidence emerges that one is wrong, stop, say so, get an explicit reversal, then amend that file with the date. The five that constrain new work hardest:

- **D2 / D3** — one layout engine. Never render a resume server-side; page counts are measured from the artifact, never estimated.
- **D6** — guest content lives in IndexedDB only. Extends to job targets and cover letter drafts.
- **D8** — no generative model writes resume or letter content. Coaching scaffolds; it never invents.
- **D10** — every persisted document type ships with `schemaVersion` and a migration chain from its first commit.
- **D12 / D13 / D14** — "N issues left" while editing, never a live score · downloads are never paywalled · no "beat the ATS" claims anywhere in new copy.

### 2.2 Cross-cutting requirements

Apply to every task; never separately scheduled.

**Privacy — a product promise, not a preference.** Resume content is never logged, never sent to third parties, never used for training, never passed to an AI API. Error reports are scrubbed. No third-party analytics on builder routes.

**Data protection.** GDPR applies given the global audience: hard delete, data export in JSON Resume, data minimisation (no photo, DOB, marital-status or nationality fields at all), privacy policy live before launch.

**Claims discipline.** Never state or imply "guaranteed to pass ATS", "beat the bots", or a specific interview-rate lift. Per D14, accuracy is the position — and X-Ray makes us the only party able to substantiate a parse claim at all.

**Accessibility.** The builder is keyboard-navigable end to end; WCAG AA contrast throughout; the accent picker rejects combinations failing contrast against white.

**Performance budget.** Builder interactive under 3s on throttled 4G; preview re-render under 400ms; typing never drops frames.

### 2.3 Test selectors that must survive any visual change

Both suites are role- and label-based. **If a visual change breaks one of these, the accessible structure regressed — that is the bug, and the test is right.** No existing test file is modified; new surfaces get new tests.

| Locked                                                                                                                                                                                                                                                                                                                                                                                              | Where                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `getByRole("heading", { level: 1, name: "Contact"/"Experience"/"Projects"/"Custom" })` — the step title stays an `<h1>`                                                                                                                                                                                                                                                                             | `BuilderShell.test.tsx`                      |
| `getByRole("navigation", { name: /resume sections/i })`, `getByRole("progressbar", { name: /sections complete/i })` with `aria-valuenow`                                                                                                                                                                                                                                                            | `StepNav.tsx`                                |
| `getByRole("button", { name: /^Experience/ })` — **anchored at string start.** The accessible name is `"Experience, empty"`; prefixing the label with a number or an icon label breaks it                                                                                                                                                                                                           | `e2e/builder.spec.ts`                        |
| `getByRole("region", { name: "Document preview" })`, `getByRole("img", { name: "Resume page 1" })` with a bounding box > 100×100                                                                                                                                                                                                                                                                    | `PreviewPane.tsx`, `PdfCanvas.tsx`           |
| `section[aria-label='Field recovery scorecard']`, `getByRole("tab", { name: "X-Ray" })`, `getByRole("table")`                                                                                                                                                                                                                                                                                       | `XRayPanel.tsx`, `PreviewPane.tsx`           |
| `[data-sync-status]` — the only `data-*` selector in either suite                                                                                                                                                                                                                                                                                                                                   | `SyncStatus.tsx`                             |
| `ResumeList` stays `<ul>`/`<li>` (the suite nth-indexes `getByRole("listitem")`); resume titles stay headings                                                                                                                                                                                                                                                                                       | `ResumeList.tsx`                             |
| `getByRole("textbox", { name: /New title/ })` (the `sr-only` rename label); `getByLabel("Type {email} to confirm deletion")`                                                                                                                                                                                                                                                                        | `ResumeList.tsx`, `DeleteAccount.tsx`        |
| `getByRole("textbox", { name: /search commands/i })`; `input[type="file"]` — **one per page.** P31 made this one input serve PDF, DOCX and JSON Resume rather than adding a second and making the selector ambiguous                                                                                                                                                                                | `CommandPalette.tsx`, `ImportResumeFile.tsx` |
| Verbatim copy: `"Saved in this browser only"`, `/back online/`, `/no trash and no backup copy/`, `/draft is untouched/`, `"There is a resume saved in this browser"`, `/hackathon entries/i`, `/campus placement portal/i`, `/how you show capability without a job title/i`                                                                                                                        | several                                      |
| Exact button names (`exact: true`): `"Download PDF"`, `"Download DOCX"`, `"Download TXT"`, `"Download JSON Resume"`, `"Add a role"`, `"Add a project"`, `"Clear all data"`, `"Delete"`, `"Email me a sign-in link"`, `"Continue with Google"`, `"Sign out"`, `"Save it to my account"`, `"Rename"`, `"Duplicate"`, `"Delete permanently"`, `"Delete my account"`, `"Delete everything permanently"` | both suites                                  |
| Page titles: `"Privacy — ATS Resume Builder"`, `/^ATS Resume Builder — free downloads/`                                                                                                                                                                                                                                                                                                             | `e2e/builder.spec.ts`                        |
| The full CSP directive list and every security header                                                                                                                                                                                                                                                                                                                                               | `e2e/builder.spec.ts`                        |

### 2.4 Landmines

Each of these is silent. None is findable by reading the obvious file.

1. **`src/components/preview/PdfCanvas.tsx:107` sets page-chrome classes in JavaScript, not JSX.** It will not be found by reading markup.
2. **`src/components/builder/BuilderShell.tsx:216`** — the `key` prop combining `step.id` with `externalRevision`. That remount is how uncontrolled inputs resync after undo/redo. Do not remove it.
3. **Any react-pdf style that sets `fontSize` must also set `lineHeight`.** react-pdf inherits a unitless lineHeight as an _absolute_ value, so a heading gets a body-sized line box and collides with the line below. Guarded by the `overlappingLines` test.
4. **`minPresenceAhead` reserves space _after_ the node it is set on** — so the hint for "don't strand a role's final bullet" goes on the block immediately _before_ that bullet.
5. **Never call `.filter()` or `.map()` inside a Zustand selector.** A new array every call means the snapshot never compares equal and the component re-renders forever. This shipped once and hit every user who opened the Custom step.
6. **pdfjs needs `GlobalWorkerOptions.workerSrc` in a browser but not under Node**, so this class of bug is invisible to Vitest. It is set by importing `src/lib/pdf/worker.ts` — import it from anything that rasterises or reads a PDF, and never rely on some _other_ module on the page having done so.
7. **A page that renders server-side cannot see a guest's IndexedDB.** Any route keyed by an id must take that id into the client component and look it up locally when the server had nothing, or a guest's own saved work opens blank while sitting safely in storage.
8. **Do not import a Server Action from a module a component test renders.** It pulls the whole `next-auth` tree in behind it and Vite's resolver rejects `next/server`. Keep the interface in a separate module (see `components/match/jobTargetStore.ts`) and the server factory behind a dynamic `import()`.
9. **`useRouter()` throws in jsdom.** A plain `<a href>` is usually the right answer for a cross-route link anyway.
10. **Fuzzy-matching resume fields needs exact-first, claim-once semantics.** "Backend Engineer" is a substring of "Senior Backend Engineer"; greedy matching silently hands the junior role the senior role's employer and dates, then reports it as a parse failure that never happened.
11. **When asserting text did not split across pages, match the whole string against one page's joined lines** — never head-fragment against tail-fragment.
12. **Never write a source file containing regex escapes through a heredoc.** The Bash tool unescapes heredoc content once, so `\b` reaches the file as a literal backspace byte. The regex still _looks_ right. Use the Write tool.
13. **Email and URL are plain text in the schema**, validated by `isValidEmail`/`isValidUrl`. The store persists on every keystroke, so `z.email()` would discard a draft for the crime of reloading mid-word. Do not "fix" this.
14. **Auth.js hands the adapter the provider's whole token response.** Google's contains `expires_in`, which has no column, and `prisma.account.create` rejects unknown arguments. `src/server/auth/adapter.ts` reduces the account to its four identity fields; do not unwrap it.
15. **Auth.js v5 renamed the OAuth error codes.** `OAuthCallback`/`OAuthSignin` are v4 spellings that never arrive; the real ones are `OAuthCallbackError` (also what a cancelled consent screen looks like) and `OAuthSignInError`.
16. **`form-action 'self'` breaks Google sign-in without JavaScript.** `next.config.ts` names Google's origin for exactly this.
17. **`getByRole("alert")` is ambiguous against a Next app** — the route announcer always matches.
18. **Prisma migration SQL must have comments stripped before splitting on `;`** — every statement is preceded by a `-- CreateTable` comment.
19. **`@prisma/client-runtime-utils` must stay a direct dependency** while the generated client lives outside `node_modules`.
20. **Never gate authorization in `proxy.ts` alone.** Server Actions are reachable by direct POST; the gate belongs in the actions and the data layer.
21. **A date-token pattern that is too loose produces _no_ date, not a slightly wrong one.** `src/lib/import/dates.ts` matched `[A-Za-z]{3,9}\s+` before a year, so `"Research Associate 2026 – Present"` matched with `Associate` as the month word, failed to parse, and the line came back undated — losing the role's dates, title and employer together and collapsing the section into one entry per line. The month word is now spelled out with a `\b` after it. Caught only by `e2e/import.spec.ts`, because every committed fixture happens to use a month name.
22. **`extractDocxStructure` must give `<w:tab/>` a space.** An entry heading sets its date at a right tab stop, so ignoring the tab yields `"Senior Backend EngineerMar 2022 – Present"` — one unparseable string where the document has two fields. Invisible in the X-Ray suite, which only asserts on `Heading1` lines, and those are single runs.
23. **A Word heading style is not a section boundary by itself.** Our DOCX sets sections as `Heading1` and entry headings as `Heading2`; treating any heading style as a section makes every job title start a new section. `docxHeadingLevel` plus "the shallowest level present wins" is the rule, and it also handles a foreign document that uses `Heading2` throughout.
24. **A stale `next dev` on port 3000 silently hijacks the whole E2E run.** `playwright.config.ts` sets `reuseExistingServer: !CI`, so a dev server left running from a previous session is reused instead of the production build the command would otherwise make — and `/letters/new` 500s under it with a Jest-worker crash that has nothing to do with the code under test. If a spec fails in a way that makes no sense, check what is listening on 3000 before debugging the spec.

### 2.5 Conventions

- Every server function takes `userId` **first** and puts it in the `where` clause: `updateMany({ where: { id, userId } })`, never `update({ where: { id } })`. The wrong owner changes zero rows and the caller sees "not found".
- `pnpm verify` (typecheck + lint + test) green before any commit. `pnpm test:e2e` before believing anything about the preview, X-Ray or import.
- Tests ship in the same commit as the code. Acceptance criteria are binary: a package is done when they pass, not when the code exists.
- One commit per lettered sub-step, each independently green. **Never bundle a schema migration with UI work** — the migration lands, runs and is observed before anything depends on it.
- DOCX and TXT must not compose entries independently — use `src/lib/emit/shared/entry-lines.ts`.
- Component tests opt into jsdom with `// @vitest-environment jsdom` on line 1. `src/test/setup.ts` stubs `showModal`/`close`, `ResizeObserver`, `URL.createObjectURL`.
- Fixtures in `src/test/fixtures/resumes.ts` use **hardcoded ids and literal dates** — `createId()` is nondeterministic and would break the determinism tests.
- The golden snapshots in `src/lib/emit/pdf/__snapshots__/` are the extracted-text contract. A diff means the machine-readable output changed — a product change, not a test annoyance.
- `public/fonts/`, `public/pdf.worker.min.mjs` and `src/generated/` are generated and gitignored. After a fresh clone: `pnpm fonts:sync && pnpm db:generate`.
- When reality contradicts an estimate, report the new estimate. Do not silently absorb overrun.

---

## 3. Competitive position

Assessed against ResumeBuilder.com, 2026-09-02, walked end to end — marketing pages, the wizard with dummy data, the cover letter builder, the templates and examples libraries, and the paywall.

**The summary: we are technically ahead and commercially invisible.** The document engine, the privacy position and the verification wedge are better than theirs. What is missing is everything between a search result and a finished download.

### Ahead — and structurally hard for them to copy

|                   | Us                                                                                                                                     | Them                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Downloads**     | PDF, DOCX, TXT, JSON Resume — free, permanently (D13)                                                                                  | TXT free; PDF/DOCX/RTF behind ₹195/14 days, auto-renewing at ₹445/4 weeks |
| **ATS claim**     | X-Ray re-parses the file we just produced and grades field recovery — the evidence, not the claim                                      | "Smart Apply®" and "ResumeCheck™" — trademarked names, no shown working   |
| **Match scoring** | Three gauges, per-keyword provenance on both sides, and a stuffing penalty that makes reaching 100 by stuffing structurally impossible | One opaque number ("31/100 Needs work")                                   |
| **Privacy**       | Works with no account; content never leaves the browser unless you sign in and save; hard delete; full export                          | Account required                                                          |
| **Cover letters** | Every sentence traceable to the user's own resume text (D8)                                                                            | LLM-generated, unverifiable                                               |
| **DOCX quality**  | Real named Word styles, native numbering, right tab stops, no tables or text boxes                                                     | Unknown; the category norm is table-based layout that ATS mangles         |
| **Portability**   | JSON Resume out _and_ in; account-wide export endpoint                                                                                 | None                                                                      |
| **Honesty**       | D14 forbids outcome claims                                                                                                             | "38% more interviews", "23% more likely to get an offer"                  |

Four of those are claims a competitor charging for downloads cannot make at all. That is the positioning, and it is real.

### Behind — ranked by what it costs

1. **Not deployed.** Zero users, zero feedback, zero search presence. Everything else is theory. Deferred by decision, not by disagreement.
2. **No way to start from an existing resume.** They accept a PDF/DOCX upload and prefill the wizard. We import JSON Resume only — while owning the entire extraction layer that solves this.
3. **We read as having no templates.** Five font pairs behind a "Design" dialog against their thumbnailed public gallery. A visitor comparison-shopping bounces in ten seconds.
4. **No content help.** Their pre-written phrase library keyed by job title is the most-used feature in that wizard. Our lint engine says what is wrong and never what to write. Closable without a model — their library is a database.
5. **No acquisition surface.** They rank on 500+ examples across 20 industries plus a career centre. Our sitemap has three URLs.
6. **One flow for everyone.** They ask experience level first and adapt. Our empty states already carry fresher-specific copy that nothing routes to.
7. **No name, no brand, no trust signals.** `PRODUCT_NAME` is still the literal string `"ATS Resume Builder"`.

### Deliberately not closing

Photo support and two-column layouts (they contradict the single-column argument the landing page makes and `schema.ts` documents as a product position), job search, Grammarly, a shareable public profile, RTF export. The first two are decisions; the rest are other products.

---

## 4. Roadmap

Continues the P-numbering. **P31–P37 are complete.**

| #       | Package                                | Closes        | Est. | Depends         |
| ------- | -------------------------------------- | ------------- | ---- | --------------- |
| ~~P31~~ | ~~Resume import + the free ATS check~~ | Gap 2 · M4-T1 | —    | **Delivered**   |
| ~~P32~~ | ~~Template presets and the gallery~~   | Gap 3         | —    | **Delivered**   |
| ~~P33~~ | ~~Phrase bank + section presets~~      | Gap 4         | —    | **Delivered**   |
| ~~P34~~ | ~~Bullet Coach~~                       | Gap 4 · M4-T7 | —    | **Delivered**   |
| ~~P35~~ | ~~Experience-level personalisation~~   | Gap 6 · M4-T8 | —    | **Delivered**   |
| ~~P37~~ | ~~Brand and honest trust signals~~     | Gap 7         | —    | **Delivered**\* |
| ~~P36~~ | ~~Content and SEO surface~~            | Gap 5         | —    | **Delivered**   |

**All seven packages are delivered.** \* P37 ships everything but the name itself — see `BLOCKERS.md` §B6. What remains is the launch debt in §6, which is blocked on a host and a domain rather than on code.

P31 went first because it was both the largest onboarding unlock and the top-of-funnel asset the rest benefits from; it is delivered. P36 stays last because it is the only package that consumes the others' output. P37 before P36 because content pages carry a brand.

**One flag, stated once and not re-argued.** P31's `/check` tool and all of P36 earn nothing until a live origin is indexed. Build them; expect the return after the deploy. P32–P35 improve the product whether or not it is public.

---

## 5. The packages

### P31 — Resume import + the free ATS check tool — **delivered**

M4-T1, plus the top-of-funnel asset it unlocked for almost no extra code. Kept here rather than deleted because three of its decisions bind everything after it.

**What shipped**

- `src/lib/xray/extract-browser.ts` — the browser-safe half of the extraction layer. `extract.ts` re-exports it and keeps only `extractDocx`, so no existing import or test changed. `fflate` is a dependency now; `mammoth` stays dev-only and is no longer reachable from any client bundle. The module imports `src/lib/pdf/worker.ts` itself, which retires landmine 6 for every PDF-reading path at once.
- `src/lib/import/headings.ts` · `dates.ts` · `parse-resume.ts` — `parseResumeFile(bytes, kind)`, plus `parseResumeLines(lines)` for layouts neither emitter produces.
- `src/components/import/ImportReview.tsx` — the confidence report, shared by the builder and `/check`.
- `src/components/builder/ImportResumeFile.tsx` — one file input for PDF, DOCX **and** JSON Resume. `ImportJsonResume.tsx` was folded into it.
- `src/app/check/page.tsx` + `src/components/check/CheckTool.tsx` + `src/lib/import/handoff.ts`.
- `e2e/import.spec.ts` — 5 tests, including the network assertion and an axe scan of `/check`.

**Where it departs from the plan as written, and why**

1. **One file input, not two.** The plan asked for a new control beside the JSON one _and_ for `input[type="file"]` to stay unambiguous. Those are incompatible: a second input breaks the locked selector in §2.3 and `e2e/builder.spec.ts` with it. One input dispatching on extension satisfies both, and is the better product — the visitor no longer classifies their own file before the app will read it.
2. **`/check` does not reuse `XRayPanel`.** X-Ray _grades_ against a document we generated; on `/check` there is no ground truth, and running the scorecard anyway would grade a stranger's resume against whatever empty draft is in that browser and print a confident percentage that means nothing. `/check` shows recovery, disagreement and raw text, without a score. The recovery display is shared, so there is still one definition of "here is what we read".
3. **The handoff is `sessionStorage`, read once.** A resume must not go in a URL — history, `Referer`, access logs — nor in a cookie, which is transmitted by definition.

**Two findings worth keeping**

- **A DOCX tab is load-bearing.** `extractDocxStructure` ignored `<w:tab/>`, so an entry heading came back as `"Senior Backend EngineerMar 2022 – Present"`. Fixed by giving tabs and breaks a space. Existing assertions were unaffected because they only name `Heading1` lines, which are single runs.
- **Landmine 21, below.** A date-token pattern that is too loose does not produce a slightly wrong date; it produces _no_ date and takes the whole entry with it.

**Accepted:** all seven fixtures round-trip through PDF and DOCX import with contact fields and every role title, organisation and date recovered · a hand-built foreign-layout fixture parses without throwing and reports low confidence rather than wrong data · `/check` issues no network request carrying file content · Ctrl+Z restores the pre-import draft.

---

### P32 — Template presets and the gallery — **delivered**

Closed the perception gap without a second rendering path. **D2 stands: one engine.**

**What shipped**

- `settingsSchema` gains `headerStyle` (`left` | `centered`) and `headingStyle` (`rule` | `caps` | `accent-bar`). `CURRENT_SCHEMA_VERSION` is 2, with the `v1 → v2` step in `migrate.ts` defaulting both to the v1 appearance.
- `src/lib/resume/templates.ts` — twelve presets, each a complete `Settings` plus a section order.
- `src/lib/resume/sample.ts` — the document the gallery renders. A _product_ asset, not a test fixture: the fixtures are shaped to break things, and showing a visitor a stress case invites them to conclude the product produces stress cases.
- `src/components/templates/` — `TemplateGallery` (shared), `TemplateThumbnail` (real renders, serial, cached), `PublicTemplateGallery`.
- `src/app/templates/page.tsx` — public and indexable, plus a sitemap entry and a header link.
- `useResumeStore.applyTemplate` and `src/lib/resume/template-handoff.ts`.
- `src/lib/resume/templates.test.ts` (34 tests) and `e2e/templates.spec.ts` (6).

**Where it departs from the plan as written, and why**

1. **`applyTemplate`, not `setSettings` + `reorderSections`.** Each of those is its own `applyChange`, so applying one template would have cost five or six presses of Ctrl+Z. That is not undo, it is a puzzle — and "a single undo step" is the stated acceptance criterion, so the plan's own mechanism could not have met it. One store action, one history entry.
2. **The gallery card is an `<a href>` on the public page and a `<button>` in the Design dialog.** Same component, one prop. A card that navigates and is not a link is not right-clickable, not middle-clickable, and invisible to a crawler — on the page whose entire purpose is being crawled.
3. **The public page carries an `sr-only` list of all twelve names and descriptions.** The thumbnails need a browser to draw. The text a crawler indexes must not.

**Two things worth keeping**

- **`allCaps` in DOCX is a run property; `textTransform` in react-pdf changes the glyphs.** Both render uppercase, but only the PDF's extracted text _is_ uppercase — Word still stores `Experience`. A test asserting uppercase extraction against the DOCX asserts something untrue about how Word works.
- **The section-heading `border` is the only thing a heading style varies.** `allCaps` is set for all three and is not negotiable: it is the property the parse argument actually rests on, so a template is not allowed to trade it away for looks.

**Accepted:** twelve templates render distinguishably · applying one is a single undo step · a v1 document opens with today's appearance unchanged, asserted on the rendered artifact rather than on the settings · switching `headingStyle` leaves the extracted text byte-identical in both PDF and DOCX, and leaves the TXT output identical under either axis.

---

### P33 — Phrase bank and section presets — **delivered**

The content gap, closed inside D8. Their "thousands of expert-written, keyword-optimized bullet points" is a database. So is ours.

**What shipped**

- `src/lib/phrases/scaffolds.ts` — twelve topics, 59 achievement-shaped scaffolds, written here and owned outright.
- `scripts/build-phrases.mjs` → `data/phrases.json` (0.41 MB): 941 occupations and 11,106 alternate titles from O\*NET 29.1.
- `src/lib/phrases/lookup.ts` — `phrasesForTitle`, `relatedTitles`, lazy-loaded behind a dynamic `import()`.
- `src/components/builder/PhraseLibrary.tsx`, opened from `BulletEditor`.
- `src/lib/resume/section-presets.ts` and a "Common sections" row on the Custom step.
- `docs/ATTRIBUTION.md` extended, with a test asserting the version and access date are recorded.
- `src/lib/phrases/phrases.test.ts` (27 tests) and `e2e/phrases.spec.ts` (5).

**The split, restated because it is the whole design**

O\*NET supplies the **topic index** — what an occupation involves, and its alternate titles. We write the **scaffolds**. O\*NET tasks are duty-shaped (_"Analyze user needs and software requirements"_) and `bullets/duty-phrasing` exists to flag exactly that: shipping them as bullets would have the product mark its own suggestions as defects. So task statements are read at build time to derive topic tags and **never written to the output file** — asserted by a test over the occupation records.

**Three things the tests caught that review would not have**

1. **Two scaffolds failed our own lint.** `Supported ___ accounts…` and `Handled ___ escalations…` both open on a verb in `WEAK_VERBS`. Rewritten. This is precisely why the acceptance criterion is "run the lint engine over the phrase bank" rather than "be careful".
2. **O\*NET names occupations in the plural** — "Software Developers" — and people type their job title in the singular. Without the plural fold in `singularize`, the single commonest lookup in the feature missed.
3. **A contained-title match needs a coverage floor.** "Chief Vibes Officer" resolved to _Transit and Railroad Police_, via the alternate title "Officer". A match covering a third of the input is a coincidence with an index behind it, and worse than no match, because no match falls back to the default topics.

**Accepted:** the whole phrase bank lints clean under our own engine, together and one scaffold at a time · every scaffold has a visible blank and contains no digit of its own · O\*NET attributed with version and access date, asserted by a test because CC BY makes it a condition · `data/phrases.json` is 0.41 MB against a 2 MB budget · the index is not fetched until the drawer is opened.

---

### P34 — Bullet Coach — **delivered**

M4-T7. The D8-compatible answer to "Enhance with AI".

- `src/lib/coach/parse-bullet.ts` — decomposes a bullet into **Action / What / How / Outcome**, finds the missing part, asks about it. The verb classification and the quantity detector are imported from `lib/lint/rules.ts`, which now exports them: a coach that called a verb weak while the checklist beside it called the same verb fine would undermine both.
- `src/components/builder/BulletCoach.tsx` — a collapsed line under each bullet. **A count of what is left, never a score** (D12).
- `src/lib/coach/coach.test.ts` (19) and `e2e/coach.spec.ts` (4).

**The acceptance criterion, mechanically enforced:** no message this module produces could be pasted into a resume. Every question ends in a question mark, no field anywhere contains a digit — so the coach cannot supply a number the user did not have — and no hint offers a completed example. A helpful-sounding phrase added to a `hint` six months from now would look like an improvement in the diff and be a model writing somebody's resume in effect; the test is what stops that.

**What the tests caught:** the coach fired on `"Cut shortlisting time from three days to under an hour"` — a bullet from our own fresher fixture. It states a result, contains no digit, and matches no connective, because **the result is the verb**. Asking its author "what changed?" would be the coach failing to read the bullet it is commenting on. Fixed with an outcome-verb set and a before-and-after pattern, and pinned by a test that runs the coach over every bullet in the shipped fixtures.

---

### P35 — Experience-level personalisation — **delivered**

M4-T8. One question on first open; the answer reorders the rail and swaps empty-state copy.

- `src/lib/resume/experience-level.ts` — five bands, stored in `localStorage`. **Not a field on the document:** it is not resume content, and D10 makes every persisted field a permanent commitment that a preference has not earned.
- `orderedSteps()` in `steps-config.ts`, plus `order` and `footer` props on `StepNav`.
- `ExperienceLevelPrompt`, and a chip in the rail to change the answer later.
- Per-band overrides in `empty-states.tsx`, plus `EvidenceSources` for the "no experience" band — the categories a fresher has and has not counted as work. A genuine differentiator for the Indian market, which no global competitor builds for.
- `src/lib/resume/experience-level.test.ts` (11) and `e2e/experience-level.spec.ts` (6).

**Where it departs from the plan as written**

- **`useSyncExternalStore`, not an effect.** Reading `localStorage` in a `useEffect` renders once with the wrong answer and again with the right one — and because the answer decides the _step order_, the visible symptom is a rail that rearranges under the cursor of someone already reading it. The lint rule that forbids `setState` in an effect body is pointing at exactly this.
- **The overrides are additive.** The locked strings (`/hackathon entries/i`, `/campus placement portal/i`, `/how you show capability without a job title/i`) are untouched, and a test asserts both that they are still reachable and that the band they were written for still gets them.

**Accepted:** "no experience" reorders the rail and changes the empty states · "10+" restores the default, asserted on `orderedSteps` returning `STEPS` itself · the preference survives reload · skipping is a real answer that does not re-prompt · every existing assertion passes unmodified.

---

### P37 — Brand and honest trust signals — **delivered, except the name itself**

**What shipped**

- `src/lib/trust-signals.ts` — six claims for the slot a competitor fills with logos and a star rating, each naming where a stranger can verify it, plus the refusals listed rather than implied.
- The landing page renders both: "Things you can check for yourself", and the refusals inside the existing honesty section.
- `AppHeader` and the landing page's metadata read the name from `lib/product.ts` instead of writing it out.
- `src/lib/trust-signals.test.ts` (10 tests).

**The two assertions worth having**

1. **Every numeric claim is measured against this repository.** A test count on a marketing page that quietly goes stale is a false statement, and "it was true when written" is not a defence. The lint-rule count is checked against `RULES.length` directly; the test counts are checked as floors against declarations on disk.
2. **No user-visible surface hardcodes the product name.** That is P37's stated acceptance criterion, and the way it stops being true is one component writing the string out — so it is a test rather than a convention.

**The name is not chosen, and that is deliberate.** It is coupled to domain availability, which is B1's constraint, and it is a product-identity decision rather than an implementation one. Everything around it is done: `docs/BLOCKERS.md` §B6 has the exact one-line change and the two follow-on strings. The current value is a working title that ships correctly.

---

### P36 — Content and SEO surface — **delivered**

The acquisition engine, and the only package that is growth rather than product. Built last because it consumes the others' output.

**What shipped**

- `src/lib/examples/roles.ts` — eight complete example resumes across five fields, each with three or four notes on the specific choices in it. `build.ts` holds the constructors so an example is about its content rather than its scaffolding.
- `src/app/examples/` and `src/app/examples/[role]/` — the index and the pages.
- `src/lib/guides/guides.ts` and `src/app/guides/` — four guides, as structured blocks rather than markdown.
- `src/components/marketing/ResumePaper.tsx` — a resume drawn as markup from `buildDocument`, the same block list the emitters consume.
- `sitemap.ts` generates every example and guide URL from the same arrays the routes read.
- `src/lib/examples/examples.test.ts` (38) and `e2e/content.spec.ts` (7).

**The two decisions that shape it**

1. **The plain text is the page body.** Competitors publish examples as images, so those pages rank on a title and nothing else. Ours publishes `renderText` on the same document the sample is drawn from — so the indexed body _is_ the machine-readable resume, and the page is its own demonstration.
2. **Eight, not five hundred.** We will not win on count without generating them, which D8 forbids and which produces the thin pages that rank once and disappoint. Each of these is instead better on its own query. The set grows by adding an entry; the route, the sitemap and the tests all read the array.

**The tests that matter**

- **Every example passes our own lint engine** with no errors or warnings, and satisfies the Bullet Coach on every bullet. These pages are the product's public argument about what a good resume is; publishing eight our own checker complains about would undermine it in the most visible way available.
- **Nothing on the surface claims an outcome**, scanned sentence by sentence with refusals filtered out — a guide saying "we will not tell you it is guaranteed to pass" contains the forbidden word and is D14 being stated, not broken. A third test proves the filter is not a hole.

**What the tests caught:** four example bullets tripped the Bullet Coach, and three of them were the _coach_ being wrong — it read numbers only as digits, so "closed with zero adjustments" and "cited in two reports" looked outcome-less. `NUMBER_WORD` fixed that, deliberately in the coach and not in the lint engine's `QUANTITY`: the rule is nudging people toward figures and should keep doing so. The fourth bullet genuinely had no outcome and was rewritten.

**Accepted:** every generated route renders its content with `javaScriptEnabled: false` · the sitemap lists all of them · axe clean on four representative routes · an unknown slug is a 404 rather than a blank page.

---

## 6. Deferred: the launch debt

Deferred by explicit decision on 2026-09-02, not withdrawn. All the code and config exists; none of it has met a real host.

| #       | Package             | What is actually left                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P17** | Ship it             | **Scripted, as of 2026-09-10.** `deploy/oracle/` holds Terraform for the instance and its network, cloud-init for the base image, and `bootstrap.sh` / `deploy.sh`. Needed: an Oracle account, a hostname, and a transactional email provider (Brevo 300/day or Resend 3,000/month — both plain SMTP, so nothing in the application changes). The arm64 build is verified by the `docker-arm64` CI job on every push to master rather than by hand before provisioning. Oracle's images ship iptables rules blocking 80/443 regardless of the security list — `cloud-init.yaml` inserts the matching rules, and the comment saying why is in both files. |
| **P18** | Off-site backups    | `litestream.yml` is written and the service is in `docker-compose.yml`. Needed: an S3-compatible bucket and OCI **Customer Secret Keys** (not API signing keys). **Acceptance is the rehearsal, not the config**: `docker kill` (never `stop` — a graceful stop lets Litestream flush, which was never the case in doubt), destroy the volume, restore, `node scripts/backup.mjs verify`, then write the measured RPO and RTO into the empty table in `RUNBOOK.md`.                                                                                                                                                                                      |
| **P20** | Live Google sign-in | Code complete: `prompt: "select_account"`, the branded button, the token allowlist, and `pnpm auth:google` as a pre-flight. Needed: a **registrable** domain — Google rejects redirect URIs whose host is on the Public Suffix List, so `*.duckdns.org`, `*.sslip.io` and `*.nip.io` are all refused. Magic-link email covers authentication completely on its own, so this never blocks launch.                                                                                                                                                                                                                                                         |
| **P30** | Manual QA           | Four checks in `QA.md` needing Word/LibreOffice/Google Docs, a real phone at 390px, a Google consent screen, and ten real job postings. **Do not commit the postings** — republishing someone else's copyrighted text is not acceptable and inventing them is worse. Record the tally and add a _structural_ fixture for each miss.                                                                                                                                                                                                                                                                                                                      |

**The sequencing gate, restated honestly.** The original plan said ship, then listen, then decide. Everything since M0 has been built ahead of that gate because the deploy was blocked, and P31–P37 now extend that. The gate matters more, not less: this plan closes gaps identified by inspecting a competitor, not by watching a user. Treat every package here as a hypothesis until the deploy makes it testable.

---

## 7. Not scheduled, on purpose

**The rest of the M4 backlog.** Version diff (needs `ResumeVersion`), the full one-page fit assistant (binary-search the parameter space in a worker against real rendered page counts), application autofill preview, the regional convention engine (photo expected in Germany, liability in the US/UK; DOB conventional in parts of Asia, never in North America), the recruiter 6-second F-pattern view, and truth-preserving JD tailoring. M4 is a ranked backlog to pull from against real feedback, not a sequence. P31, P34 and P35 are pulled forward because they close identified competitive gaps; the rest wait for users.

**Monetization.** The original plan's answer stands: talk to the first hundred users first. The shape is already constrained by **D13** — downloads are never paywalled, so the paid thing must be tailoring volume, version history, cover letters beyond N, or more than three resumes. Every one of those is a limit on a feature this plan builds, so nothing here forecloses the choice.

---

## 8. Verification

```bash
pnpm verify        # typecheck + lint + test
pnpm test:e2e      # Playwright
pnpm format:check  # not in CI; the Prettier plugin sorts Tailwind classes
```

| Package | Gate                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~P31~~ | **Met.** Every fixture round-trips through PDF and DOCX import; `/check` issues no network request carrying file content; Ctrl+Z restores the draft |
| ~~P32~~ | **Met.** Twelve templates render distinguishably; a v1 document opens unchanged; extracted text unaffected by a style switch                        |
| ~~P33~~ | **Met.** The whole phrase bank lints clean under our own engine; every scaffold has a visible blank; O\*NET attributed with version and date        |
| ~~P34~~ | **Met.** No coach message is a pasteable sentence — every question ends in "?" and no field contains a digit                                        |
| ~~P35~~ | **Met.** The rail reorders by band; every locked empty-state string still asserts                                                                   |
| ~~P37~~ | **Met.** No surface hardcodes a product name, asserted by a test; every numeric claim measured against the repository                               |
| ~~P36~~ | **Met**, except Lighthouse ≥ 90, which needs a deployed origin to measure meaningfully — see `BLOCKERS.md`. Sitemap lists every route; axe clean    |
| **All** | **Both suites green with no existing test file modified**                                                                                           |

---

## 9. Documentation map

Six documents, each with a job the others do not do.

| File                           | Job                                                                                               | Cited from                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`IMPLEMENTATION.md`** (this) | Status, binding constraints, and what to build next                                               | —                                                                                                         |
| **`DECISIONS.md`**             | D1–D14 with the argument for each, plus the dated amendment log                                   | Code comments, by D-number                                                                                |
| **`RUNBOOK.md`**               | Operating the deployment: services, volumes, restore, RPO/RTO                                     | `docker-compose.yml`, `litestream.yml`, `src/server/db.ts`, `src/lib/site.ts`, `scripts/reset-e2e-db.mjs` |
| **`QA.md`**                    | The manual checks that cannot be automated, each with a checklist and a result                    | `next.config.ts`, `e2e/*.spec.ts`, `scripts/*.mjs`, `src/test/fixtures/job-descriptions.ts`               |
| **`ATTRIBUTION.md`**           | Font and dataset licences. **A CC BY condition, not a courtesy**                                  | `scripts/build-skills.mjs`, `src/lib/fonts/charset.ts`, `src/lib/skills/lookup.ts`                        |
| **`BLOCKERS.md`**              | What is stopping work, and what would clear it. Separate so a blocker is never read as a deferral | —                                                                                                         |

### Legacy section numbers in code comments

Forty-five comments across `src/`, `e2e/` and `scripts/` cite the old execution plan by section
number (`§9 privacy`, `§6 says ignore it entirely`). They were left in place rather than churned
through a dozen source files for a docs move. Resolve them here:

| Cited as      | Was                                                                               | Now                                                                     |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **§1**        | Locked decisions                                                                  | `DECISIONS.md`                                                          |
| **§2 / §2.5** | Work packages and sequencing                                                      | §4 of this file                                                         |
| **§6**        | JD section weighting — required 3, responsibilities 2, preferred 1, boilerplate 0 | `SECTION_WEIGHTS` in `src/lib/jd/parse.ts`, which is now the definition |
| **§7**        | Data model                                                                        | `prisma/schema.prisma`                                                  |
| **§9**        | Cross-cutting requirements                                                        | **§2.2 of this file**                                                   |
| **§10**       | Risk register                                                                     | Superseded; the live risks are §1 "Not done, and why" and §6            |
| **§11**       | Monetization                                                                      | §7 of this file                                                         |
| **§12**       | Open questions                                                                    | All resolved except the product name, which is P37                      |

**Update this file in the same commit as the work.** It is the handoff contract — move a package from §4 to §1 as it lands, and add any new landmine to §2.4 while it is still fresh.

Amendments owed as the packages land:

- **`DECISIONS.md`** — one dated amendment, no reversals: _"D8 — the phrase bank and Bullet Coach are curated, committed content and question-asking scaffolds. No model is called and no scaffold contains a completed claim. D8 is unchanged."_
- ~~**`ATTRIBUTION.md`**~~ — **done with P33.** O\*NET Occupation Data, Alternate Titles and Task Statements, with version and access date, asserted by a test.
- **`QA.md`** — a check for resume import against a real third-party resume, which cannot be committed for the same copyright reason the job postings cannot (P31).
- **`README.md`** — import, `/check`, templates and the phrase bank in the description.

---

## 10. Improvement plan 1 — found in the first live use

Everything above §9 describes a build that is feature-complete. This section is
the first list of things found by **opening the deployed-shape site and using it
as a stranger would**, with a real Google sign-in, on 2026-09-08. That is a
different instrument from the test suite, and it found things the suite is not
pointed at.

One of them is a genuine correctness bug that must be fixed before any public
deploy: **all browser-local state is stored under a single fixed key with no
user identity in it, and nothing clears it at the auth boundary**, so on a
shared computer the next person to sign in sees the previous person's resume.
The rest are a dev-only config error, two pieces of landing-page copy that
answer a question nobody asked, an invisible text selection, and the cover
letter package's first real round of correctness and polish.

**Numbering follows the report, not severity** — §10.1 through §10.5 are the
five issues as they were raised, with §10.4b added for the SEO question that
arrived alongside §10.4. Do them in any order; §10.1 first.

### Status — landed 2026-09-09

All six sections are implemented. What follows below is kept as written, because
it is the reasoning, not a task list; where the implementation departed from the
plan the reason is in the code and is summarised here.

| §      | State                                         | Where it landed                                                                                                                            |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | Done                                          | `src/store/owner.ts`, `src/store/purge.ts`, `src/components/shell/StorageOwner.tsx`; 5 new tests in `e2e/auth.spec.ts`                     |
| **2**  | Tier 1 and Tier 2 done, Tier 3 still deferred | `src/lib/cover-letter/{provenance,setup}.ts`, `src/components/letters/LetterEditor.tsx`, `src/components/match/UnmatchedPostingNotice.tsx` |
| **3**  | Done                                          | `next.config.ts`, asserted both ways by `src/lib/csp.test.ts`                                                                              |
| **4**  | Done                                          | `src/lib/trust-signals.ts` (+`href`), `src/lib/site.ts` (`REPO_URL`)                                                                       |
| **4b** | On-page work done; the rest waits on a domain | `src/lib/structured-data.ts`, `src/app/opengraph-image.tsx`, `src/lib/examples/roles.ts` (8 → 16)                                          |
| **5**  | Done                                          | `src/app/globals.css`, pinned by `src/app/globals.test.ts`                                                                                 |

Three deliberate departures from the plan as written, each argued in the code:

1. **§10.1 — the owner is published from `AppHeader`, not from three pages.**
   The plan named `builder/page.tsx`, `dashboard/page.tsx` and
   `letters/[id]/page.tsx`; that covers where the leak was _reported_ and
   misses `/letters`, the Match tab, `/templates` and `/check`, all of which
   write browser-local state. `AppHeader` is a server component that already
   reads the session on every route, so there is no route where a store can be
   constructed before the identity is known.
2. **§10.1 — the purge is unconditional rather than keyed on a recorded last
   owner.** Same behaviour, one fewer piece of state to keep true: enumerating
   and deleting foreign slots is idempotent, and a recorded marker has a
   failure mode this does not — if the marker write fails, the foreign data
   survives indefinitely.
3. **§10.4 — the test-count guard is exact on a _different_ number.** The plan
   asked for `toBe` against the claimed 1,626 on the assumption that the static
   count produced the same figure. It does not: 863 declarations against 1,655
   cases, because `it.each` tables are computed values and `describe.each`
   multiplies. An equality there would have forced the page to under-claim by
   half. The hole the plan was pointing at is real and is closed by
   `MEASURED.testDeclarations`, pinned exactly, so any change in the size of
   the suite fails a test.

One thing the tightened guard caught immediately, worth recording: the page
claimed **77** end-to-end tests when there were **69**. The old floor
(`toBeGreaterThanOrEqual`) passed on it.

§10.4b's content item is half done and deliberately so. The set went 8 → 16,
and the eight added were chosen for where the demand is rather than for
variety — customer service, administrative assistant, marketing manager, HR
manager, financial analyst, mechanical engineer, graphic designer, retail store
manager. The original eight skewed professional and technical, and the two
most-searched resume queries in the category were answered here by nothing.

Calling the rest "data entry" undersold it: `examples.test.ts` holds every
example to a valid document, **no lint finding above `info`**, and the bullet
coach satisfied on every bullet — so each page is authored content at a real
quality bar, not a row in a table. (The bar earned its keep immediately: it
rejected a `handled` opening in the HR example on the first run.) Going 16 → 30
is more of the same, and which occupations to target is a market decision
rather than an engineering one.

Also fixed on the way through, because it blocked `next build` and therefore
every end-to-end run: two type errors in the uncommitted `enhance.browser.ts`
(an overload too wide for `tsc` to resolve, and a union the pipeline's return
type does not narrow). Its two failing unit tests in `enhance.test.ts` are
**not** fixed — they are behavioural, they belong to the in-flight Enhance
work, and they are outside §10.

### Context

The site was opened and used for the first time end to end, with a real Google
sign-in. Five problems surfaced. They are independent, so each section is a
self-contained plan and they can be done in any order.

The most serious by a wide margin is **#1**: all browser-local state is stored
under one fixed key with no user identity in it, and nothing clears it when a
person signs in or out. On a shared computer the next person sees the previous
person's resume. Everything else is a day's work or less.

| §      | Issue                                            | Kind                     |
| ------ | ------------------------------------------------ | ------------------------ |
| **1**  | A signed-in user sees the previous user's resume | Correctness — do first   |
| **3**  | The red "N" badge                                | Dev-only config, ~15 min |
| **4**  | What "Things you can check for yourself" is for  | Answer + copy fix        |
| **4b** | SEO — what will actually move the ranking        | Strategy                 |
| **5**  | Selected text is invisible                       | One CSS rule             |
| **2**  | Cover letters — how it works, and what to build  | The feature package      |

Sections 4 and 4b answer two different questions that arrived together: what
that landing-page band is, and how to rank on Google. They are not the same
thing, and the band is not the lever — §4b says what is.

---

### 1. A signed-in user sees the previous user's resume — session hygiene

#### What is actually happening

Diagnosed to three root causes. The **server is not leaking** — every query and
write in `src/server/resumes.ts`, `cover-letters.ts` and `job-targets.ts` takes
`userId` first and filters on it, writes included (`updateMany({ where: { id,
userId } })`). The leak is entirely browser-local:

1. **The storage key has no identity in it.** `src/store/persistence.ts:20` —
   `STORAGE_KEY = "resume-draft"`, a plain constant in the shared default
   `keyval-store`. `createDraftStore` already accepts a `key` option
   (`persistence.ts:137`) but no production call site overrides it.
2. **Nothing clears local state at the auth boundary.**
   `src/app/signin/actions.ts:94-96` — `signOutAction` is one line
   (`signOut({ redirectTo: "/" })`). No `events.signIn`/`events.signOut`
   callbacks exist in `src/server/auth/config.ts:269-281`. `detachRemote()`
   (`src/store/resume.ts:339`) was written for exactly this — its own comment
   says _"what signing out leaves behind"_ — and **has zero callers**.
3. **The builder never consults identity.**
   `src/components/builder/BuilderShell.tsx:113-152` decides only on whether a
   `remote` prop was passed; `signedIn` is not part of the decision. So
   `src/app/builder/page.tsx:38` (no `?resume=`) and `:41` (a resume that is
   not yours) both fall into the same unconditional `hydrate()` of the shared
   key.

Escalation path: `src/components/dashboard/ClaimDraftPrompt.tsx:58-87` reads
that same key on dashboard mount and offers the previous person's resume — with
their real name rendered in the summary — to whoever is signed in now. One
click copies it into their account.

**Severity, stated accurately.** This is a confidentiality and UX failure, not
a cross-account write. Because `saveResume` filters on `userId`, edits made by
user B carrying user A's `remoteId` match zero rows and return _"That resume no
longer exists on this account"_ — they cannot corrupt A's data. The real
damage is (a) A's resume content is readable by B on the same browser, (b) B's
edits silently fail to sync because they are stamped with a foreign id.

Yes, this affects the magic link identically — the cause is below the auth
provider, so it is provider-agnostic.

#### Plan

**Chosen behaviour: namespace per user, and purge the other slots when a
different account signs in.** Your own local work returns when you sign back
in; nobody else's is left on the device.

- **Namespace every client-side store by user.** Thread an owner key
  (`user.id` when signed in, a literal `guest` when not) into `createDraftStore`
  via the existing `key` option. Same treatment for the other unnamespaced
  stores found: `src/store/cover-letters.ts:29` (`cover-letters`),
  `src/store/job-targets.ts:27` (`job-targets`),
  `src/lib/thumbnail/cache.ts:35` (`resume-thumbnails`), and the localStorage
  key at `src/lib/resume/experience-level.ts:71`.
- **Purge foreign slots on identity change.** Record the last owner key seen on
  this device. When a different one signs in, delete every namespaced key that
  is neither the new owner's nor `guest`. This needs an enumeration helper over
  `keyval-store` (`idb-keyval`'s `keys()`), which `idbBackend`
  (`src/store/persistence.ts:31`) does not expose yet — add it there rather
  than reaching into `idb-keyval` from a component.
- Keep `guest` deliberately: it is what the existing "Save it to my account"
  claim flow depends on, and wiping it on sign-in would destroy the exact work
  that flow exists to rescue.
- **Get the user id to the client.** No component receives it today — only a
  boolean `signedIn`. Pass `user.id` from the server components that already
  read the session (`src/app/builder/page.tsx`, `dashboard/page.tsx`,
  `letters/[id]/page.tsx`) down to the stores.
- **Purge at the auth boundary.** Wire the dead `detachRemote()` up, and reset
  the in-memory Zustand store on sign-out. `signOutAction` redirects via a
  Server Action (a _soft_ navigation), so the module-scoped store and
  `remoteSync` survive in memory too — a client-side hook must do the reset,
  not the server action alone.
- **Make the builder identity-aware.** `BuilderShell` should not hydrate a
  draft belonging to a different owner. A signed-in user with no `?resume=`
  should get their own empty document or be sent to the dashboard — not
  whatever is in the shared slot.
- **Fix the "not yours" fall-through** at `src/app/builder/page.tsx:41` so a
  resume id that is not yours does not silently render the local draft.
- **Do not offer another person's draft.** `ClaimDraftPrompt` should only
  surface a draft whose owner key is `guest`. Its "Not now" should persist the
  dismissal (currently `setState` only, so it re-offers to the next person).

#### Verification

- Two Google accounts in one browser: build as guest → sign in as A → sign out
  → sign in as B → `/builder` and `/dashboard` must both be empty for B.
- Repeat with the magic link to confirm it is provider-agnostic.
- New e2e coverage in `e2e/auth.spec.ts` using the local OpenID provider
  (`e2e/oidc-server.ts`) which already supports two identities.
- Reuse `waitForDraftSaved` from `e2e/draft.ts` for durability waits.

---

### 3. The red "N" badge — one dev-only CSP error on every page

#### What is actually happening

The badge is Next's dev overlay reporting a single error, present on `/`,
`/builder`, `/letters`, `/signin` and `/check`:

> `eval() is not supported in this environment … React requires eval() in
development mode for various debugging features … React will never use eval()
in production mode`

`next.config.ts:78` sets `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`
and deliberately omits `'unsafe-eval'` — correctly, and the file documents why
at length (lines 63-74). React's **development** build wants string `eval` for
source-mapped call stacks; the production build never does. So this is purely a
development artefact, and it is not a bug in the app.

#### Plan

- Add `'unsafe-eval'` to `script-src` **only when
  `process.env.NODE_ENV !== "production"`**, leaving the production policy
  byte-for-byte unchanged. The CSP is already built dynamically at build time
  (`googleSignInOrigins()`, `next.config.ts:24-34`), so this fits the existing
  shape.
- Extend the doc comment to say why the dev-only exception exists, so it is not
  later mistaken for a weakening of the real policy.
- The existing guard already protects production: `e2e/builder.spec.ts:241`
  asserts `csp` does **not** match `/(^|\s)'unsafe-eval'/`, and the e2e suite
  runs against `pnpm build && pnpm start` — so a dev-only relaxation keeps that
  test green and would fail loudly if it ever leaked into production.

#### Verification

- `pnpm dev` → the overlay badge is gone on all five routes.
- `pnpm test:e2e e2e/builder.spec.ts` → the CSP assertion still passes.
- `curl -sI http://localhost:3000/ | grep -i content-security-policy` in dev vs
  a production build, to see the two policies differ in exactly one token.

---

### 4. "Things you can check for yourself" — who is it written for?

#### Answering the question directly

**It is static marketing copy, identical for every visitor — nothing about it
is user-specific.** `src/lib/trust-signals.ts:58-96` is a module-level
`readonly` array of literals, rendered by `src/app/page.tsx:357-402`. The page
is a server component with no session access; `dynamic = "force-dynamic"` is
there only so canonical/OG URLs read the runtime origin (`page.tsx:114-125`),
not for personalisation.

It is the **trust-signals band (P37)** — the slot where every competitor puts
customer logos, a star rating and "trusted by 2M job seekers". This product has
no users yet, and `docs/DECISIONS.md` D14 forbids manufacturing that kind of
proof. The honest options were an empty slot or claims that survive being
checked, and this is the second; that is why the heading is a challenge rather
than a boast. **Its job is credibility, not ranking** — see §4b for the ranking
work, which is a different thing entirely.

The confusion is legitimate and is a real design flaw. The section's heading
promises a stranger can verify each line, but **four of the six `evidence`
values point at things a visitor cannot open**:

| Evidence shown                                            | Reachable by a job seeker?              |
| --------------------------------------------------------- | --------------------------------------- |
| `/check, and the network assertion in e2e/import.spec.ts` | half — `/check` is a real page          |
| `docs/DECISIONS.md, D13`                                  | no — a repo file, not a URL, not linked |
| `The X-Ray tab in the builder`                            | yes — the best row in the list          |
| `pnpm verify`                                             | no — needs the repo, Node and pnpm      |
| `docs/DECISIONS.md, D8`                                   | no                                      |
| `The dashboard, and src/server/accounts.test.ts`          | half                                    |

The `claim` and `detail` columns are strong, honest, user-facing copy. The
problem is isolated to the third column, which is addressed to a developer —
and is styled in mono (`text-machine font-mono`) as if to confirm it.

Separately, the numbers are _currently accurate_ (claimed 77 e2e vs 77 actual;
claimed 1,626 unit vs 1,627 actual — one stale), but the guard at
`src/lib/trust-signals.test.ts:88-101` is a **floor, not an equality**
(`toBeGreaterThanOrEqual`). Half the suite could be deleted and the claim would
stay green.

The repo is public — `https://github.com/M-J-7/ResumeForge.git` — so the
repo-path rows _can_ be made real links. They will still only pay off for a
developer, which is why the plan below also reorders them.

#### Plan

- **Add an optional `href` to `TrustSignal`** (`src/lib/trust-signals.ts:31-40`)
  and render the evidence as a real link when present. The type is already
  extensible and the length assertions at lines 56-63 do not block it.
- **Point each row at the cheapest thing the reader can actually check.**
  In-product rows link in-product (`/check`, the X-Ray tab, the dashboard);
  repo rows link to the file on GitHub, built from one `REPO_URL` constant in
  `src/lib/site.ts` so the host is written once.
- **Lead with the user-checkable rows.** Reorder so the three a visitor can act
  on come first, and demote the two that only a developer will follow.
- **Tighten the number guard.** `src/lib/trust-signals.test.ts:88-101` asserts
  `toBeGreaterThanOrEqual`, a floor rather than an equality — half the suite
  could be deleted and the page would keep claiming 1,626 with a green test.
  Make it exact, and refresh `unitTests` from 1626 to the current 1627.

#### Verification

- Every evidence value is either a link that opens or a place in the product
  named in plain words.
- `pnpm test src/lib/trust-signals.test.ts` for the tightened guard.
- Re-run `pnpm test:e2e e2e/a11y.spec.ts` — this is the page's only
  `.band-invert` band and the a11y suite is load-bearing on it.

---

### 4b. SEO — what will actually move the ranking

Separating this from the section above deliberately, because **that band does
nothing for SEO** and rewriting it will not move a ranking by itself. Here is
the real picture, measured in this repo.

#### What already exists (better than expected)

`src/app/sitemap.ts` lists **27 URLs** (18 when this was written): `/`,
`/check`, `/templates`, `/examples` + **16 role example pages**, `/guides` +
**4 guides**, `/privacy`, `/terms` — generated from the same arrays the routes
read, so a new page appears by existing, which is why doubling the examples
below changed nothing here. Per-page metadata, canonical URLs and a `robots.ts`
are all in place.

#### The blocker, stated plainly

`src/app/robots.ts` returns `Disallow: /` for everything while
`isPublicDeployment()` is false — that is, until `NEXT_PUBLIC_SITE_URL` or
`AUTH_URL` names a real origin (`src/lib/site.ts:19`). **The site is not
deployed, so Google cannot index a single page today.** That is correct
behaviour, not a bug, and it is also the reason no other SEO work returns
anything yet. `docs/IMPLEMENTATION.md` §6 already records this as the launch
debt. Ship to a domain first; everything below compounds only after that.

#### Real wins available in code now

- **Structured data — nothing exists.** `grep` for `application/ld+json` across
  `src/` returns zero hits. This is the single largest on-page gap:
  - `SoftwareApplication` (with `offers: price 0`) on `/` — the free-tool
    signal Google surfaces in rich results;
  - `Article` + `BreadcrumbList` on each of the 4 guides;
  - `FAQPage` on the guides that already pose a question — _"What an applicant
    tracking system actually does"_ and _"PDF, Word, or plain text: which file
    to send"_ are exactly the shape that wins the "People also ask" slot;
  - `ItemList` on `/examples` and `/templates`.
- **No social image at all** — `src/app/` has only `favicon.ico`, no
  `opengraph-image`. Every share of every URL renders as a bare link today.
  Add a generated `opengraph-image.tsx` at the root and for the two content
  sections.
- **Grow the content surface where the search demand is.** This is the biggest
  lever and the cheapest. `docs/IMPLEMENTATION.md` §3 already names the gap:
  competitors rank on "500+ examples across 20 industries"; this site has 8.
  Each role page is a long-tail landing page for _"&lt;role&gt; resume example"_,
  and the machinery is done — a new page is one entry in
  `src/lib/examples/roles.ts` and it flows into the sitemap and the index page
  automatically. Going 8 → 30 is data entry, not engineering.
- **Internal linking.** Cross-link guides ↔ examples ↔ `/check` ↔ `/templates`
  so crawl depth from the landing page is 2, not 3.

#### Verification

- `curl` the deployed `/robots.txt` and `/sitemap.xml` and confirm 27 URLs and
  an `Allow: /`.
- Validate structured data with Google's Rich Results Test on `/`, one guide
  and one example.
- Google Search Console: submit the sitemap, then watch Coverage.

---

### 5. Selected text is invisible

#### What is actually happening

A `::selection` rule does exist — `src/app/globals.css:320-323`:

```css
::selection {
  background: var(--accent-weak);
  color: var(--text);
}
```

`--accent-weak` is a near-ground _tint_, not a highlight. Measured against the
surface it sits on: **≈1.14:1** in light (`#e7f0eb` on `#fbfcfb`), **≈1.20:1**
in dark (`#10281f` on `#0e1311`), **≈1.19:1** inside `.band-invert`. The text
also keeps its normal colour, so selecting reads as doing nothing — exactly the
report.

#### Plan

- Change the two declarations to `background: var(--accent); color:
var(--on-accent);`. This stays **one rule**: `::selection` resolves custom
  properties from its originating element, so the same block automatically
  picks up the right pair in all four contexts — light, `data-theme="dark"`,
  the `prefers-color-scheme` fallback, and inside `.band-invert`. No per-theme
  duplication.
- Resulting pairs are the palette's own and are high-contrast by construction:
  light `#2f6b57` on white; dark and `.band-invert` `#6fcfa8` on `#06251a`.
- Check the one place the app paints its own white regardless of theme — the
  rendered resume page (`--paper`) — and add a scoped override there if the
  accent-on-paper pairing reads badly.

#### Verification

- Drag-select body copy on `/`, `/builder`, `/letters` and inside the inverted
  band, in both themes — the highlight must be obvious and the text readable.
- `pnpm test:e2e e2e/a11y.spec.ts` (axe does not inspect `::selection`, but the
  suite is the guard for this page generally).

---

### 2. Cover letters — how it works, and what to build

#### How the job description is actually used (the direct answer)

When you paste a posting, it is parsed into weighted requirements and scored
against your resume (`scoreResume` in `src/lib/match/score.ts`). The composer
then uses **exactly three things** from that result, and nothing else:

1. **`jdWeight` decides which of your bullets get quoted.** Requirements are
   ranked by how hard the posting leans on them (a line under "Required" is
   weighted 3×, "Responsibilities" 2×, "Preferred" 1×, "Benefits"/"Legal" 0).
   The composer walks them strongest-first and takes the top **2** matching
   bullets from your Experience or Projects.
2. **`status === "demonstrated"` decides which skills the alignment paragraph
   may name.** A skill merely _listed_ in your Skills section can never appear
   — only one backed by a bullet. If nothing qualifies, the paragraph is
   **omitted entirely** rather than faked.
3. Nothing else. **No wording from the posting is ever copied into your
   letter.**

Every sentence is either your own resume text copied verbatim, or a fixed
template from `src/lib/cover-letter/phrasing.ts` that contains no claim. Only
two transformations are permitted, both reversible — lowercase the first
character, and add a closing period — which is how `compose.test.ts` proves
verbatimness by undoing them and finding the text in your resume. That is D8
enforced in code, not a promise.

**Why it felt like the posting was being ignored:** the field has no hint
saying any of the above, and if Company and Role title are blank the opening
falls back to _"I am writing about the open role."_ — which reads exactly like
a letter that ignored your input.

#### Tier 1 — the broken happy path

- **`?job=` does not fill Company or Role title.** `selectJobTarget`
  (`LetterEditor.tsx:283-292`) copies `target.company`/`roleTitle` only from the
  `<Select>`'s `onChange`, so arriving from the Match tab via
  `/letters/new?job=<id>` leaves both blank — the opening degrades, the
  recipient company is empty, and the title falls back to "Untitled letter".
  Re-picking the same option does not re-fire `onChange`, so the only way out
  is to select "— none selected —" and back. **This is the single most visible
  defect in the intended flow.**

  _Fix:_ collapse both arrival paths into one. `selectJobTarget` becomes
  `setJobTargetId(id)` only, and the prefill moves to an effect keyed on
  `[jobTargets, jobTargetId]`, guarded by a ref recording which id has already
  been prefilled. An effect is required rather than preferred: a guest's
  `jobTargets` arrive asynchronously from IndexedDB _after_ mount, so there is
  no event to hang the write on. Use `setCompany(c => c || target.company)` so
  it is idempotent and cannot overwrite a field the user deliberately cleared.
  The existing docblock argues against an effect — it needs rewriting, not
  ignoring: arriving with `?job=` is also an event, it just fires before the
  data exists.

- **A posting pasted in the letter editor is never saved.** `pastedJd` is not
  written to `jobStore` and not stored with the letter (only `jobTargetId` is),
  so reopening a saved letter and pressing Recompose fails with _"Choose a
  saved job description, or paste one below."_

  _Fix:_ on **Save letter**, if `pastedJd` is non-empty, `jobStore.create(...)`
  — **create, never `save(jobTargetId, …)`**, so pasting new text after picking
  a saved posting cannot silently overwrite that posting. Then set
  `jobTargetId`, clear `pastedJd` (so a second Save cannot duplicate the row),
  and say so. Do **not** put the posting text in `CoverLetterDocument`: that
  needs a schema v2 for something the `JobTarget` table already exists to hold,
  and would push up to 60 KB into a column documented as self-contained. The
  storage seam is already right — guests write to IndexedDB (D6 intact),
  signed-in users hit the same Server Action the Match tab uses.

- **`pastedJd` silently overrides a selected posting** with no indication of
  which source was used. _Fix:_ badge the select with _"The pasted text below
  is used instead"_, add a **Clear** button on the paste box, and after
  composing name the source under the draft banner.
- **The "no job description" error is wrong when the posting was deleted.**
  `loadJobDescription` should return the record, not just `description`, so a
  `jobTargetId` that no longer resolves says _"The posting this letter was
  written from has been deleted"_ instead of telling the user to choose one
  they already chose.
- **Orphaned preposition** (`compose.ts:274-282`): an experience entry with a
  title but a blank organization produces literally _"I am currently
  Engineering Lead at ; the work below is what I have to show for it."_ The
  comment claims the sentence is dropped; nothing drops it — `fill()`
  substitutes `""` and `sentences.filter(Boolean)` only removes empty strings.
  **No test covers it** (the fixture at `compose.test.ts:63` always sets an
  organization).

  _Fix:_ mirror the variant pattern `OPENING_LEAD` already uses — widen
  `OPENING_ANGLE` to `{ full, withoutOrganization }` and add nine
  `withoutOrganization` strings that are each their sibling minus
  `" at {organization}"`. Claim-free by construction. `OPENING_ANGLE` has
  exactly one consumer, so the shape change is contained. The test must loop
  all nine tone × angle combinations, assert no `/\bat\s*[;.,]/`, and assert
  the title itself survives — dropping the whole clause would lose the user's
  own text.

- **Reopening a saved letter drops most of the setup.** The load effect
  (`LetterEditor.tsx:229-259`) restores `company`, `roleTitle` and
  `jobTargetId` but leaves recipient, salutation, sign-off, tone, angle and
  availability at defaults — so pressing Recompose after reopening silently
  rewrites the letter in a different tone and drops the recipient. Rehydrate
  everything the document already carries. `tone`/`angle`/`availability` are
  stored nowhere (that needs the schema bump listed in Tier 3), so until then
  show an honest warning rather than pretending they were restored.
- **Bullets from custom sections lose their attribution.**
  `organizationForEntry` (`compose.ts:121-136`) only searches experience and
  projects, but `evidence.ts` tags custom-section bullets as `projectBullet`,
  so they _can_ be selected and then render through the bare `"I …"` frame.
  Add a `custom` branch returning `entry.title || entry.subtitle`. No fixture
  exists for custom sections — add one.
- **No unsaved-changes guard** — `dirty` renders a badge but nothing blocks
  navigation. `beforeunload` plus a `window.confirm` on the "All letters" link
  (App Router client navigation does not fire `beforeunload`);
  `LettersBrowser.tsx:110` already uses `window.confirm`, so this is house
  style.

> **e2e locator hazard, applies to every item here.**
> `e2e/match-and-letters.spec.ts` selects by the accessible names
> `"Job description"`, `"Company"`, `"Compose draft"` and
> `"Evidence paragraph"`. Keep those names or update the spec in the same
> commit.

#### Tier 2 — the wins that make it impressive, still inside D8

**2.1 — Make provenance legible. The highest-value item in this plan.** The
product's whole claim is "every sentence came from your resume", and the only
evidence a user sees is a chip whose tooltip is a pair of UUIDs
(`LetterEditor.tsx:868`). Three parts:

- New `src/lib/cover-letter/provenance.ts` exporting `findEntry(resume, id)` and
  `describeSources(resume, ids)` → _"Platform Engineer at Meridian Health"_, a
  project `name`, or a custom entry `title`. An unresolvable id (the resume was
  edited after the letter was written) returns null and the chip degrades to the
  count — honest rather than wrong. `organizationForEntry` should call the same
  traversal so attribution and source labels can never disagree.
- Turn the chip into a `<button aria-expanded>` disclosure that quotes the
  resume text the paragraph drew on — the pattern `MatchReport`'s
  `ChecklistRow` already uses.
- **Give the alignment paragraph real sources.** `buildAlignment` returns
  `sources: []` even though every skill it names was chosen _because_ the
  resume demonstrates it. So the one paragraph that most looks like an
  assertion is the one carrying no provenance. Populate it from the demonstrated
  evidence behind the named skills.

**2.2 — Make the JD→letter connection legible, and blame the right thing.**

- The "Or paste a posting" field has **no hint at all**, and Company/Role title
  have none either. One line each, saying what the posting decides and that no
  wording from it is copied.
- **Distinguish the three empty-evidence cases** in `buildEvidence`, which
  already has `match.unmatchedJd` in hand and can scan the resume — both pure:
  posting unrecognised / resume has bullets but none matched / resume genuinely
  has no bullets. Today all three produce _"[Add a bullet or two…]"_, which
  blames the resume for what is often a posting problem. Two new bracketed
  phrasing constants, keeping the conspicuous style so they cannot be sent by
  accident.
- Extract the `unmatchedJd` block from `MatchReport.tsx:138-152` into a shared
  `UnmatchedPostingNotice` and render it in the editor too. That copy already
  says the right thing — _"That is a statement about the posting and about our
  vocabulary, not about your resume"_ — so reuse it rather than write new.
- Render the posting's **top asks** in the editor, marking which the alignment
  paragraph actually names. Extract from `MatchReport.tsx:250-281`; the data is
  already computed and discarded.

**2.3 — Recipient, salutation and sign-off.** `ComposeInput` already accepts
`salutation`/`signOff` and `composeCoverLetter` already honours them — the gap
is purely UI. Render Greeting above the paragraph list and Sign-off below it,
in the middle column, because these are letter _content_ and must be editable
without recomposing. One new constant, `SALUTATION_WITH_NAME = "Dear {name},"`,
filled with the user's own typed name. **Never guess an honorific** — no
"Mr."/"Ms."/"Dr." — that would be inventing a fact about a person.

**2.4 — Per-paragraph Recompose uses stale setup.** `composeInputs` freezes the
whole setup, so changing Tone then pressing a paragraph's Recompose silently
reproduces the old tone. Split the snapshot: keep only the expensive async
parts (`resume`, `match`) in state and rebuild the rest from live UI state via
a pure `toComposeInput(sources, setup)` in a new `src/lib/cover-letter/setup.ts`
— which also makes the regression test a cheap node test instead of a jsdom one.

**2.5 — The Match tab CTA is hidden until the posting is saved.** A user who
pastes and analyses without saving sees no path to the feature at all. Always
render it, labelled _"Save posting and write a cover letter"_, saving then
navigating. Navigate with `window.location.assign`, **not** `useRouter` —
`MatchPanel` deliberately avoids an app-router dependency because
`BuilderShell.test.tsx` renders it in jsdom.

**2.6 — Reach the `custom` paragraph role.** Add / remove / reorder for the
user's own paragraphs. `composeParagraph` already returns null for `custom` and
`canRecompose` already hides Recompose on it, so no `lib/` change is needed.
Enforce `MAX_PARAGRAPHS = 12` in the UI or saves fail zod validation with an
opaque error. Badge paragraphs the user has edited, so "Recompose draft" can
warn _"this replaces 2 paragraphs you edited"_ instead of the passive note.

#### Tier 3 — deferred, recorded so it is not rediscovered

Configurable evidence count (`selectEvidence` already takes a `limit`; cap at 4,
where `EVIDENCE_CONNECTORS` stops repeating); picking the _strongest_ bullet per
keyword rather than the first in document order; letting the user choose which
bullets are quoted; a "what this letter does not say" panel from the discarded
`match.recommendations`; persisting `tone`/`angle`/`availability` with the
letter (schema v2 + a migration, which is what would let a reopened letter fully
restore); and a **Trace** toggle that highlights the spans which are literally
the user's own resume text — `compose.test.ts`'s guarantee-2 already knows how
to compute that, and it is the single most convincing thing this product could
show a first-time user.

#### Sequencing

1. The pure `lib/` fixes first — orphaned preposition and custom-section
   attribution. Tests, no UI coupling, and they establish the shared traversal
   that `provenance.ts` needs.
2. The Recompose snapshot split, because 2.1 and Tier 3's evidence control both
   consume it.
3. One coherent pass over the Setup column: `?job=` prefill, persisting the
   pasted posting, and naming the source.
4. Provenance, salutation, custom paragraphs, then the unsaved-changes guard.
5. The Match tab CTA last — it touches different files and is independent.

#### Verification

- From the builder: paste a posting → Analyse → Save → "Write a cover letter" →
  Company and Role are pre-filled and the opening names the role. The assertion
  that pins it is that the opening contains _"Senior Platform Engineer role at
  Acme"_ rather than _"the open role"_ — that proves `OPENING_LEAD.full` was
  chosen over `.neither`.
- Paste a posting directly in the editor → Compose → Save → reload → Recompose
  still works.
- Compose → change Tone to Formal → Recompose just the evidence paragraph →
  it now starts _"During my time at"_.
- A resume whose current role has no organization composes without _"at ;"_,
  across all nine tone × angle combinations, with the title still present.
- `pnpm verify`, plus `pnpm test:e2e e2e/match-and-letters.spec.ts`.
