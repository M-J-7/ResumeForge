# Runbook

Operating the deployed app: what to set, what to run, and what to do when the
database is gone.

> **Status.** Everything below is _designed_, and the parts that can be
> verified without a server have been. **The restore rehearsal that M2-T5
> requires has not been run** — there is no Docker daemon and no bucket in the
> development environment. Until it has, treat the backup section as a plan
> rather than as a backup. An untested backup is not a backup, and the plan
> (§10) names this as the single largest tail risk in the architecture.
>
> `docs/QA.md` tracks the checks this file is waiting on.

---

## What the app needs to run

| Variable                                | Required            | What it is                                                                  |
| --------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                          | yes                 | `file:/data/app.db` — a path **on the persistent volume**, not in the image |
| `AUTH_SECRET`                           | yes                 | 32 random bytes, base64. Rotating it signs everyone out                     |
| `AUTH_URL`                              | yes in production   | The public origin, e.g. `https://example.com`                               |
| `EMAIL_SERVER`                          | yes                 | SMTP URL for the transactional provider                                     |
| `EMAIL_FROM`                            | yes                 | The From address on sign-in emails                                          |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no                  | Both or neither. Google sign-in is hidden when absent                       |
| `AUTH_DEV_OUTBOX`                       | never in production | Development only; the transport refuses to run under `NODE_ENV=production`  |

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**`AUTH_URL` matters more than it looks.** Auth.js builds sign-in callback URLs
from the request's `Host` header unless told otherwise. Behind a proxy that
does not normalise it, a forged header can send a working sign-in link
somewhere else. Set it explicitly.

### Why not Vercel

The architecture assumes a persistent filesystem holding a SQLite file that
the process writes to directly. Vercel's functions have neither. Deploy the
Docker image to something with a volume: Railway, Render, Fly, or a plain VPS.

---

## First deploy

1. **Provision a volume** and mount it at `/data`. Everything durable lives
   there: the database, its WAL, and (later) Litestream's local state.

2. **Create the schema.** The runtime image carries the app server only — no
   Prisma CLI, no migration SQL — so migrations are applied as a deliberate
   step rather than on every container start. With a single-writer SQLite
   database that is the right trade: two containers racing `migrate deploy` at
   boot is a worse failure than one manual command.

   From a checkout, against the production database:

   ```bash
   DATABASE_URL="file:/data/app.db" pnpm db:deploy
   ```

   `prisma.config.ts` prefers an explicit `DATABASE_URL` over anything in a
   local `.env`, so this cannot be quietly redirected at a development
   database by a stale file.

3. **Start the app**, then check `/` responds and `/signin` renders.

4. **Send yourself a sign-in link.** The first real test of `EMAIL_SERVER` is
   the first sign-in; there is no earlier signal. If it fails, the message
   names the missing variable.

## Upgrades

```bash
DATABASE_URL="file:/data/app.db" pnpm db:deploy   # if the release adds a migration
# then roll the container
```

Migrations here are additive by convention. A destructive one (dropping or
narrowing a column) needs a backup taken immediately before it — see below —
because SQLite's `ALTER TABLE` rewrites are not transactional across a crash.

---

## Backups (M2-T5) — designed, not yet rehearsed

**Design (D9):** [Litestream](https://litestream.io) runs as a sidecar,
streaming the SQLite WAL to an S3-compatible bucket continuously. It is not a
snapshot tool: it replicates every write shortly after it happens, which is
what makes the recovery point measured in seconds rather than hours.

It works because of `PRAGMA journal_mode=WAL` (`src/server/db.ts`). Without
WAL there is no stream to replicate, so **that pragma is a backup dependency,
not only a concurrency setting.**

`litestream.yml`:

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

Run the app under Litestream so replication starts before the first write and
stops after the last:

```bash
litestream replicate -exec "node server.js"
```

### The restore rehearsal — the actual deliverable

M2-T5's acceptance is not "Litestream is configured". It is a **documented,
rehearsed restore with a measured RPO and RTO.** Configuration that has never
been restored from is a belief, not a backup.

Procedure, to be run and the results recorded here:

1. Note the current row counts:

   ```bash
   sqlite3 /data/app.db "SELECT (SELECT COUNT(*) FROM User), (SELECT COUNT(*) FROM Resume);"
   ```

2. Make a change through the UI (edit a resume) and note the wall-clock time.

3. Kill the container **without a clean shutdown** — `docker kill`, not `stop`.
   A graceful stop lets Litestream flush, which is the case that was never in
   doubt.

4. Restore to a fresh path on a fresh volume:

   ```bash
   litestream restore -o /data/restored.db s3://BUCKET/app.db
   ```

5. Verify integrity and content:

   ```bash
   sqlite3 /data/restored.db "PRAGMA integrity_check;"    # expect: ok
   sqlite3 /data/restored.db "SELECT (SELECT COUNT(*) FROM User), (SELECT COUNT(*) FROM Resume);"
   ```

   Then start the app against the restored file and confirm the edit from
   step 2 is present, or determine exactly how much was lost.

6. **Record the numbers below.** RPO is how much data the restore lost (step 2
   minus what survived). RTO is how long steps 4–5 took, wall clock.

| Date | RPO (data lost)  | RTO (time to serve) | Notes                             |
| ---- | ---------------- | ------------------- | --------------------------------- |
| —    | not yet measured | not yet measured    | Needs a bucket and a Docker host. |

---

## Losing the database entirely

Until the rehearsal above has been done, the honest answer is that recovery is
unproven. The order of operations when it becomes real:

1. Stop the app. Do not let it write to a half-restored file.
2. Restore to a **new** path — never over the live file, so a failed restore
   leaves the original evidence intact.
3. `PRAGMA integrity_check` before anything else touches it.
4. Point `DATABASE_URL` at the restored file and start.
5. Write down what was lost, and tell the people it belonged to.

That last step is not optional. Resumes are work people cannot reproduce from
memory, and a product whose whole position is that it does not hold your work
hostage does not get to be quiet about losing it.

---

## Routine checks

- **Database size.** `ls -la /data/app.db*`. A WAL that never shrinks means a
  reader is holding a transaction open.
- **Sign-in works.** The email path has one external dependency and it fails
  silently from the app's point of view — nobody reports "I did not receive an
  email" quickly.
- **Migrations are applied.** `DATABASE_URL=... pnpm exec prisma migrate status`.
