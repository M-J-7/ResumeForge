# Six Seconds Resume — Monetisation & Go-To-Market Plan

## Context

`sixseconds.tech` is live, rigorously engineered (~1,868 unit tests, 85 e2e, zero TODOs),
and **has no mechanism by which money can arrive**: no billing code, no pricing page, no
email list, no analytics, and no account requirement. Running cost is ~$0/yr plus a domain,
so the bar for "profitable" is low — but the bar for "any revenue at all" is currently
infinite.

Every locked decision traded monetisation for trust, and those trades are now assets in a
market that has turned against both incumbent models:

- **D13** (downloads free forever) forecloses pay-to-download — the model now facing a civil
  suit against BOLD (Zety/LiveCareer/ResumeGenius/Monster) over $1.95 trials auto-renewing
  at $25.95 per 4 weeks, 13× a year.
- **D8** (no LLM) forecloses "AI resume builder" for consumers, but makes the product
  procurement-ready for institutions under Colorado's AI Act (Feb 2026) and Illinois HB 3773
  (Jan 2026), which require disclosure of AI in consequential employment decisions.
- **D14** (no ATS-guarantee claims) ages extremely well: 2026 coverage now calls third-party
  "ATS scores" invented marketing metrics, and 92% of recruiters confirm ATS do not auto-reject.

Meanwhile the acquisition channel the docs worry about being behind on is collapsing anyway:
Teal's organic traffic is down ~208K YoY to Google AI Overviews, which now appear on 47–64%
of queries. Out-contenting BOLD's 500+ example pages solo is fighting the last war.

**Decisions taken with the user (2026-09-12):** hold D13 absolutely; target $500–1,000/mo
within 12 months; 4–6 non-coding hours/week available for outreach; first-party cookieless
analytics approved.

**Intended outcome:** a free consumer product that funds itself as a credibility engine, a
one-time Pass for workflow depth, and B2B licensing of the client-side parser as the real
revenue line.

---

## The strategy in one paragraph

Free forever for the artifact (every export, for everyone, no account — D13 untouched).
Paid for **workflow across many applications**: multiple stored resumes, version history,
saved job targets, cover letters beyond a free allowance. Sold as a **one-time 12-month Pass
with no auto-renew**, not a subscription — because the audience is the most cash-constrained
cohort in a decade (entry-level postings −35% since 2023, grad unemployment 5.6%,
underemployment 42%), a resume tool has a structurally brutal 1–3 month natural lifespan so
subscription churn is unavoidable, and "no auto-renew, ever" is a *marketable* claim that
attacks the largest competitor's live legal vulnerability. The real revenue engine is
**licensing the X-Ray parser as an embeddable widget** — it runs entirely client-side, so it
costs nothing to host for someone else, which is the only product shape a 1/8-OCPU box can
sell at scale.

### Pricing

| Tier | Price | Contains |
|---|---|---|
| **Free** (no account) | $0 | Full builder, all 4 exports, `/check`, X-Ray, Match, 12 templates, guest IndexedDB storage. Unchanged forever. |
| **Free** (account) | $0 | 1 stored+synced resume, 3 saved cover letters, 1 saved job target |
| **Pass** | **$19, once, 12 months, no auto-renew** | Unlimited stored resumes, version history with labels + restore, unlimited cover letters, saved JD library. At month 11: one email saying it expires, your data stays, exports stay free. |
| **Check Widget** | **$49/mo or $490/yr per site** | Embeddable client-side `/check`. Your branding, their domain. Zero infra cost to us. |
| **Cohort licence** (later) | $1,500–6,000/yr | Bootcamps / .edu career services. Pass for N students + a parse-report export. |

**Use a Merchant of Record — Paddle or Lemon Squeezy — not raw Stripe.** You are selling
globally from India: an MoR handles EU/UK VAT, US sales tax, and the FEMA/export-documentation
burden that makes raw Stripe painful for an Indian sole proprietor. This single choice saves
more time than any feature in this plan. Add Razorpay later only if domestic volume justifies it.

### Positioning

The category's two positions are now liabilities. Take the third:

> **The only resume tool that shows you what machines actually read — and never writes a word for you.**

Two claims nobody else can make, both already true in the code:
1. **X-Ray** ([src/lib/xray/](src/lib/xray/)) re-parses the exact file you are about to download
   with two independent extraction strategies and grades field recovery. Evidence, not a score.
2. **Provenance** — [compose.test.ts](src/lib/cover-letter/compose.test.ts) proves every letter
   sentence is verbatim from the user's own resume. In a market saturated with AI slop that
   recruiters now recognise on sight, "nothing here was invented" is becoming premium.

Do **not** pivot to AI. Do **not** add a 0–100 ATS badge. Both destroy the only moat.

---

## Phase 0 — Stop the bleeding (week 1, no revenue work)

Nothing below earns money; all of it prevents money being lost or the site dying under the
first traffic you get.

1. **Fix magic-link delivery.** Brevo rewrites every link through its click tracker; links are
   single-use with a 15-min TTL, so a corporate mail scanner that prefetches burns the token
   before the user clicks. Account creation is your only conversion event and it may be failing
   silently. `BLOCKERS.md` names the fix: switch `EMAIL_SERVER` to Resend. One line.
2. **Correct the false trust signal.** [trust-signals.ts:139-144](src/lib/trust-signals.ts#L139-L144)
   claims "Optional AI enhancement runs on your device" under a heading that says these are
   checkable. It is shipped off. Either remove the row or rewrite it as what actually happened
   ("we built it, measured it, and switched it off — here is why"), which is a *stronger* signal
   than the original. Update `trust-signals.test.ts`.
3. **Merge the five unmerged branches** (`offsite-backups`, `fix-backup-image`,
   `fix-ci-concurrency`, `deploy-on-e2-micro`, `launch/six-seconds-resume`) plus the 32 dirty
   files on `composer-evidence-and-enhance-evaluation`. The deployed site is running `master`
   and a meaningful amount of shipped-quality work is not on it.
4. **Fix [deploy/oracle/deploy.sh](deploy/oracle/deploy.sh).** It runs `git reset --hard origin/master`
   while the Litestream config exists *only on the instance* — the next deploy silently ends
   off-site replication. It also runs `docker compose build app backup`, which the micro cannot do.
   Commit [litestream.yml](litestream.yml), drop the build step, pull from ghcr.io only.
5. **Kill `force-dynamic` on content routes.** [src/app/sitemap.ts](src/app/sitemap.ts) explains
   the origin-from-env reasoning, but `/`, `/guides/*`, `/examples/*`, `/templates`, `/privacy`,
   `/terms` being SSR'd per request on 1/8 OCPU means the first Reddit thread takes you down.
   Move the origin to a build-time env var and switch these to static/ISR. Keep `/builder`,
   `/dashboard`, `/letters`, `sitemap.ts` and `robots.ts` dynamic.
6. **Wire `/api/health` to an uptime monitor** (UptimeRobot free). Oracle reclaims Always Free
   instances idle under 20% CPU *and* network *and* memory over 7 days — the monitor is both
   observability and insurance.
7. **Run the 10 never-run manual QA checks** in [docs/QA.md](docs/QA.md). Check #1 — "does the
   DOCX open cleanly in Word/LibreOffice/Google Docs" — is the ATS-safety claim itself, and it
   has never been verified against a real word processor. Do not promote the product until it is.

---

## Phase 1 — See the funnel (week 2)

You are currently blind. Everything after this depends on it.

> **Status, 2026-09-30: the counter is built** (`src/lib/events.ts`, `src/server/events.ts`,
> `src/app/api/e/route.ts`), with two departures from the list below. Counts are batched in
> memory and written every five minutes rather than per event — a write per page view would keep
> Litestream uploading continuously and spend the bucket's 50,000-request month. And the event
> names are namespaced (`export:pdf`, `view:/check`, `src:reddit`) rather than these, with
> page views and referrer sources counted too. `checkout_started` waits for a checkout. The email
> capture on `/check` is not built.

- **`POST /api/e`** — same-origin event endpoint. `connect-src 'self'` in
  [next.config.ts](next.config.ts) **already permits this**; no CSP change is needed, contrary
  to what the docs assume. No cookies, no session id, no IP, no resume content — increment a
  counter row keyed by `(eventName, dayBucket)` in SQLite. New `EventCount` model.
- **Events to count:** `landing_view`, `builder_open`, `builder_step_reached:{n}`,
  `export_click:{pdf|docx|txt|json}`, `check_used`, `check_handoff_to_builder`,
  `signin_started`, `signin_completed`, `letter_composed`, `pricing_view`, `checkout_started`.
- **Privacy page** ([src/app/privacy/page.tsx](src/app/privacy/page.tsx)): document this as a
  strengthening, not a walk-back. The literal claim is "no third-party analytics or advertising
  scripts" — a first-party aggregate counter does not breach it. Say exactly what is counted and
  what is not. Add an e2e assertion that no event payload contains resume content.
- **Email capture, honestly done.** One opt-in on the `/check` result: *"Email me this parse
  report"* — genuine value, genuinely opt-in, and it builds the launch list you currently do not
  have. Store address + consent timestamp only.

---

## Phase 2 — Build the thing people pay for (weeks 3–6)

**2a. Version history** — the cheapest paid feature you have, because the schema is already
designed for it. `ResumeVersion` ([prisma/schema.prisma:87](prisma/schema.prisma#L87)) has
`content`, `label String?` (comment: `"Sent to Google, 12 Aug"`), `createdAt`, and an index —
and **nothing in product code ever writes to it**. Build: snapshot-on-export and snapshot-on-demand,
a labelled timeline in the dashboard, restore (as one undo step, reusing the store's existing
snapshot mechanism in [src/store/resume.ts](src/store/resume.ts)), and a text diff between versions.
`ScoreCheck` and `ParseCheck` are equally unused — writing `ParseCheck` gives you "your parse
recovery over time," which is a Pass feature no competitor can copy.

> **Status, 2026-09-28:** the four defects below were fixed in code on 2026-09-09 (IMPLEMENTATION.md §10, Tier 1 and 2). What remains is Tier 3 — persisting tone, angle and availability with the letter (schema v2) — tracked as F11 in `ROADMAP.md`.

**2b. Fix the cover-letter flow before charging for it.** [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) §10
records four known defects on exactly the flow D13 names as the monetisation candidate:
reopening a saved letter drops tone/angle/recipient; `?job=` does not prefill company/role;
a pasted JD is never saved; an orphaned-preposition bug at
[compose.ts:274-282](src/lib/cover-letter/compose.ts#L274-L282). Persist tone/angle/angle/recipient
into the `CoverLetterDocument` schema (bump to v3 via the existing `schemaVersion` migration chain
per D10).

**2c. Entitlements + checkout.**
- New `Entitlement` model: `userId`, `kind` ("pass"), `grantedAt`, `expiresAt`, `provider`,
  `providerRef`. No plan matrix, no proration, no dunning — one boolean-ish check.
- `src/server/entitlements.ts` — `hasPass(userId)`, called by the server actions in
  [src/app/dashboard/actions.ts](src/app/dashboard/actions.ts) and
  [src/app/letters/actions.ts](src/app/letters/actions.ts). Enforce counts at the data layer
  (currently only string-length caps exist in [src/server/resumes.ts](src/server/resumes.ts) and
  [src/server/cover-letters.ts](src/server/cover-letters.ts)).
- MoR webhook route → grant entitlement. Verify signature; idempotent on `providerRef`.
- **Guest mode stays unlimited and local.** Free-tier counts apply only to *server-stored* items.
  This keeps D6 and D13 both intact and is the honest framing: you are paying for us to keep
  things for you, not for your own work.

**2d. `/pricing` page.** Lead with what is free and *why it will stay free* — link D13 the way
the trust page does. State "one payment, no auto-renew, no card stored" as the headline feature,
not a footnote. Add `Offer` JSON-LD; update [src/lib/structured-data.ts](src/lib/structured-data.ts)
so the landing `SoftwareApplication` shows a free offer *and* a paid one rather than the current
bare `price: "0"` (which becomes inaccurate the moment you charge).

---

## Phase 3 — Widen the market, package the asset (weeks 6–10)

**3a. Skill vocabulary beyond tech — the single biggest revenue-blocking gap.**
[docs/QA.md](docs/QA.md) records that of ten measured roles, **nurse, teacher and administrative
assistant match nothing**. Healthcare, education and admin are the three largest resume-writing
populations alive. `data/skills.json` has 7,432 terms and is technology-centric. Extend the O*NET
extraction in [src/lib/skills/](src/lib/skills/) to cover healthcare, education, admin/ops,
skilled trades, finance/accounting and retail/hospitality; extend the 59 phrase scaffolds in
[src/lib/phrases/](src/lib/phrases/) with non-technical achievement shapes. This is data work,
not research, and it roughly quadruples the addressable audience. Update the `skillTerms`
trust-signal constant.

**3b. Package `/check` as an embeddable widget.** Your highest-value latent asset. The extractor
([src/lib/xray/](src/lib/xray/)) and [CheckTool.tsx](src/components/check/CheckTool.tsx) run
entirely in the browser — so a licensee hosts a `<script>` tag and *you pay nothing per use*.
This is the only product shape a 1 GB box can sell at scale. Ship: a standalone bundle, an
`/embed` route, a licence-key check (domain allowlist, fail-open with a "powered by" badge), and
a `/for-sites` sales page. Sell to niche job boards, recruiting agencies (actively seeking
visitor-engagement tools per 2026 recruitment-SEO coverage), bootcamps, and career coaches with
websites.

---

## Phase 4 — Promotion (starts week 2, runs continuously; 4–6 hrs/week)

**The flagship asset: a public, reproducible ATS Parse Report.** You own instrumentation nobody
else has. Run real resumes — including exports from Zety, Canva, Teal, FlowCV and the popular
LaTeX templates — through X-Ray and publish, with methodology and raw data, what survives
extraction and what does not. This is original research, it is link-worthy, it is exactly the
shape of thing AI Overviews cite, it costs you zero marginal compute, and it is the single
highest-ROI marketing action available to this codebase. Re-run and re-publish quarterly.

Channels, in priority order:

1. **Hacker News — one "Show HN".** Genuinely HN-shaped: local-first, no LLM, the preview *is*
   the PDF blob, 1,868 tests, Litestream on a free tier, an AI feature built and deliberately
   switched off after measurement. Lead with the engineering, not the product. **Only after
   Phase 0 is complete** — HN will click the trust page and check the claims.
2. **Reddit, participation-first.** r/resumes, r/EngineeringResumes (high bar, tool-tolerant when
   genuinely useful), r/cscareerquestions, r/jobs, r/recruitinghell, r/careerguidance. 58% of
   subreddits ban or gate self-promo, so answer 9 resume questions for every link. `/check` is the
   perfect share: free, no signup, no upload, and it answers the single most-asked question in
   those subs with evidence.
3. **Career-coach partnerships — your B2B beachhead.** Faster than .edu (weeks, not 6–18 months).
   ~20 warm LinkedIn/email conversations a month at 4–6 hrs/week. Two offers: the Check Widget for
   their site, and Pass codes to bundle into their packages. Precedent exists — competing tools run
   40% recurring affiliate programmes aimed precisely at coaches, HR consultants and bootcamps.
4. **Short-form video.** 22.1% of Gen Z now use TikTok as a primary job-search tool, edging LinkedIn
   at 20.8%. X-Ray is inherently visual: "here is your resume / here is what the machine actually
   read." One format, posted to TikTok + Shorts + Reels. Zero production cost.
5. **.edu career services — start seeding now, expect revenue in year 2.** VMock/Quinncia territory.
   Your pitch is the one they cannot get elsewhere: *the student's data never leaves their browser,
   and no model touches it* — which makes the Colorado/Illinois disclosure question trivially
   answerable and the privacy review short. Offer free cohort pilots to build references.

**SEO: go deep, not wide.** You have ~26 URLs against a competitor's 500+; do not chase that.
Write 8–12 genuinely definitive pages on questions AI Overviews must cite a source for
("does a two-column resume break ATS parsing — measured", "PDF vs DOCX parse accuracy — measured"),
each backed by your own parse data. Your existing JSON-LD ([src/lib/structured-data.ts](src/lib/structured-data.ts))
already emits `Article` and `FAQPage`, which is what citation surfaces read.

### Paid advertising: not yet, and then only one narrow way

**No paid ads until Phase 2 ships and you have 90 days of funnel data.** Average Google Ads CPC
is $5.42 and personal-services CPC rose 23.4% in 2026 as AI Overviews pushed advertisers to paid.
Bidding head terms like "resume builder" against BOLD's budgets, with a free product and no
measured LTV, is setting money on fire.

When you do test, cap it at **$200/month** and bid **only competitor-frustration long-tail**, which
is cheap, high-intent, and answered truthfully by your actual landing page:

- "zety cancel subscription", "how to cancel resume genius"
- "resume builder without subscription", "free resume download no watermark"
- "resume builder that doesn't charge to download"

Kill the test at 60 days unless CAC < $10 against a $19 Pass.

---

## Priorities, ranked

1. Phase 0 items 1, 2 and 4 — sign-in may be broken, a marketing claim is false, and the next
   deploy ends your backups. Nothing else matters until these are done.
2. Phase 1 analytics — you cannot improve an unmeasured funnel.
3. Phase 2b (cover-letter defects) before 2a (version history) before 2c (billing).
4. Phase 3a (skill vocabulary) — biggest single TAM unlock in the codebase.
5. The ATS Parse Report — start writing it during Phase 1; it takes longest to compound.
6. Phase 3b (widget) — highest revenue-per-effort, but needs the credibility Phase 4 builds.

## Explicitly rejected

- **Paywalling downloads** — D13, publicly claimed, and the model in litigation.
- **Adding a hosted LLM** — destroys D8, the procurement story, and the only durable moat.
- **Charging for templates** — [templates.ts](src/lib/resume/templates.ts) is tested to produce
  byte-identical extracted text across heading styles. They are a perception feature. Charging
  for them would be the exact dishonesty the product is built against.
- **Display advertising** — contradicts the privacy page, the CSP, and would earn pennies.
- **Third-party affiliate links** — "no third-party anything" is load-bearing; the revenue does
  not justify the claim loss.
- **A monthly subscription** — see strategy paragraph.

## Honest expectations

- B2C Pass at realistic conversion (0.5–1% of visitors, not the 2% founders assume): **$100–400/mo**
  at 10–20k monthly visitors by month 12.
- Two to four Check Widget licences at $490/yr plus one cohort pilot converting: **$1,500–4,000/yr**.
- **Combined, the $500–1,000/mo target is reachable by month 10–14, and depends far more on the
  Parse Report + coach outreach landing than on any feature in Phase 2.**
- Reference points: 40% of indie hackers who publish numbers are under $1k MRR; $0→$10k MRR
  typically takes 12–36 months. Jobright hit $5M ARR with 9 people — but with VC funding, 2M users
  and an AI auto-apply product you have deliberately chosen not to build.

## Verification

- **Phase 0:** `pnpm verify` green; `git log master` contains all five branches; deploy to the
  live instance and confirm Litestream still replicating (`docs/RUNBOOK.md` restore rehearsal);
  request a magic link to a corporate (Outlook/Google Workspace) address and confirm it still
  works after the mail scanner has seen it; Lighthouse ≥ 90 against `sixseconds.tech` (the B5/B7
  acceptance criterion, now unblocked by a live origin); all 10 QA.md manual checks recorded.
- **Phase 1:** new e2e spec asserting `/api/e` payloads carry no resume content and set no cookie;
  visit the site and confirm counters increment; privacy page updated.
- **Phase 2:** unit tests for `hasPass` gating in each server action; e2e covering free-tier limit →
  pricing page → webhook grant → limit lifted; a test asserting guest/IndexedDB mode is never gated;
  cover-letter round-trip test (save → reopen → tone/angle/recipient intact) as a regression guard
  on the v2→v3 schema migration.
- **Phase 3:** extend the existing ten-role skill-matching measurement in QA.md to ~30 roles across
  six sectors; assert nurse, teacher and administrative assistant now match. Widget: e2e loading
  `/embed` from a foreign origin and confirming the parse runs with no network request carrying
  file content.
