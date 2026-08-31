# QA

Automated coverage lives in the test suites; this file records the checks that
**cannot** be automated in this environment, who still owes them, and the result
when they are done.

M0-T14 requires a manual pass before launch. Two of its acceptance criteria are
listed as outstanding below — they are not optional, and M0 is not "shipped"
until they are recorded here with a date and an outcome. M2 adds three more,
all needing an environment this one does not have: a Google Cloud project, a
Docker host, and an S3-compatible bucket.

---

## What CI already proves

Run by `pnpm verify` and `pnpm test:e2e` on every push.

| Check                                                                    | Where                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| Schema round-trip, migration chain                                       | `src/lib/resume/*.test.ts`                                |
| Glyph coverage across all font pairs                                     | `src/lib/fonts/charset.test.ts`                           |
| Golden extracted text, 7 fixtures                                        | `src/lib/emit/pdf/render.test.tsx`                        |
| Determinism (stable fingerprint and byte length across renders)          | `src/lib/emit/pdf/render.test.tsx`                        |
| Pagination invariants, 24 seeded random documents                        | `src/lib/emit/pdf/pagination.test.tsx`                    |
| No overlapping lines, no margin overflow, all fixtures and font pairs    | `src/lib/emit/pdf/render.test.tsx`                        |
| DOCX structure: named styles, native numbering, no tables/images/headers | `src/lib/emit/docx/render.test.ts`                        |
| DOCX ↔ TXT word-for-word parity                                          | `src/lib/emit/docx/render.test.ts`                        |
| Page count agrees with pdfjs                                             | `src/lib/pdf/page-count.test.ts`                          |
| Lint rules, pass and fail fixture each                                   | `src/lib/lint/rules.test.ts`                              |
| Live PDF preview, IndexedDB reload, downloads, keyboard-only build       | `e2e/builder.spec.ts`                                     |
| Magic-link sign-in end to end, through real SMTP                         | `e2e/auth.spec.ts`                                        |
| A used sign-in link stops working                                        | `e2e/auth.spec.ts`                                        |
| Sign-out deletes the session row, not just the cookie                    | `e2e/auth.spec.ts`                                        |
| Guest draft claimed intact; a second claim adds rather than overwrites   | `e2e/auth.spec.ts`                                        |
| Account deletion removes every row across all tables                     | `e2e/auth.spec.ts`, `src/server/accounts.test.ts`         |
| Ownership: no account can read or write another's resume                 | `src/server/resumes.test.ts`                              |
| No password column anywhere, no credentials provider (D7)                | `src/server/db.test.ts`, `src/server/auth/config.test.ts` |

---

## Outstanding — owed before launch

### 1. DOCX opens cleanly in real word processors

**Why this cannot be automated here:** it needs Word, LibreOffice, and Google
Docs. LibreOffice is not installed in the development environment, and the other
two are not automatable at all.

Generate a DOCX for each fixture (the emitter tests write none to disk by
default; add a temporary `writeFileSync` or use the builder's download button),
then for **each of Word, LibreOffice, and Google Docs**:

- [ ] Opens without a repair prompt or compatibility warning.
- [ ] Section headings show as **Heading 1** in the style pane — not as
      manually-bolded body text. This is the property D4 rests on.
- [ ] Bullets are a real list (the list controls in the ribbon are active when
      the cursor is in one), not literal `•` characters.
- [ ] Accented and extended-Latin characters render correctly — check the
      `non-latin-name` fixture specifically (Zoë Đurđević-Þórsdóttir).
- [ ] No text is clipped at the right margin — check `long-organization-names`.
- [ ] Dates sit at the right margin via a tab stop, and stay there when the
      window is resized.

**Result:** _not yet run._

### 2. Cross-format page parity

**Why this cannot be automated here:** needs a Word-compatible layout engine.
The practical option is LibreOffice headless converting DOCX→PDF and counting
pages, skipped gracefully when `soffice` is absent — worth adding when a machine
with it is available.

- [ ] For every fixture, the DOCX page count in Word matches the page count the
      PDF preview showed.
- [ ] Note that Word, LibreOffice, and Google Docs paginate slightly
      differently. Record which was used; a one-page difference between _those
      three_ is expected, a difference against our own PDF is a bug.

**Result:** _not yet run._

### 3. Google sign-in, live

**Why this cannot be automated here:** it needs a real Google Cloud project's
client id and secret, and a real Google account to consent with. There is no
honest way to fake the redirect handshake that would still prove anything about
the live provider, so the E2E suite does not pretend to: it covers the email
flow completely and leaves this owed.

What _is_ covered automatically: whether Google is offered at all, with which
options, that `allowDangerousEmailAccountLinking` stays off, that the profile
mapping stores no avatar URL, and how the account-linking collision is explained
to the user (`src/server/auth/config.test.ts`).

Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, with
`<origin>/api/auth/callback/google` as an authorized redirect URI, then:

- [ ] The "Continue with Google" button appears only once both variables are set.
- [ ] Consent screen shows the expected app name and scopes (email, profile).
- [ ] A first sign-in creates the account and lands on `/dashboard`.
- [ ] Signing out and back in reuses the same account rather than creating a second.
- [ ] Signing in with Google to an address that already used a magic link shows
      the explained `OAuthAccountNotLinked` message, and the magic link still works.
- [ ] No avatar URL is stored — check the `User` table has no image data.

**Result:** _not yet run._

### 4. The container actually runs (M0-T13, M2)

**Why this cannot be automated here:** there is no Docker daemon in the
development environment. CI builds the image on every push, which proves it
builds — not that it serves.

What the automated suites already cover, so it is _not_ on this list: the
schema is created from an empty database on every end-to-end run (the server
applies its own migrations, and `pnpm test:e2e` deletes the database first),
and the migration bookkeeping is checked against the real Prisma CLI in
`src/server/migrate.test.ts`.

What has only been reasoned about:

- [ ] `better-sqlite3` loads from the standalone output. It is a native addon
      and `serverExternalPackages` keeps it out of the bundle, so the image has
      to carry the compiled `.node` binary. Inspecting `.next/standalone` after
      a build shows the binary present and reached through a pnpm symlink —
      which Docker `COPY` preserves, but that has not been executed.
- [ ] The `VOLUME /data` mount holds the database across a container
      replacement, and the non-root `nextjs` user can write to it.
- [ ] The healthcheck marks the container unhealthy when the database is
      unreachable (stop the volume, watch `docker compose ps`).
- [ ] The hourly `backup` service writes into `/data/backups` and prunes.

Then, against a running container:

- [ ] `/api/health` returns `{"status":"ok"}`.
- [ ] `/` and `/signin` render.
- [ ] A magic link arrives through the real `EMAIL_SERVER` and signs in.

**Result:** _not yet run._

### 5. Off-site restore rehearsal (M2-T5)

**Why this cannot be automated here:** needs an S3-compatible bucket and a
Docker host.

**Local snapshots are already rehearsed** — `src/server/backup.test.ts` takes a
snapshot of a live database, verifies it, restores it to a fresh path, and
confirms the app can serve from the result, on every push. That is the layer
that recovers from a bad migration or a mistaken delete.

What remains owed is the layer that recovers from losing the machine: a
Litestream replica, restored after an ungraceful kill, with the numbers
recorded. §10 names this as the largest tail risk in the architecture, and
M2-T5's acceptance is explicitly the rehearsal rather than the configuration.

- [ ] Restore from a real S3 replica after `docker kill` (not `stop` — a
      graceful stop lets Litestream flush, which was never the case in doubt).
- [ ] `node scripts/backup.mjs verify` passes on the restored file.
- [ ] RPO and RTO measured and recorded in the runbook's table.

**Result:** _not yet run._

### 6. JD section split on ten real postings (M3-T3)

**Why this cannot be automated here:** M3-T3's acceptance is a correct split
on ten postings _collected from public listings_. Copying ten real postings
into this repository would be republishing someone else's copyrighted text,
and writing ten and calling them real would be worse. So the automated suite
covers ten distinct structural **conventions** instead
(`src/test/fixtures/job-descriptions.ts`), and the check against genuinely
collected postings is here.

```bash
node scripts/parse-jd.mjs path/to/posting.txt   # or pipe it in on stdin
```

For each of ten postings, from ten different companies and at least three
different job boards:

- [ ] Every heading is given the kind you would have given it yourself.
- [ ] Requirements and preferences end up in different sections — this is the
      distinction the whole module exists for.
- [ ] Nothing under `ignored` is something the posting actually asks of a
      candidate.
- [ ] No paragraph is split in the middle by a mis-read heading.
- [ ] Record any heading wording that came back `unknown`; that is the list
      of patterns to add.

**Result:** _not yet run._

### 7. Build a resume end-to-end on a real phone

**Why this cannot be automated here:** the criterion is about whether it is
usable, not whether it renders. An emulator answers the wrong question.

- [ ] Complete a resume start to finish on a physical phone, portrait, one
      handed where possible.
- [ ] The 390px viewport is the target width; check nothing overflows
      horizontally.
- [ ] The Edit/Preview tabs are reachable and the preview is legible.
- [ ] The on-screen keyboard does not cover the field being typed into.
- [ ] Download all three formats and confirm they open on the device.
- [ ] Sign in by magic link from the phone's own mail app and confirm the link
      opens in a browser that keeps the session.

**Result:** _not yet run._

---

## Known limitations, recorded deliberately

- **Scripts the vendored fonts do not cover** — Devanagari, Bengali, Tamil, Han,
  Hangul, Kana, Arabic, Hebrew, Thai. Names in these render as `.notdef` boxes.
  Recorded in `src/lib/fonts/charset.ts` and `docs/ATTRIBUTION.md`; the
  mitigation (a Noto fallback chain) is not in M0.
- **Byte-for-byte PDF determinism is not achievable.** pdfkit randomizes the
  embedded font subset tag and react-pdf flushes font streams in async
  completion order. `pdfFingerprint` normalizes both; the document is identical,
  the serialization is not. See `src/lib/emit/pdf/determinism.ts`.
- **The PDF preview needs a browser with `'wasm-unsafe-eval'` support** —
  Chrome 97+, Firefox 102+, Safari 16.4+. react-pdf lays out text with a
  WebAssembly build of Yoga, and the CSP allows WebAssembly without allowing
  `eval` of JavaScript. On an older browser the builder still works and the
  preview does not. Widening the policy to `'unsafe-eval'` would fix it and
  give up the protection entirely, so it is recorded here instead.
- **The development mail outbox never runs in production.** `AUTH_DEV_OUTBOX`
  writes sign-in emails to disk so the flow is usable without an email account;
  it throws under `NODE_ENV=production`. The E2E run therefore does not use it —
  it points the real SMTP transport at a capture server (`e2e/mail-server.ts`),
  which is the code that actually ships.
- **`ResizeObserver`, `HTMLDialogElement.showModal`, and `URL.createObjectURL`
  are stubbed in jsdom** (`src/test/setup.ts`). Anything depending on their real
  behaviour must be covered by the Playwright suite instead.
