# Blockers

> Everything that stops work, in one place, with what would unblock it. Kept
> separate from `IMPLEMENTATION.md` so a blocker is never mistaken for a
> deferred decision: a deferral is a choice we made, a blocker is one we
> cannot make yet.
>
> **Last updated:** 2026-09-10 · Updated in the same commit as the work that
> hits or clears a blocker.

---

## 0. What is waiting on you, and nothing else

Everything that could be built without an account has been. What is left is
three sign-ups and one DNS record, and each is written out with what to paste
where in **`deploy/oracle/README.md`**.

| #   | Yours to do                              | Then                                                 | Status         |
| --- | ---------------------------------------- | ---------------------------------------------------- | -------------- |
| 1   | Merge `launch/six-seconds-resume`        | The instance builds from master, not from a laptop   | **Outstanding** |
| 2   | An Oracle Cloud account, home region     | `terraform apply` — expect to retry for capacity     | **Outstanding** |
| 3   | A domain                                 | One `A` record at the printed IP                     | Done — `sixseconds.tech`, 2026-09-10 |
| 4   | An SMTP provider (Brevo or Resend, free) | `sudo ./deploy/oracle/bootstrap.sh`, twice           | **Outstanding** |

**Step 1 is not a formality.** `origin/master` is still `P1: project
foundation` — the skeleton. `cloud-init.yaml` clones the default branch and
`deploy.sh` runs `git reset --hard origin/master`, so deploying before the
merge builds an empty project and serves it over TLS with a valid
certificate: a deployment that looks entirely successful and contains no
product.

The second run of `bootstrap.sh` is the deploy. The first writes
`.env.production` with a generated `AUTH_SECRET`, tells you which four lines to
fill in, and stops — deliberately, because a stack that starts on the wrong
hostname burns Let's Encrypt attempts against a five-a-week limit.

**Not required, and please do not:** `pnpm enhance:fetch`. The QA §11 measured
pass ran that model in a browser for the first time on 2026-09-10 and it does
not produce cover-letter prose. Without the weights the app says so and the
deterministic Recompose is unaffected. See `docs/QA.md` §11.

---

## 1. Blocking nothing right now

**P31–P37 are all delivered**, and none of them was blocked by anything below.
That was the bet the sequencing made, and it held: every one of those packages
improves the product whether or not it is public. What the blockers cost is
_feedback_, not progress — and now that the roadmap is complete, feedback is
the only thing left that would tell us what to build next.

Since 2026-09-10 B1 is no longer "find a host and work out how to deploy to
it" either: the provisioning is scripted and validated, and the arm64 image is
built in CI on every push to master. What remains of it is the table above.

---

## 2. External blockers

Each needs something bought, registered or physically present. None is a code
problem, and none has a workaround worth building.

| #      | Blocked                                      | Needs                                                                                                                                                                    | What is already done                                                                                                                                                                                    |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** | **P17 — deploy**                             | An Oracle Cloud account and a **registrable** domain. Nothing else — the provisioning is scripted (`deploy/oracle/`) and the arm64 image is verified in CI               | All of it but the two sign-ups: `deploy/oracle/{main.tf,cloud-init.yaml,bootstrap.sh,deploy.sh,README.md}`, `Caddyfile`, the Caddy service, `.env.example`, `RUNBOOK.md`, and the `docker-arm64` CI job |
| **B2** | **P18 — off-site backups**                   | An S3-compatible bucket plus OCI **Customer Secret Keys** — not API signing keys                                                                                         | `litestream.yml`, the service in `docker-compose.yml`, `scripts/backup.mjs`                                                                                                                             |
| **B3** | **P20 — live Google sign-in**                | The same registrable domain as B1. Google rejects redirect URIs whose host is on the Public Suffix List, so `*.duckdns.org`, `*.sslip.io` and `*.nip.io` are all refused | The whole code path, plus `pnpm auth:google` as a pre-flight. Magic-link email covers authentication on its own, so this never blocks launch                                                            |
| **B4** | **P30 — manual QA, 4 checks**                | Word / LibreOffice / Google Docs · a real phone at 390px · a Google consent screen · ten real job postings                                                               | `QA.md` holds each checklist; the automatable parts are already in the two suites                                                                                                                       |
| **B5** | **P36 · P31-A4 — return on the SEO surface** | A live origin that has been indexed. Not a build blocker — the pages are built and tested; what is blocked is the traffic                                                | All of P36 and `/check`. `sitemap.ts` and `robots.ts` read the origin at runtime, so nothing changes at deploy time                                                                                     |
| **B7** | **P36 — the Lighthouse ≥ 90 acceptance**     | A deployed origin. Lighthouse against `localhost` measures a machine with no network latency, no TLS handshake and no CDN — a number that would pass and mean nothing    | The structural half is asserted instead: every content route renders with `javaScriptEnabled: false`, and axe is clean on four of them                                                                  |
| ~~**B6**~~ | ~~**The product name (P37)**~~ **Resolved 2026-09-10** | Nothing. The name is **Six Seconds Resume** and `sixsecondsresume.com` was verified unregistered on the day it was chosen; registering it is now part of B1 | `src/lib/product.ts`, the two PDF constants, `DEFAULT_MAIL_FROM`, the DOCX creator fallback and the two `builder.spec.ts` title assertions all carry it; see below |

### B1 in detail — what is left, after 2026-09-10

**Everything that does not need an account is done.** B1 used to be "find a
host and work out how to deploy to it". It is now two sign-ups and a wait:

| Step                              | Who      | Notes                                                                                     |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Oracle Cloud account, home region | **You**  | The region cannot be changed later and decides how hard step 3 is                         |
| A registrable domain              | ~~**You**~~ | **Done.** `sixseconds.tech`, registered 2026-09-10. Registrable, so not on the Public Suffix List — which is what keeps B3 (Google sign-in) reachable |
| `terraform apply`                 | Scripted | `Out of host capacity` is the normal first outcome; the README has the retry loop         |
| DNS A record                      | **You**  | One record. `bootstrap.sh` refuses to start until it resolves — Let's Encrypt allows five |
|                                   |          | failed attempts per hostname per week                                                     |
| SMTP provider                     | **You**  | Brevo (300/day) or Resend (3,000/month); both plain SMTP, so the app does not change      |
| `bootstrap.sh`                    | Scripted | Generates `AUTH_SECRET` on the box, checks DNS, builds, starts, waits for health          |

**The arm64 verification P17 asked for is now automatic.** `IMPLEMENTATION.md`
required `docker buildx build --platform linux/arm64` before provisioning,
because `better-sqlite3` compiles from source and Ampere is arm64. That is a
`docker-arm64` job in CI on every push to master rather than a step somebody
has to remember — kept off pull requests, where twenty minutes under QEMU
would make the fast checks useless.

**The Oracle-specific trap is handled in both places it has to be.** The VCN
security list opens 80/443, and so does the instance's own iptables — Oracle's
images ship rules that accept 22 and reject the rest regardless of the
security list, and an instance with only the first half refuses HTTP by
dropping the connection, which looks exactly like a DNS mistake.

### B6 in detail — the product name, resolved 2026-09-10

**The name is `Six Seconds Resume`.** A recruiter spends roughly six seconds on
a resume before deciding, and every layout decision this codebase already made
— one column, no decoration, parseable by machine first — exists to survive
that. The name states the product's argument instead of its category, which
`"ATS Resume Builder"` never did.

"Resume" is kept in the name on purpose: it is the only search keyword the
brand carries, and the metadata template in `src/app/layout.tsx` puts it in
every page title for free.

`trust-signals.test.ts` asserts that no file under `src/app` or `src/components`
renders the string, which is what kept this to the one-line change
`src/lib/product.ts` always promised:

```ts
export const PRODUCT_NAME = "Six Seconds Resume";
```

Chosen against verified registry data rather than taste alone: every bare-word
candidate was already registered (`yespile`, `faircopy`, `throughline`,
`colophon`, `verbatim`, `legible`, `firstpass`, `tabstop` …), and
`sixsecondsresume.com`, `sixsecondscv.com`, `thesixseconds.com` and
`sixsecondspage.com` were all unregistered on 2026-09-10. **Registering one is
still owed** and now belongs to B1.

`SITE_NAME` reads from it, the metadata template reads from `SITE_NAME`, and
the header reads from `PRODUCT_NAME`. **Three** literals elsewhere carried the
old string and were updated with it — this file previously said two and missed
one:

| Literal                          | File                            | Why it is a literal                                                                     |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `PDF_PRODUCER` / `PDF_CREATOR`   | `src/lib/emit/pdf/ResumePdf.tsx` | Pinned for byte-determinism. They must be _fixed_, not match the brand — importing `PRODUCT_NAME` would make a future rename change exported PDF bytes |
| `DEFAULT_MAIL_FROM`              | `src/server/auth/mail.ts`        | Fallback when `EMAIL_FROM` is unset                                                      |
| the DOCX `creator` fallback      | `src/lib/emit/docx/render.ts`    | The one this list used to miss                                                           |

The two `builder.spec.ts` title assertions were updated in the same commit, as
were `playwright.config.ts`, `.env.example`, `README.md` and the locked-selector
row in `IMPLEMENTATION.md` §2.3. The PDF layout snapshots under
`src/lib/emit/pdf/__snapshots__/` are text, not bytes, and do not contain the
name — so nothing needed regenerating.

### Why B1 and B3 are one blocker wearing two hats

Google will not accept a redirect URI on a Public Suffix List host, which
rules out every free dynamic-DNS hostname. So "get a hostname" and "get a
hostname Google will accept" are the same errand, and the free-hostname
shortcut that would unblock B1 alone does not exist for B3.

---

## 3. Blockers hit during implementation, and how they were resolved

Recorded because each one cost a decision that is now load-bearing, and the
next person to touch these files needs the reasoning, not the outcome.

### P31 — resume import

| Blocker                                                                                                                                                                                   | Resolution                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `extractDocx` uses `mammoth` and `Buffer`, both Node-only, so the extraction layer could not run in a browser at all — and import has to, or the file gets uploaded                       | Split the layer. `src/lib/xray/extract-browser.ts` holds everything browser-safe; `extract.ts` re-exports it and keeps only `extractDocx`. No existing import or test changed. `fflate` moved from `devDependencies` to `dependencies`                                                                                                     |
| Our DOCX sets an entry's date at a right tab stop, and `extractDocxStructure` ignored `<w:tab/>` — so the heading came back as `"Senior Backend EngineerMar 2022 – Present"`, unparseable | Tabs and breaks now contribute a space. A strict improvement; the existing X-Ray assertions are unaffected because they only name `Heading1` lines, which are single runs                                                                                                                                                                  |
| Two file inputs on `/builder` would make `input[type="file"]` ambiguous — a locked selector in `IMPLEMENTATION.md` §2.3, asserted by `e2e/builder.spec.ts`                                | One input for all three formats, dispatched by extension. `ImportJsonResume.tsx` was folded into `ImportResumeFile.tsx` with its reasoning intact. Better product besides: the visitor no longer classifies their own file before the app will read it                                                                                     |
| `/check` has **no ground truth** — the visitor's file was written by someone else — so `XRayPanel`'s scorecard would grade a stranger's resume against whatever draft is in this browser  | `/check` shows recovery and disagreement without a score. Reusing the panel wholesale would have produced a confident-looking percentage that means nothing, which is the exact failure D14 exists to prevent. The recovery display is shared with the builder's import review, so there is still one definition of "here is what we read" |
| Handing the parsed resume from `/check` to `/builder` — a resume must not go in a URL, a cookie, or through the server                                                                    | `sessionStorage`, one key, read once and cleared (`src/lib/import/handoff.ts`). Scoped to the tab, never transmitted. `e2e/import.spec.ts` asserts the query string stays empty                                                                                                                                                            |
| `03/04/2023` is March in one hemisphere and April in the other, and nothing in a resume disambiguates it                                                                                  | Refuse to guess: keep the year, drop the month, report the field at **low** confidence with the reason. Silently picking a convention would move somebody's start date by a month and never say so                                                                                                                                         |
| A short mixed-case line like `Author` or `Team Lead` passes every heading shape test there is, and splitting a section on it moves the rest of an entry somewhere it never was            | Heading detection returns a _strength_. Only a **strong** heading — capitals, or a trailing colon — may name a section we do not recognise; a weak one has to classify to a known type. See the docblock in `src/lib/import/headings.ts`                                                                                                   |
| A third-party resume cannot be committed as a test fixture — republishing someone else's document is the same copyright problem `QA.md` already refuses for job postings                  | A **structural** fixture: the awkward layout written as lines, exercised through `parseResumeLines`. The real-file check moves to `QA.md` as a manual step (see B4)                                                                                                                                                                        |

---

## 3a. Found while verifying P31, in code P31 does not own

Recorded rather than quietly fixed or quietly ignored. Both were failing
before P31 and neither is caused by it.

| Symptom                                                                                                                                                    | Diagnosis and status                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/match-and-letters.spec.ts` — "a saved letter reopens with identical text" failed on every attempt, including retries                                  | **Real product defect, fixed.** Saving a new letter called `router.replace("/letters/<id>")`. `/letters/new` and `/letters/<id>` are the same dynamic segment with a different param, so the navigation remounted `LetterEditor` and destroyed the "Saved as …" state set the line before — the user clicked Save and got no confirmation at all. Now uses the native History API, which Next integrates with its own router for exactly this |
| `e2e/auth.spec.ts` — intermittent failures, and 13 further tests reported as "did not run"                                                                 | **Flaky under load, not broken.** `auth.spec.ts` sets `test.describe.configure({ mode: "serial" })`, so one failure skips the rest of the file — which is why a single flake reads as a suite-wide collapse. Passes on `--retries=2`, which is what CI already runs. Left alone: making it robust means a shared sign-in fixture, which is a package of its own                                                                               |
| Every E2E run silently tested a **`next dev` server left running from a previous session**, because `playwright.config.ts` sets `reuseExistingServer: !CI` | **Environmental.** `/letters/new` 500s under that dev server with a Jest-worker crash unrelated to the code under test. Killing the stale process on port 3000 changed the result from 29 passed / 3 failed to 34 passed / 2 failed with nothing else altered. Now landmine 24                                                                                                                                                                |

---

## 4. Not blockers

Listed because they get mistaken for blockers.

- **Monetization.** Constrained by D13 and deliberately unanswered until there
  are users to ask. Not blocked — deferred, and the shape of the answer is
  already narrowed.
- **Photo support and two-column layouts.** Decisions, not gaps. They
  contradict the argument the landing page makes and `schema.ts` documents.
- **The rest of the M4 backlog.** A ranked list to pull from against real
  feedback, not a sequence that is stalled.
