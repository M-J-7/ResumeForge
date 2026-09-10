# ATS Resume Builder

Build a single-column resume and download it as PDF, DOCX, and plain text. The builder runs
entirely in the browser — no account needed, no server-side rendering of your document, nothing
uploaded. An optional passwordless account syncs resumes between devices; nothing is sent to the
server until you save it there.

**Start from the resume you already have.** Drop a PDF or a Word `.docx` into the builder and it is
parsed into an editable document — in your browser, with nothing uploaded — and the import lands in
a review that says, field by field, how sure the parser is of what it read. Ctrl+Z puts your
previous draft back.

**`/check` — see what a machine reads.** The same extraction, pointed at any resume, with no account
and no signup wall: the text a parser recovers, the fields it finds, and the lines where two
different parsers would disagree about reading order. It describes what was recovered and never
claims what an employer's system will do with it, because nobody can know that.

**Twelve templates, and none of them changes what a parser reads.** They differ in typeface, header
placement, heading style and section order. Every one stays a single column of real text with
standard headings, and a test asserts that switching between them leaves the extracted text
byte-identical — `/templates` shows them as real rendered pages.

**A phrase library and a bullet coach, with no model anywhere.** The library inserts shapes with the
blanks still in them (`Cut ___ from ___ to ___`), so nothing it gives you is a claim you did not
make. The coach decomposes a bullet into action, what, how and outcome, and asks about the part
that is missing — it never writes the sentence. Both are constrained by
[D8](docs/DECISIONS.md), and the whole phrase bank is asserted to pass the app's own lint engine.

**Examples and guides.** [`/examples`](src/lib/examples/roles.ts) publishes eight complete resumes
with the plain text a parser recovers from each as the page body, and
[`/guides`](src/lib/guides/guides.ts) has four written to answer their question rather than to
exist.

## Getting started

```bash
pnpm install
cp .env.example .env   # then set AUTH_SECRET
pnpm db:migrate
pnpm dev
```

Then open <http://localhost:3000>.

`.env.example` documents every variable. Only two matter for local development: `DATABASE_URL` and
`AUTH_SECRET`. With `AUTH_DEV_OUTBOX` set (it is, in the example), sign-in emails are **written to
that directory as JSON** instead of being sent, so the whole magic-link flow works without an email
account. That transport refuses to run under `NODE_ENV=production`; a real deploy needs
`EMAIL_SERVER`.

`predev` and `prebuild` run `scripts/sync-public-fonts.mjs`, which copies the vendored font files
and pdfjs's worker into `public/`. Both are generated and gitignored — the ~2.8MB of fonts lives in
the repository exactly once, under `src/lib/fonts/files/`. **If the preview 404s on a font, run
`pnpm fonts:sync`.**

## Scripts

| Command              | What it does                                                                            |
| -------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`           | Development server                                                                      |
| `pnpm build`         | Production build (standalone output, for Docker)                                        |
| `pnpm verify`        | `typecheck` + `lint` + `test` — run before committing                                   |
| `pnpm test`          | Vitest unit and component suite                                                         |
| `pnpm test:e2e`      | Playwright end-to-end suite (builds and starts the app)                                 |
| `pnpm fonts:fetch`   | Re-vendors the font files from Google Fonts (rarely needed)                             |
| `pnpm fonts:sync`    | Copies fonts and the pdfjs worker into `public/`                                        |
| `pnpm auth:google`   | Asks Google whether the OAuth credentials and redirect URI it has match this deployment |
| `pnpm skills:build`  | Rebuilds `data/skills.json` from O\*NET (needs network; the output is committed)        |
| `pnpm phrases:build` | Rebuilds `data/phrases.json` from O\*NET (needs network; the output is committed)       |

Run `pnpm test:e2e` before trusting anything about the preview. The PDF is generated in a Web
Worker and painted with pdfjs, and pdfjs behaves differently under Node than in a browser — a whole
class of bug there is invisible to the unit suite.

## Deployment

**Vercel cannot host this.** The architecture assumes a persistent filesystem, which Vercel's
ephemeral functions do not provide. Next.js defaults push everyone toward Vercel, so this is worth
stating plainly.

Deploy to a VM with a real block volume — Oracle Cloud Always Free, a Hetzner CX22, Fly.io with a
Fly Volume, or any VPS. `better-sqlite3` is a single writer against a local file, so the host has to
run **one instance on one disk**: no second region, no network filesystem, and no rolling deploy
(which runs two writers by definition). That last rule is why Render and Railway are the wrong shape
here despite offering persistent disks. `docs/RUNBOOK.md` has the details.

**On Oracle Cloud Always Free it is scripted.** `deploy/oracle/` provisions the instance and its
network with Terraform, prepares the image with cloud-init, and starts the stack — including the
iptables rules Oracle's images use to block 80/443 whatever the VCN security list says, which is
the single most common way an Oracle deploy ends up unreachable. What is left is two sign-ups (an
Oracle account and a domain) and one DNS record. Its README is the decided path, not a set of
options.

Anywhere else:

```bash
cp .env.example .env.production   # fill in AUTH_SECRET, AUTH_URL, SITE_DOMAIN, EMAIL_*
docker compose up -d --build
```

Caddy terminates TLS and is the only service with published ports. It gets a Let's Encrypt
certificate for `SITE_DOMAIN` automatically. This is not optional decoration: `AUTH_URL` is an
https origin, so Auth.js issues `__Secure-` cookies that a browser will not send over plain HTTP.

That is the whole first deploy. **There is no migrate step**: the server applies its own pending
migrations on first use, using Prisma's own bookkeeping table and checksums, so `prisma migrate
status` still reports correctly against it. Compose also starts an hourly local snapshot job.

The image is `node:24-bookworm-slim` (Node 20 is end-of-life), multi-stage, non-root, and its
healthcheck touches the database rather than the landing page.

Read [`docs/RUNBOOK.md`](docs/RUNBOOK.md) before going live — environment variables, backups,
restores, and what is defended and how.

## Documentation

| File                     | Contents                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| `docs/IMPLEMENTATION.md` | **What is built, what binds new work, what is next.** Read this first |
| `docs/DECISIONS.md`      | Locked architecture decisions (D1–D14) and why                        |
| `docs/ATTRIBUTION.md`    | Font and data-source licensing                                        |
| `docs/RUNBOOK.md`        | Deploying, environment variables, backup and restore                  |
| `docs/QA.md`             | Manual checks that cannot run here, and what they owe                 |

## Architecture in one paragraph

`lib/resume/` holds the schema and its migration chain. `lib/layout/document.ts` turns a resume into
an ordered list of semantic blocks carrying keep-together hints — the four break rules live there
once, and all three emitters read them. `lib/emit/{pdf,docx,text}/` render those blocks;
`lib/emit/shared/` holds the composition DOCX and TXT must agree on. The preview renders the _same_
PDF blob the download hands over, so the two cannot drift.

`lib/interop/json-resume.ts` maps the document to and from the published JSON Resume schema — the
account export, the builder's import, and the reason leaving is possible.

### Production behaviour worth knowing

Sign-in is rate limited per address and per IP, with the counters in the database so they survive a
restart. Security headers including a CSP are set in `next.config.ts` — `'unsafe-eval'` is absent,
`'wasm-unsafe-eval'` is present because react-pdf lays out text with WebAssembly. Logs are scrubbed
of resume content, addresses, and tokens, and Prisma is configured not to report statement
parameters (which for a resume save is the whole resume).

`server/` is everything an account touches: `db.ts` (SQLite plus the four required pragmas),
`auth/` (Auth.js, passwordless only, with mail delivery behind an injectable transport),
`resumes.ts` and `accounts.ts` (every query scoped by `userId` as an argument, never inferred).

## Claims

This produces the document structure that is most reliably readable across the widest range of
applicant tracking systems. It is not a guarantee that any particular system will parse your resume
correctly, or that you will pass any screen. See `docs/DECISIONS.md` (D14) for why the claim is
phrased that way and not more strongly.
