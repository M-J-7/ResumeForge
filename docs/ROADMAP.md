# Six Seconds Resume — what's left, how to beat competitors, how to rank

> **The working plan from 2026-09-28 onward.** `IMPLEMENTATION.md` remains the record of what is
> built and what binds new work (§2 especially); this file is what to build next and in what
> order. Move an item to IMPLEMENTATION.md §1 as it lands, and tick it off here.
>
> **Written:** 2026-09-28 · **Owner:** solo, part-time.

## Progress

| Item | State |
|---|---|
| A1 — commit the working tree | **Done** 2026-09-28 (`93cdbc1`). One commit: `trust-signals.test.ts` pins the suite size exactly, so any split leaves intermediate commits red |
| A2 — merge to master and deploy | **Waiting on you.** The branch contains every open branch, and a dry-run merge with `origin/master` produces an identical tree. Needs: push, PR, merge, then `sudo ./deploy/oracle/deploy.sh` on the instance |
| A3 — `deploy.sh` built on a box that cannot build | **Done.** Pulls the image CI published for the exact commit, before moving the checkout |
| A4 — Brevo click tracking burns magic links | **Waiting on you** — a Resend account, then one `EMAIL_SERVER` line in `.env.production` |
| A5 — `/pricing` stated limits nothing enforces | **Done.** The account tier says there is no limit while the Pass is not on sale; a test ties the two |
| A6 — uptime monitor | **Waiting on you** — UptimeRobot (free) on `https://sixseconds.tech/api/health` |
| Phase 1.1 — Search Console and Bing | **Waiting on you** — both verify by DNS TXT record at the registrar |
| Phase 1.2 — IndexNow | **Done** — `deploy.sh` pings after a healthy deploy that changed content; first runs on the next deploy |
| Phase 1.3 — content pages static | **Done.** Ten routes prerendered (`○`/`●`); header split into `AppHeader` (server) and `SiteHeader` (browser); the Dockerfile refuses to build without the public origin. IMPLEMENTATION.md landmines 25–27 |
| Phase 1.5 — brand disambiguation | **Done.** `WebSite` + `Organization` JSON-LD, and a real favicon — the shipped one was create-next-app's Vercel triangle |
| Phase 1.4 — sitemap dates | **Done** — `updated` on every example, guide and reference page; a hash pin fails the build if content changes without its date |
| Phase 1.7 — internal linking | **Done** — "Keep reading" cards and visible breadcrumbs on examples and guides; every example is linked from another |
| Phase 3 — `/resume-action-verbs` | **Done** — 115 verbs in the phrase bank's 12 groups, each held to the lint engine, plus the openers the checker flags |
| Phase 3 — `/bullet-point-checker` | **Done** — the builder's coach and lint engine on pasted bullets, in the browser; asserted to send nothing anywhere |
| Phase 1.6 — mobile page speed | Waits on the deploy: measure with PageSpeed Insights against the live site |
| Everything else | Not started |

## Context

You asked three things: **what is still remaining**, **what features would make this beat other
resume builders and something people can rely on**, and **how to make it rank heavily on Google**.
Market decision (2026-09-28): **India and US in parallel.**

This plan comes from the repo docs, git history and the live site at `https://sixseconds.tech`,
all checked on 2026-09-28. The engineering is ahead of competitors: 1,951 unit and 95 e2e tests,
the X-Ray parse check, free exports, and no data leaving the browser. Where the product loses is
**distribution**. Three facts decide the order of work:

1. **The live site is about two weeks behind the code.** The redesign, `/pricing`, per-page social
   cards, the robots fix and the keyword-bearing home title are all **uncommitted** (66 modified and
   25 untracked files on `composer-evidence-and-enhance-evaluation`). What the live site shows today:
   - `/pricing` returns 404.
   - Every page's `og:url` points at the home page.
   - `robots.txt` still disallows `/builder` and `/signin`.
   - The home `<title>` ("Six Seconds Resume — free downloads, nothing uploaded") doesn't contain
     the words "resume builder".
2. **Google has not indexed the site.** A `site:sixseconds.tech` search returns nothing, 16 days after
   launch. The query "six seconds" belongs to 6seconds.org, an emotional-intelligence nonprofit.
3. **The server can't take a traffic spike.** It runs on an E2.1.Micro (1 GB RAM, 1/8 OCPU), and
   every page is rendered per request with `Cache-Control: no-store`. That's fine with no users. The
   first Reddit or Hacker News thread would take it down, and the plan's own promotion work is
   designed to cause exactly that spike.

**Binding constraints** (`docs/DECISIONS.md`; not reopened here):
- **D8:** no AI writes resume or letter content, and no hosted LLM.
- **D13:** downloads are never paywalled.
- **D12/D14:** no live score and no "beat the ATS" claims.
- **D6:** guest data stays in the browser.
- **D10:** every persisted type ships with a migration chain.
- **No photo and no two-column layouts.**

Every competitor now sells an "AI resume writer". This product wins on the opposite claim, and the
features below are chosen to deepen that position rather than copy theirs.

---

## Part 1 — What is remaining (verified 2026-09-28)

### A. Release and operations (blocks everything else)

| # | Item | Evidence | Size |
|---|---|---|---|
| A1 | Commit the working tree in logical commits (redesign, pricing, SEO/metadata, FAQ, palette tests) | `git status`: 66 M + 25 ?? | S |
| A2 | Merge to master and deploy. All five open branches are **already contained in HEAD**, so one merge covers them. Remote master is at `248595b`, which isn't in the local clone, so run `git fetch` and reconcile first | `git merge-base --is-ancestor` checked | S |
| A3 | `deploy/oracle/deploy.sh:49` still runs `docker compose build app backup` on a box that can't build. Change it to `docker compose pull` from ghcr.io and drop the build step, including the rollback path at `:79` | read today | S |
| A4 | The Brevo click tracker spends single-use magic links before users click them (mail scanners prefetch the link). Switch `EMAIL_SERVER` to Resend with tracking off | `BLOCKERS.md` §0 | S |
| A5 | `/pricing` says a free account gets "One stored resume", but **no limit exists in code** (`src/server/resumes.ts` only counts). Either reword it to "unlimited during early access" or enforce the limit with grandfathering before shipping. Shipping it as written is a false claim | `src/lib/pricing.ts` | S |
| A6 | Uptime monitor on `/api/health` (UptimeRobot free). This is also insurance against Oracle reclaiming idle Always Free instances | none exists | S |

### B. Quality debt and unverified claims

| # | Item | Evidence |
|---|---|---|
| B1 | **None of the 10 manual QA checks has been run**, including #1, "DOCX opens cleanly in Word/LibreOffice/Google Docs", which is the product's core claim, and #8, a real phone at 390px | `docs/QA.md`: "not yet run" ×10 |
| B2 | Safari/WebKit is unmeasured (the e2e server can't speak TLS). iPhone is a large share of US mobile traffic | QA.md known limitations |
| B3 | Lighthouse ≥ 90 against the live origin is still open (B5/B7) | REDESIGN-LOG "Not done" |
| B4 | Cover letters: Tier 1 and 2 are **done in code**, so MONETISATION.md §2b is stale. Tier 3 remains: persist tone/angle/availability (schema v2), the Trace toggle, and user-chosen evidence bullets | `phrasing.ts:111`, `LetterEditor.tsx:1009` |
| B5 | The skill vocabulary only covers tech. The nurse, teacher and admin assistant example resumes match **nothing** | QA.md known limitations |
| B6 | Names in Indic scripts render as boxes; there is no Noto fallback | `src/lib/fonts/charset.ts` |
| B7 | `auth.spec.ts` runs serially, so one flake skips 13 tests | BLOCKERS §3a |
| B8 | Stale docs: the IMPLEMENTATION.md header still says 2026-09-03; MONETISATION §2b is stale; a memory entry points at a deleted plan file | — |

---

## Part 2 — The roadmap (12 weeks, solo, part-time)

Phases overlap. Content (Phase 3) and outreach (Phase 5) run weekly from week 2 onward.

### Phase 0 — Ship what's built and make it safe (week 1)

A1–A6 above, then deploy and run a live smoke test (see Verification).

### Phase 1 — Get found: technical SEO (weeks 1–2)

1. **Register with the search engines.** Google Search Console and Bing Webmaster Tools, both
   verified by DNS TXT record (no script on the pages). Submit `sitemap.xml`, and request indexing
   for `/`, `/check`, `/templates`, `/examples` and the top 10 content URLs. Bing matters beyond
   Bing itself: it feeds ChatGPT search and Copilot.
2. **IndexNow ping on deploy.** A small script in `deploy.sh` that sends changed URLs to Bing and
   Yandex. Serve the key file from `public/`.
3. **Make content pages static.** This is the performance and crawl-budget fix, and it's the one
   non-trivial engineering step here.
   - Pass the origin as a **build argument** in the CI image build (`NEXT_PUBLIC_SITE_URL`). Next 16
     freezes `NEXT_PUBLIC_*` values at build time; see
     `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.
   - Remove `force-dynamic` from `/`, `/check`, `/templates`, `/pricing`, `/examples[/*]`,
     `/guides[/*]`, `/privacy` and `/terms`.
   - **Wrinkle:** `AppHeader` (`src/components/shell/AppHeader.tsx:77`) calls `getSessionUser()`
     from the root layout, which makes *every* route dynamic. Split it: a static header shell, plus
     a small client island that asks `/api/auth/session` who is signed in and then renders the
     signed-in links and `StorageOwner`.
   - **Invariant that must hold:** no store may build its storage key before the owner is known
     (the shared-computer privacy fix, `src/store/owner.ts` / `purge.ts`). Stores on `/check` and
     `/templates` must wait for the owner.
   - The two-identity tests in `e2e/auth.spec.ts` must pass unchanged.
   - Read `02-guides/self-hosting.md` and `caching-without-cache-components.md` before starting.
4. **Accurate `lastModified` in the sitemap.** Add an `updated` date to each entry in
   `src/lib/examples/roles.ts` and `src/lib/guides/guides.ts`, and emit it from `src/app/sitemap.ts`.
5. **Brand disambiguation.** Add `WebSite` and `Organization` JSON-LD (name "Six Seconds Resume",
   `alternateName`, `url`, `logo`, `sameAs` → GitHub) in `src/lib/structured-data.ts`, rendered on
   `/`. Google uses `WebSite` for the site name it shows in results. Always write the full three-word
   name; never "Six Seconds" alone.
6. **Largest Contentful Paint (LCP) check on mobile.** Text on the page starts clipped (from
   Motion's server-side inline style) until hydration. If the hero `<h1>` is the LCP element, LCP
   ends up equal to hydration time on slow 4G. Exempt above-the-fold LCP text from the reveal, and
   measure with PageSpeed Insights on `/`, `/check` and one example page.
7. **Internal linking.** Add "related examples" and "related guides" blocks, link each example to
   the matching guide and to `/check`, and show a visible breadcrumb matching `breadcrumbJsonLd`.
   Keep crawl depth from `/` at 2 or less.

### Phase 2 — Reliability: "users can rely on it" (weeks 2–4)

| # | Feature | Why |
|---|---|---|
| R1 | **Installable PWA with an offline builder**: manifest, plus a service worker caching the app shell, fonts and `pdf.worker.min.mjs`. The CSP needs `worker-src 'self'`. See `02-guides/progressive-web-apps.md` | The builder already works with the server down (D6). An installable, offline app suits Indian mobile users on patchy networks, and competitors don't offer it |
| R2 | **Guest backup nudge**: after meaningful work, "This lives only in this browser; download a backup or save to an account". Reuses the JSON Resume export. (`navigator.storage.persist()` is already requested in `src/store/persistence.ts:93`) | Clearing browser data is the only way a guest loses work |
| R3 | **Same-origin client error beacon**: error name, route and build id only, never content. Stored as scrubbed counts | Browser-side crashes are currently invisible |
| R4 | **WebKit in e2e over TLS**: self-signed certificate and `ignoreHTTPSErrors` in `playwright.config.ts` | Closes B2 |
| R5 | **Run QA.md checks #1–#10** and record the results; add a structural fixture for each miss | Closes B1. Don't promote the product before #1 passes |
| R6 | **Weekly automated restore check**: restore Litestream into a temp file and run `scripts/backup.mjs verify` | An unverified backup is a hope |
| R7 | **Public `/changelog`** | Trust signal and a steady freshness signal for crawlers |

### Phase 3 — Content engine, India and US in parallel (weeks 2–12, continuous)

Content is authored in-session and **gated by the existing quality bar**:
- `examples.test.ts`: lint-clean, the Bullet Coach satisfied on every bullet, no outcome claims.
- D14: no outcome claims anywhere.
- Every page gets a distinct angle; none is a template with the role name swapped.

D8 governs what the *product* generates. It doesn't forbid authored editorial content, which is how
the existing 16 examples were made.

**Schema change first:** add `market: "IN" | "US" | "global"` and `pageSize` to `RoleExample`, so
India examples render A4 with Indian conventions (CGPA or percentage, campus projects) and US
examples render Letter.

**Pace:** about 4 examples and 1–2 guides a week, split evenly between markets. **Target by week 12:
60 examples and 20 guides** (from 16 and 4). Before authoring each batch, confirm demand with Search
Console queries and Google Keyword Planner. The lists below are a starting hypothesis.

| Cluster | India (A4) | US (Letter) |
|---|---|---|
| **Examples** | fresher software engineer (campus/IT services), B.Tech fresher, B.Com fresher, MBA fresher, Java developer (2–4 yrs), BPO customer support, accountant (Tally/GST), bank clerk/PO aspirant, B.Ed teacher, GNM/B.Sc nurse, civil engineer fresher, HR executive, sales executive, digital marketing executive, diploma engineer | cashier, server/bartender, warehouse associate, medical assistant, CNA, pharmacy technician, electrician, truck driver, receptionist, paralegal, dental assistant, social worker, product manager, data scientist, UX designer |
| **Guides** | resume format for freshers · resume for campus placement · CV vs resume vs biodata · resume for Naukri · resume for US jobs from India | how to write a resume summary · employment gap · career change · resume length · federal vs private resume |
| **Measured guides** (both markets; the differentiator) | "Does a two-column resume break ATS parsing? Measured" · "PDF vs DOCX parse accuracy, measured" · "What Canva/Word templates lose in extraction" | ← same pages serve both |

**Tool pages** (free, client-side, no account). These rank well and attract links:
- `/tools/resume-keyword-scanner`: the match engine (`src/lib/match/score.ts`) on a pasted job
  description plus an uploaded or pasted resume. This is Jobscan's core feature, done in the
  browser.
- `/tools/bullet-point-checker`: the Bullet Coach (`src/lib/coach/parse-bullet.ts`) as a public page.
- `/resume-action-verbs`: a static reference built from the lint engine's strong/weak verb sets
  (`src/lib/lint/rules.ts`).
- **Free Word/PDF template downloads**: sample files generated at build time by the real emitters
  (new script `scripts/build-template-samples.mjs`), linked from `/templates`. "resume template word
  free download" is a very large query in both markets, and D13 makes these free anyway.
- `/templates/[slug]` pages, **only if** each has 150+ words of unique `forWho` and section-order
  rationale. Otherwise they are thin pages; skip them.

**Trust signals for Google (E-E-A-T: experience, expertise, authority, trust):**
- An `/about` page: who builds it and why, plus the no-AI and privacy position.
- Author bylines and a `Person` entity on guides.
- An editorial and methodology page.
- "Last reviewed" dates.
- Cited sources (O*NET, BLS, NCS India).

**AI Overviews, ChatGPT and Perplexity citations:**
- Open each section with a direct answer, followed by the evidence.
- Keep the FAQ blocks (JSON-LD already exists).
- Publish measured data tables with a `Dataset` JSON-LD entry.
- Don't block Google's AI crawlers in robots.

### Phase 4 — Features that beat competitors (weeks 3–10, in this order)

All deterministic and inside D8, D13 and D6.

| # | Feature | What it is | Why it wins |
|---|---|---|---|
| F1 | **Six-Second View** | An overlay on the real PDF showing what a recruiter's F-pattern scan reaches in six seconds: name, current title, employer, dates, first two bullets per role. Flags when key facts fall outside it. Built from `buildDocument` blocks plus pdfjs text positions. Already in the M4 backlog | It *is* the brand. Nobody else can show this, and it makes a very shareable 10-second video |
| F2 | **Keyword scanner** (the Phase 3 tool) | Public version of the Match tab | Top-of-funnel for both markets |
| F3 | **Application tracker + version history** | Per application: company, role, date, status, *which resume version* and *which letter* were sent. `ResumeVersion` (`prisma/schema.prisma:87`) exists and nothing writes to it: add snapshots on export, labels, restore as one undo step, and a diff. Guests store in IndexedDB (D6) | This is Teal's anchor feature, and the Pass copy already promises "a record of what you sent where" |
| F4 | **Truth-preserving tailoring** | A per-job variant of a resume: reorder bullets and skills by job-description weight, hide irrelevant bullets, and list the posting's asks you *have* but haven't evidenced ("you list SQL; no bullet shows it"). Never rewrites text | The honest answer to competitors' "AI tailor" |
| F5 | **Non-tech vocabulary** | Extend the O*NET extraction in `src/lib/skills/` and the phrase scaffolds in `src/lib/phrases/` to healthcare, education, admin, trades, finance, retail and hospitality. Update the `skillTerms` trust-signal constant | Fixes B5. Roughly quadruples the audience the match and letter features serve |
| F6 | **LinkedIn profile-PDF import** | A parser profile for LinkedIn's "Save to PDF" layout, added to `src/lib/import/parse-resume.ts` | The most-requested onboarding path in both markets |
| F7 | **One-page fit assistant** (M4-T3) | Binary-search density, spacing and margins against *measured* page counts, inside the legibility floors `templates.ts` already enforces | Freshers need one page |
| F8 | **India pack** | Campus-placement and fresher template presets (A4), CGPA/percentage handled in education, an optional "Declaration" section preset (with a guide explaining when to omit it), and a Noto fallback for Indic names (B6). *No DOB, photo or marital-status fields*: data minimisation stands, and a guide explains why | No global builder does this well |
| F9 | **"Defend every number"** | An interview-prep checklist listing every figure and claim in the resume, grouped by role | Pure D8: "we won't write anything you'd have to defend" |
| F10 | **Spellcheck** | `spellCheck` and `lang="en"` on every text field (none set today) | Cheap, and a common failure competitors catch |
| F11 | **Cover-letter Tier 3** | Persist tone/angle/availability (letter schema v2 with a D10 migration), add the Trace toggle, let users choose the evidence bullets | Closes B4 |

**Deliberately not building:** an AI writer or "enhance with AI" (D8); photos or two-column layouts;
paywalled downloads (D13); a 0–100 ATS score (D12/D14); a job board; public profile links.

### Phase 5 — Authority and distribution (weeks 3–12, 4–6 hrs/week)

Links are what move a new domain, and none of this needs code.

1. **Flagship link asset: the ATS Parse Report.** Run exports from popular builders and templates
   through X-Ray and publish the method and raw data as a `Dataset`. Re-run it quarterly. Pitch it
   to career journalists (Qwoted/Featured) and to Reddit.
2. **Launches**, only after Phase 0 and QA #1:
   - Show HN (lead with the engineering).
   - Product Hunt.
   - An AlternativeTo listing as an alternative to Zety, Resume.io, Canva and Novoresume.
   - Free-tool and privacy directories.
   - The public GitHub README, with a link back.
3. **India**: placement cells and T&P offices (a free tool for campus drives earns `.ac.in` links),
   plus r/developersIndia, r/Indian_Academia and r/cscareerquestionsIN (participate first).
4. **US**: r/resumes, r/EngineeringResumes, r/jobs; career coaches and bootcamps (links, and later
   the Check widget from MONETISATION.md §3b).
5. **Short video**: "Here's your resume; here's what the machine read" (X-Ray, later the Six-Second
   View) on YouTube Shorts, Reels and LinkedIn.

### Phase 6 — Monetisation hooks

Follow `docs/MONETISATION.md` (the $19 Pass with no auto-renew, the first-party counter at
`/api/e`), with two corrections:
- §2b is done; see B4.
- Reconcile the free-tier limits with A5 before any limit ships.

The first-party event counter (Phase 1 of that doc) should land **in week 2 of this plan**, because
SEO work that can't be measured can't be steered.

---

## Part 3 — Targets (goals to steer by, not forecasts)

| When | Target |
|---|---|
| Week 2 | 100% of sitemap URLs indexed in Search Console; the brand query "six seconds resume" returns this site first |
| Week 6 | 60+ indexed URLs; 10+ referring domains; mobile Lighthouse ≥ 90 on `/`, `/check` and one example |
| Week 12 | 100+ indexed URLs (60 examples, 20 guides, tools); 25+ referring domains; 100+ queries ranking in the top 20; first page-one long-tail rankings in both markets |
| Month 6 | 2–5k organic clicks a month is a realistic range for a new domain at this size. Head terms like "resume builder" or "resume format" are 12–24-month goals, won with links rather than page count |

---

## Verification

**Every change:**
- `pnpm verify` green.
- `pnpm test:e2e --workers 3`. First confirm port 3000 isn't a stale server, because Playwright
  reuses it and would silently test an old build.
- `pnpm qa:sweep` and `pnpm qa:budget` after any styling change.
- No existing test file modified (IMPLEMENTATION.md §2.3 selectors).

**After Phase 0 deploy (live):**
- `curl https://sixseconds.tech/robots.txt` shows no `/builder` or `/signin` disallow.
- `/pricing` returns 200.
- `og:url` equals the page's own URL on `/check`, an example and a guide.
- The home `<title>` contains "resume builder".
- A magic link to an Outlook or Google Workspace address still works after the mail scanner has
  seen it.
- Litestream is still replicating.

**Phase 1:**
- Static routes return cacheable headers (not `no-store`). `.next` contains prerendered HTML with
  the production canonical.
- The two-identity `auth.spec.ts` tests pass unchanged.
- Google's Rich Results Test is valid on `/`, one guide and one example.
- PageSpeed Insights mobile ≥ 90.

**Phase 3 content:** `examples.test.ts` and `e2e/content.spec.ts` (renders with JavaScript off, is
in the sitemap, axe clean) cover each new page automatically, because the tests read the arrays.

**Features:** each ships with unit tests and a spec, for example:
- F1 asserts the six-second region against fixture PDFs.
- F3 asserts restore is one undo step and that guests never touch the server.
- F4 asserts no bullet text changes (reusing the verbatim proof in `compose.test.ts`).
- F5 asserts the nurse, teacher and admin examples now match.

**Housekeeping:** fold this roadmap into `docs/IMPLEMENTATION.md` as §11 (the repo's single
authoritative document), fix its header date, mark MONETISATION §2b done, and update the stale
memory entry that points at the deleted `Revised implementation.md`.
