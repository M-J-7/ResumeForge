# ATS Resume Builder

Build a single-column resume and download it as PDF, DOCX, and plain text. Runs entirely in the
browser: no account, no server-side rendering of your document, and nothing uploaded.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

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

Deploy the Docker image to a VM with a persistent volume — Railway, Render, Fly, or a plain VPS all
work:

```bash
docker build -t ats-resume-builder .
docker run -p 3000:3000 ats-resume-builder
```

The image is `node:20-bookworm-slim`, multi-stage, and runs as a non-root user.

## Documentation

| File                     | Contents                                               |
| ------------------------ | ------------------------------------------------------ |
| `docs/EXECUTION_PLAN.md` | The full plan: milestones, tasks, acceptance criteria  |
| `docs/PROGRESS.md`       | **What is done and where to pick up.** Read this first |
| `docs/DECISIONS.md`      | Locked architecture decisions (D1–D14) and why         |
| `docs/ATTRIBUTION.md`    | Font and data-source licensing                         |

## Architecture in one paragraph

`lib/resume/` holds the schema and its migration chain. `lib/layout/document.ts` turns a resume into
an ordered list of semantic blocks carrying keep-together hints — the four break rules live there
once, and all three emitters read them. `lib/emit/{pdf,docx,text}/` render those blocks;
`lib/emit/shared/` holds the composition DOCX and TXT must agree on. The preview renders the _same_
PDF blob the download hands over, so the two cannot drift.

## Claims

This produces the document structure that is most reliably readable across the widest range of
applicant tracking systems. It is not a guarantee that any particular system will parse your resume
correctly, or that you will pass any screen. See `docs/DECISIONS.md` (D14) for why the claim is
phrased that way and not more strongly.
