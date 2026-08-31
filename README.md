# ATS Resume Builder

Build a single-column resume and download it as PDF, DOCX, and plain text. The builder runs
entirely in the browser — no account needed, no server-side rendering of your document, nothing
uploaded. An optional passwordless account syncs resumes between devices; nothing is sent to the
server until you save it there.

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

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm dev`         | Development server                                          |
| `pnpm build`       | Production build (standalone output, for Docker)            |
| `pnpm verify`      | `typecheck` + `lint` + `test` — run before committing       |
| `pnpm test`        | Vitest unit and component suite                             |
| `pnpm test:e2e`    | Playwright end-to-end suite (builds and starts the app)     |
| `pnpm fonts:fetch` | Re-vendors the font files from Google Fonts (rarely needed) |
| `pnpm fonts:sync`  | Copies fonts and the pdfjs worker into `public/`            |

Run `pnpm test:e2e` before trusting anything about the preview. The PDF is generated in a Web
Worker and painted with pdfjs, and pdfjs behaves differently under Node than in a browser — a whole
class of bug there is invisible to the unit suite.

## Deployment

**Vercel cannot host this.** The architecture assumes a persistent filesystem, which Vercel's
ephemeral functions do not provide. Next.js defaults push everyone toward Vercel, so this is worth
stating plainly.

Deploy to anything with a volume — Railway, Render, Fly, or a plain VPS:

```bash
cp .env.example .env.production   # fill in AUTH_SECRET, AUTH_URL, EMAIL_*
docker compose up -d --build
```

That is the whole first deploy. **There is no migrate step**: the server applies its own pending
migrations on first use, using Prisma's own bookkeeping table and checksums, so `prisma migrate
status` still reports correctly against it. Compose also starts an hourly local snapshot job.

The image is `node:24-bookworm-slim` (Node 20 is end-of-life), multi-stage, non-root, and its
healthcheck touches the database rather than the landing page.

Read [`docs/RUNBOOK.md`](docs/RUNBOOK.md) before going live — environment variables, backups,
restores, and what is defended and how.

## Documentation

| File                     | Contents                                               |
| ------------------------ | ------------------------------------------------------ |
| `docs/EXECUTION_PLAN.md` | The full plan: milestones, tasks, acceptance criteria  |
| `docs/PROGRESS.md`       | **What is done and where to pick up.** Read this first |
| `docs/DECISIONS.md`      | Locked architecture decisions (D1–D14) and why         |
| `docs/ATTRIBUTION.md`    | Font and data-source licensing                         |
| `docs/RUNBOOK.md`        | Deploying, environment variables, backup and restore   |
| `docs/QA.md`             | Manual checks that cannot run here, and what they owe  |

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
