# Search: where the site stands and what moves it

> **Written 2026-10-02.** Plan and record for organic search. `ROADMAP.md` Phase 1, 3 and 5 are
> the source; this file is the search view of them, kept current as work lands. The owner's half
> is in `OWNER-ACTIONS.md` items 1 and "Distribution".

## 1. Where it stands (checked 2026-10-02)

**Neither Google nor Bing has indexed a single page.** `site:sixseconds.tech` returns nothing on
either, twenty days after launch, and the brand query "six seconds resume" returns other people's
articles about the six-second rule.

**The site is not the reason.** An audit of every sitemap URL, fetched as Googlebot:

| Check                      | Result                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                     | 64/64 return 200; no redirects                                                                                                                        |
| `noindex` / `X-Robots-Tag` | none on any content page                                                                                                                              |
| Canonical                  | every page names itself                                                                                                                               |
| Caching                    | `s-maxage=31536000` on all content pages: prerendered, served as files                                                                                |
| `robots.txt`               | allows everything but `/api/` and `/dashboard`; names the sitemap                                                                                     |
| Structured data            | `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage` on `/`; `Article` + `BreadcrumbList` on examples and guides; `Dataset` on the measurement |
| Response time              | 60–660 ms from India; one cold page at 1.3 s                                                                                                          |
| IndexNow                   | key file served; Bing accepts the ping (HTTP 200)                                                                                                     |

**The reason is discovery.** Google finds a new site through Search Console or through a link
from a page it already crawls. This site has neither: Search Console was never verified, and no
crawled page links here (the GitHub README link is `nofollow`). Bing has been told about every URL
by IndexNow and has still not crawled a domain nothing links to. **No on-page work changes this.**

## 2. The edge — what competitors do not have

Use these in titles, in link pitches and on the pages themselves. Each is true and checkable.

| What                                                                                                                  | Why it matters for search                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Downloads are free, permanently** — PDF, Word, plain text, JSON Resume; no watermark, no account (D13)              | The most common complaint about the category is the paywall at the download. "No sign-up", "free download", "no watermark" are what searchers add to the query |
| **Nothing is uploaded** — the builder, `/check`, the keyword scanner and the bullet checker all run in the browser    | A privacy position nobody in the category can copy without rebuilding                                                                                          |
| **X-Ray** — the text a parser recovers from the exact file you are about to send                                      | Competitors sell a number; this shows its working. Basis of `/check`                                                                                           |
| **Six-Second View** — what a recruiter's first scan reaches on page one of the real PDF                               | Unique, visual, and the brand. Best short-video asset                                                                                                          |
| **Interview tab** — every figure and claim on the resume, with the question it invites                                | Nobody else does this; it is the honest answer to "AI resume writer"                                                                                           |
| **No AI writes anything (D8)**                                                                                        | Every competitor sells an AI writer; this is the opposite position, stated plainly                                                                             |
| **Measured content** — `/guides/two-column-resume-ats`: 36 resumes, two layouts, two readers, raw data as a `Dataset` | Link-worthy: other writers cite numbers they can check                                                                                                         |
| **Every example downloads as Word or PDF** (since 2026-10-02)                                                         | Matches what "resume format" searches in India actually want: the file                                                                                         |

## 3. Which searches, which page

Small, new sites do rank for the long-tail "free, no sign-up" variants: on 2026-10-02 the
results for "free resume builder no sign up" and "free ATS resume checker no sign up" were full of
single-purpose sites a year or two old. Head terms ("resume builder", "resume format") are
12–24-month goals won with links, not pages.

| Search family                                                 | Page                                                    | Since 2026-10-02                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| free resume builder no sign up / free download / no watermark | `/`                                                     | Title "Free ATS resume builder, no sign-up"; description leads with free PDF and Word, no watermark, no paywall |
| truly free resume builder / free without paying               | `/guides/is-any-resume-builder-really-free`             | New guide: where the price hides, and a two-minute check                                                        |
| free ATS resume checker (no sign up)                          | `/check`                                                | 355 → ~1,100 words: what it reads field by field, six questions with `FAQPage`                                  |
| resume keyword scanner / compare resume to job description    | `/resume-keyword-scanner`                               | Unchanged; already ~700 words of method                                                                         |
| `<role>` resume format (India)                                | `/examples/<IN role>`                                   | Title "`<role>` resume format — free Word & PDF"; Word and PDF buttons                                          |
| `<role>` resume example / template (US)                       | `/examples/<role>`                                      | Title "`<role>` resume example — free Word & PDF"; Word and PDF buttons                                         |
| resume format for freshers                                    | `/guides/resume-format-for-freshers` + fresher examples | Fresher examples now download                                                                                   |
| free resume templates word                                    | `/templates`                                            | Already downloads; title locked by `builder.spec.ts`                                                            |
| does a two-column resume work with ATS                        | `/guides/two-column-resume-ats`                         | The measurement; the page most likely to earn links                                                             |

## 4. What is next, in order

**Owner (nothing below matters until the first two are done):**

1. **Verify Search Console** and submit `https://sixseconds.tech/sitemap.xml`; request indexing for
   the URLs listed in `OWNER-ACTIONS.md` item 1. Twenty minutes. Then import into Bing Webmaster
   Tools in one click.
2. **First links.** GitHub "About" box with the website (1 minute); then the drafts in `LAUNCH.md`:
   AlternativeTo, the directories, Show HN, the subreddits, placement cells. Five real links from
   pages Google already crawls will do more than fifty more pages.
3. After two weeks of Search Console data: send me the queries with impressions, and the next
   content batch is written for those rather than for guesses.

**Code and content (in this order):**

1. Re-measure live mobile Lighthouse on `/`, `/check`, an example, a guide (ROADMAP 1.6 "Left").
2. Tool-page questions for `/resume-keyword-scanner` and `/bullet-point-checker`, as `/check` has.
3. Examples, four a batch, chosen from Search Console queries once there are any. Until then the
   ROADMAP Phase 3 lists stand: India — B.Tech/BCA fresher, data entry operator, bank PO, B.Ed
   teacher, diploma engineer; US — paralegal, social worker, phlebotomist, bank teller, forklift
   operator.
4. The two remaining measured guides: PDF vs DOCX parse accuracy; what Word and Canva templates lose
   in extraction. Measured content is what earns links.
5. An "edit this example in the builder" button: the handoff exists (`/check` uses it), but it
   replaces the visitor's current draft, so it needs a "replace your draft?" step first.

## 5. How to tell it is working

- **Indexed pages** — Search Console → Pages. Target: all sitemap URLs within two weeks of
  verification.
- **Brand query** — "six seconds resume" returns this site first.
- **Impressions before clicks** — a new domain shows impressions at positions 30–80 for weeks
  before any clicks. That is progress, not failure.
- **The first-party counter** — `scripts/events.mjs` (RUNBOOK): `view:*`, `src:*`, and the
  funnel's `example:word` / `example:pdf` / `check:read`.

Targets from ROADMAP Part 3 stand: 60+ indexed URLs and 10+ referring domains by week 6; first
page-one long-tail rankings by week 12.
