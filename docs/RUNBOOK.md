# Runbook

Operating the deployed app: what to set, how to deploy, how backups work, and
what to do when the database is gone.

> **What is verified and what is not.** The deploy path, the schema creation,
> and the backup/restore cycle are exercised automatically — the end-to-end
> suite starts from an empty database on every run, and `src/server/backup.test.ts`
> takes a snapshot, verifies it, and restores it on every push. What has
> **not** been run is the container itself (no Docker daemon in the
> development environment) and Litestream's off-site replication (no bucket).
> Both are tracked in [`docs/QA.md`](QA.md).

---

## What the app needs to run

| Variable                                | Required            | What it is                                                                  |
| --------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                          | yes                 | `file:/data/app.db` — a path **on the persistent volume**, not in the image |
| `AUTH_SECRET`                           | yes                 | 32 random bytes, base64. Rotating it signs everyone out                     |
| `AUTH_URL`                              | yes in production   | The public origin, e.g. `https://example.com`                               |
| `EMAIL_SERVER`                          | yes                 | SMTP URL for the transactional provider                                     |
| `EMAIL_FROM`                            | yes                 | The From address on sign-in emails                                          |
| `BACKUP_DIR`                            | recommended         | Where snapshots go. Must be on the volume                                   |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no                  | Both or neither. Google sign-in is hidden when absent                       |
| `SKIP_AUTO_MIGRATE`                     | no                  | `1` to apply migrations by hand instead of at startup                       |
| `AUTH_DEV_OUTBOX`                       | never in production | Development only; refuses to run under `NODE_ENV=production`                |

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**`AUTH_URL` matters more than it looks.** Auth.js builds sign-in callback
URLs from the request's `Host` header unless told otherwise. Behind a proxy
that does not normalise it, a forged header can send a working sign-in link
somewhere else. Set it explicitly.

### Why not Vercel

The architecture assumes a persistent filesystem holding a SQLite file the
process writes to directly. Vercel's functions have neither. Deploy the Docker
image to something with a volume: Railway, Render, Fly, or a plain VPS.

---

## Deploying

```bash
cp .env.example .env.production   # fill in AUTH_SECRET, AUTH_URL, EMAIL_*
docker compose up -d --build
```

That is the whole first deploy. **There is no separate migrate step**: the
server applies its own pending migrations the first time it touches the
database (`src/server/db.ts` → `src/server/migrate.ts`), using Prisma's own
`_prisma_migrations` table and checksums, so `prisma migrate status` still
reports correctly against it. A migration that fails runs inside a
transaction and leaves nothing behind, so a retry is safe rather than a guess.

Then check, in order:

1. `curl -fsS https://your-host/api/health` returns `{"status":"ok"}`. This
   touches the database, so a pass means more than "the page rendered".
2. `/` and `/signin` load.
3. **Send yourself a sign-in link.** The first real test of `EMAIL_SERVER` is
   the first sign-in; there is no earlier signal. If it fails, the error names
   the missing variable.

### Upgrades

Roll the container. Pending migrations apply on first use.

An operator who would rather apply migrations deliberately can set
`SKIP_AUTO_MIGRATE=1` and run, from a checkout:

```bash
DATABASE_URL="file:/data/app.db" pnpm db:deploy
```

`prisma.config.ts` prefers an explicit `DATABASE_URL` over anything in a local
`.env`, so this cannot be quietly redirected at a development database.

**Before a destructive migration** — one that drops or narrows a column — take
a snapshot first (below). SQLite rewrites the table to do it, and a crash
mid-rewrite is not something a transaction saves you from.

---

## Backups

Two layers, answering different failures. Neither substitutes for the other.

### 1. Local snapshots — running, and rehearsed on every push

The `backup` service in `docker-compose.yml` runs hourly and keeps 48:

```bash
node scripts/backup.mjs create --keep 48
node scripts/backup.mjs list
node scripts/backup.mjs verify /data/backups/app-....db
```

This uses SQLite's **online backup API**, not `cp`. Copying a live SQLite file
copies it mid-write: the result usually opens, usually looks fine, and is
missing the last transactions — the worst failure mode there is, because it is
silent. `create` verifies its own output and exits non-zero if the snapshot is
not restorable, so a failing cron job is a failing cron job rather than a
directory full of unusable files.

Recovers from: a bad migration, a mistaken delete, corruption.
Does not recover from: losing the volume.

### 2. Litestream — off-site, still owed

**Design (D9):** [Litestream](https://litestream.io) as a sidecar, streaming
the WAL to an S3-compatible bucket continuously. Uncomment the service in
`docker-compose.yml` and add `litestream.yml`:

```yaml
dbs:
  - path: /data/app.db
    replicas:
      - type: s3
        bucket: BUCKET
        path: app.db
        region: REGION
        endpoint: ENDPOINT # omit for AWS S3
        sync-interval: 1s
```

Credentials go in the environment (`LITESTREAM_ACCESS_KEY_ID`,
`LITESTREAM_SECRET_ACCESS_KEY`), never in the file.

It works because of `PRAGMA journal_mode=WAL` (`src/server/db.ts`). Without
WAL there is no stream to replicate, so **that pragma is a backup dependency,
not only a concurrency setting.**

Recovers from: losing the machine.

> **Not yet rehearsed.** M2-T5's acceptance is a restore that has actually
> been performed with a measured RPO and RTO, and that needs a bucket and a
> Docker host. Until it has been done, treat this layer as a plan. The
> procedure is below; the table is empty on purpose.

---

## Restoring

`restore` never writes over an existing file. Restoring over the live database
destroys the only other copy at the exact moment you have least slack.

```bash
# 1. Stop the app. Do not let it write to a half-restored file.
docker compose stop app

# 2. Restore beside the live database, never onto it.
node scripts/backup.mjs restore /data/backups/app-2026-08-31T09-00-00-000Z.db /data/restored.db

# 3. The command already ran integrity_check, foreign_key_check, and row
#    counts. Read them. If anything looks short, try an older snapshot before
#    touching the original.

# 4. Swap, keeping the original.
mv /data/app.db /data/app.db.broken
mv /data/restored.db /data/app.db

# 5. Start, and check /api/health.
docker compose start app
```

From a Litestream replica the equivalent of step 2 is:

```bash
litestream restore -o /data/restored.db s3://BUCKET/app.db
node scripts/backup.mjs verify /data/restored.db
```

### Then tell people

Write down what was lost, and tell the people it belonged to. Resumes are work
nobody can reproduce from memory, and a product whose whole position is that
it does not hold your work hostage does not get to be quiet about losing it.

### The measured rehearsal (M2-T5's acceptance)

To be run against a real deployment and recorded here. Kill the container with
`docker kill`, not `stop` — a graceful stop lets everything flush, which is
the case that was never in doubt.

| Date | RPO (data lost)  | RTO (time to serve) | Notes                             |
| ---- | ---------------- | ------------------- | --------------------------------- |
| —    | not yet measured | not yet measured    | Needs a bucket and a Docker host. |

---

## What is already defended, and how

Worth knowing before changing any of it.

- **Sign-in is rate limited** (`src/server/rate-limit.ts`): 5 links per address
  per hour, 60 per IP per hour. The endpoint sends mail to any address it is
  given, so without this it is both a way to bomb a stranger's inbox and a way
  to run up your provider bill. The counters are rows, so they survive a
  restart — and a deploy loop is not a way around them.
- **Security headers** are set in `next.config.ts`, including a CSP with no
  `'unsafe-eval'`. `'wasm-unsafe-eval'` is present because react-pdf lays out
  text with a WebAssembly build of Yoga; removing it silently breaks the
  preview, the page-fit indicator, X-Ray, and the PDF download.
- **Logs are scrubbed** (`src/server/logging.ts`), and Prisma is configured
  with `errorFormat: "minimal"` so a failed write does not report the
  statement's parameters — which, for a resume save, is the whole resume.
- **Sessions are database rows**, so signing out revokes rather than forgets.
- **Deleting an account is a hard delete** across every table, which works
  only because `PRAGMA foreign_keys=ON` is applied on every connection.

---

## Routine checks

- **`/api/health`** — wire it to whatever watches the service. It touches the
  database, so it fails when the app is up and the data is not.
- **Backups are landing.** `node scripts/backup.mjs list`. A gap in the
  timestamps is a cron job that has been failing quietly.
- **Database size.** `ls -la /data/app.db*`. A WAL that never shrinks means a
  reader is holding a transaction open.
- **Migrations are applied.** `DATABASE_URL=... pnpm exec prisma migrate status`.
- **Sign-in works.** The email path has one external dependency and it fails
  silently from the app's point of view — nobody reports "I did not receive an
  email" quickly.
