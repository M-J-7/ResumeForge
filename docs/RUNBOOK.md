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

| Variable                                          | Required            | What it is                                                                    |
| ------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | yes                 | `file:/data/app.db` — a path **on the persistent volume**, not in the image   |
| `AUTH_SECRET`                                     | yes                 | 32 random bytes, base64. Rotating it signs everyone out                       |
| `AUTH_URL`                                        | yes in production   | The public origin, e.g. `https://example.com`                                 |
| `SITE_DOMAIN`                                     | yes in production   | The hostname Caddy serves and gets a certificate for. Same host as `AUTH_URL` |
| `EMAIL_SERVER`                                    | yes                 | SMTP URL for the transactional provider                                       |
| `EMAIL_FROM`                                      | yes                 | The From address on sign-in emails                                            |
| `BACKUP_DIR`                                      | recommended         | Where snapshots go. Must be on the volume                                     |
| `LITESTREAM_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | with Litestream     | S3 credentials for the bucket in `litestream.yml`                             |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`           | no                  | Both or neither. Google sign-in is hidden when absent                         |
| `AUTH_GOOGLE_ISSUER`                              | never in production | A test seam for the E2E suite's local OpenID provider. Leave unset            |
| `SKIP_AUTO_MIGRATE`                               | no                  | `1` to apply migrations by hand instead of at startup                         |
| `AUTH_DEV_OUTBOX`                                 | never in production | Development only; refuses to run under `NODE_ENV=production`                  |

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**`AUTH_URL` matters more than it looks.** Auth.js builds sign-in callback
URLs from the request's `Host` header unless told otherwise. Behind a proxy
that does not normalise it, a forged header can send a working sign-in link
somewhere else. Set it explicitly.

### One instance, one disk

This is the constraint the whole architecture rests on, and it is structural
rather than a limit to raise later. `better-sqlite3` is a **single writer**
against a file on a local volume.

Three rules follow, and breaking any of them corrupts the database rather than
slowing it down:

- **Never two app processes on two hosts.** Not a warm standby, not a second
  region. Two writers against one file is not a supported configuration of
  SQLite; it is data loss with extra steps.
- **Never a network filesystem.** NFS, EFS and most container-platform shared
  volumes implement `fcntl` locking incorrectly or not at all, which is
  precisely what SQLite relies on. The volume must be a real block device.
- **Never a rolling deploy.** A rolling deploy runs the old and new containers
  at once, by design. That is two writers. Deploys here are stop-then-start,
  and the seconds of downtime are the price of the rest of this document being
  true.

**Why Vercel cannot host this.** Its functions have neither a persistent
filesystem nor a single long-lived process. Next.js defaults push everyone
toward Vercel, which is why this is worth stating rather than assuming.

**Render and Railway are the wrong shape**, despite both advertising
persistent disks — their deploy model is rolling by default, which violates
the third rule above. They can be made to work by forcing recreate-then-start,
but that is fighting the platform.

**What fits:** a plain VM with a block volume, running the Compose stack.
Oracle Cloud Always Free (Arm Ampere A1), a Hetzner CX22 at about €4/month,
Fly.io with a Fly Volume, or any VPS.

#### If you are on Oracle Cloud Always Free

Two things bite there specifically, and neither is a problem with this app:

- **Idle reclamation.** Oracle stops Always Free A1 instances whose 95th
  percentile CPU **and** network **and** memory all sit under 20% across a
  7-day window. All three must be under, so exceeding any one is enough. The
  uptime monitor in "Routine checks" below is the defence, together with the
  hourly backup job and Litestream, which between them keep disk and network
  from going flat. Do not try to game the thresholds with a busy loop; if it
  bites, move to Hetzner and run the identical Compose file.
- **Capacity.** "Out of host capacity" when creating an A1 instance is common
  in popular regions. Retry in another availability domain, or choose a
  quieter home region at signup — the home region cannot be changed later.
- **The allowance halved on 15 June 2026.** Always Free Ampere A1 went from
  4 OCPU / 24 GB to **2 OCPU / 12 GB**, with no announcement — the docs were
  edited, and instances over the new limit were stopped from 18 August 2026.
  2 OCPU / 12 GB is still several times what this stack needs, so nothing here
  changes; it is recorded because the number is quoted in a lot of guides that
  have not been updated, and because it is the clearest evidence available
  that "always free" is a policy rather than a contract.

#### The whole thing on free tiers

Every component has a free tier that does not expire. None of it is a
different architecture — it is the same Compose file with three values filled
in.

| Need             | Free option                   | Limit that matters                                             |
| ---------------- | ----------------------------- | -------------------------------------------------------------- |
| The VM           | Oracle Always Free Ampere A1  | 2 OCPU / 12 GB / 200 GB block storage. Idle reclamation above. |
| Off-site backups | Cloudflare R2                 | 10 GB and 1M writes a month, no egress charge, no expiry.      |
| Magic-link email | Brevo                         | 300 a day. One email per sign-in, so that is 300 sign-ins.     |
| TLS              | Let's Encrypt, via Caddy      | Already in the Compose stack. Nothing to configure.            |
| The domain       | **Not free.** ~$10-15 a year. | See below.                                                     |

**The domain is the one thing worth paying for.** A free subdomain
(`*.duckdns.org` and friends) works for everything except Google sign-in:
Google rejects redirect URIs whose host is on the Public Suffix List, which
those all are — B3, and it is their rule, not ours. Magic-link email is a
complete way in on its own, so a free subdomain ships a working product; it
just ships one with a single sign-in method and an address that reads as a
hobby project. A registrable domain costs about a pound a month and removes
both problems.

**Second choice if Oracle will not give you an instance:** Google Cloud's
Always Free `e2-micro` in `us-west1`, `us-central1` or `us-east1`, with a
**standard** persistent disk — balanced and SSD disks are not free. It is a
real VM with a real block device, which is the requirement; it has 1 GB of
memory, so give it swap and expect the PDF worker to be the thing that
notices.

---

## Google sign-in

Optional. Without credentials the button is not rendered and the magic link is
the only way in — which is a complete product, not a degraded one.

### Setting it up

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials),
on a project of its own:

1. **OAuth consent screen** — External. The app name and support email are
   what a user reads on the consent screen, so they should be the product's,
   not a personal address that looks like a phishing attempt.
2. **Scopes** — `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   and nothing else. Anything more triggers Google's verification review and
   asks users for access this app has no use for. The profile mapper keeps
   only the name and the address even from these.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. **Authorized redirect URIs** — `https://your-host/api/auth/callback/google`,
   exactly, including the scheme and any port. Google matches the string
   literally: a trailing slash or `www.` that the site does not use is a
   `redirect_uri_mismatch` at the moment a user tries to sign in. Add
   `http://localhost:3000/api/auth/callback/google` too if you develop
   against it.
5. **Publishing status** — while the client is in _Testing_, only the accounts
   listed as test users can sign in; everyone else gets Google's "access
   blocked" screen. Publish before launch.

Then set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` and restart. Nothing else
changes: the button appears once both are present.

### Check it before anyone else does

```bash
AUTH_GOOGLE_ID=… AUTH_GOOGLE_SECRET=… AUTH_URL=https://your-host pnpm auth:google
```

This asks Google directly — discovery, then the token endpoint with a
deliberately invalid code, then one `prompt=none` authorization request — and
names what is wrong: credentials Google does not recognise, a redirect URI
that is not registered, a client that is still restricted to test users. It
signs nobody in and needs no browser, so it is safe to run from a deploy host
or in a release check.

A clean run leaves exactly one thing for a person: looking at the consent
screen once. `docs/QA.md` check 3 has that list.

**Account linking is deliberately off.** Someone who has signed in with a
magic link and then presses "Continue with Google" is told the two are not
connected and to use a link — not merged into one account. Automatic linking
trusts a provider's email claim; the recovery here (the magic link always
works) is good enough that the config does not need to.

---

## Deploying

### On Oracle Cloud Always Free, which is scripted

`deploy/oracle/` provisions the instance and starts the stack, and its
README is the decided path rather than a set of options: Terraform for the VM
and its network, cloud-init for the base image, `bootstrap.sh` to write
`.env.production` and start, `deploy.sh` for every version after that.

Two things there are Oracle-specific and both are handled. `main.tf` opens
80/443 in the VCN security list and `cloud-init.yaml` opens them again in the
instance's own iptables — **neither works alone**, because Oracle's images
ship rules that accept 22 and reject the rest regardless of the security list.
And `Out of host capacity` on a first `terraform apply` is normal rather than
a mistake; the README has the retry.

### Anywhere else

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
4. **If Google is configured**, `pnpm auth:google` against the deployed origin,
   then press the button once. The redirect URI it prints has to be the one
   registered, and this is the moment a mismatch shows up.

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

> **Live since 2026-09-12**, replicating to Oracle Object Storage in
> `ap-hyderabad-1`. A restore has been performed and verified — see the
> measured row below, including what that rehearsal did **not** cover.

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

| Date       | RPO (data lost) | RTO (time to serve) | Notes                                                                                                                   |
| ---------- | --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-12 | ≤ 1 s           | 83 ms restore       | **Partial rehearsal.** Restored the off-site replica to a scratch path beside the live database; `verify` reported integrity ok, 0 broken refs, 4 migrations, and the live row counts. The volume was **not** destroyed — see below. |

RPO is the `sync-interval: 1s` in `litestream.yml`, and the restore did replay
the newest WAL segment rather than only the snapshot, so the bound is real
rather than nominal. The 83 ms is the restore itself (snapshot download, WAL
replay, rename) for a 180 KB database; end to end, including recreating the
container, it was about two minutes.

**What this rehearsal did not prove.** The procedure above says to `docker kill`
the app and destroy the volume. This was run against a live deployment with
real accounts in it, so the replica was restored *alongside* the database
instead. That proves the replica exists, is complete, and reconstructs a
byte-correct database — it does not prove the operator steps under real data
loss, where the pressure is different and `restore` refuses to overwrite an
existing file. Do the destructive version at the next maintenance window, and
replace this row with it.

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

## The local cover-letter enhancement model: do not turn it on

**It does not work well enough to ship, and this is measured rather than
assumed.** `pnpm enhance:fetch` exists, it is correct, and a deployment should
not run it.

The QA §11 measured pass ran `Xenova/flan-t5-small` in a real browser for the
first time — every earlier test stubbed the model — and found three things.
Two were bugs and are fixed. The third is the model.

1. **The runtime was never vendored completely.** `wasmPaths` relocates a
   _directory_, and ONNX Runtime Web loads a `.mjs` glue module from it as well
   as the `.wasm` binary. The script copied one of the two, so every run
   downloaded 96MB of weights and then 404ed on a 44KB loader. Fixed: the
   script now vendors every `ort-*` file the installed package ships, and
   `enhance.hosting.test.ts` asserts the set rather than a string.

2. **The WebGPU path returned the same garbage for every input.** Byte-identical
   across four different paragraphs (`"comunicat cabluvêtement this this…"`),
   which means the encoder's output never reached the decoder. int8
   weights on ONNX Runtime Web's JSEP provider are a known-bad pairing. The
   guardrail rejected it as "stopped mid-sentence", so it looked like a slow
   model rather than a broken backend. Fixed by removing the WebGPU path: the
   feature is WASM-only, which is slower on paper and correct everywhere.

3. **The model cannot do the task.** On the working backend it echoes its
   input unchanged, drops facts, or emits fragments. Six prompt shapes were
   tried and none helped; `flan-t5-base` and `LaMini-Flan-T5-248M` were tried
   at 278MB each and did not clear the bar either — LaMini emits _"I'm sorry,
   but as an AI language model…"_, having been distilled from a model that
   refuses things.

The guardrail behaved correctly throughout, and that is worth saying plainly:
it caught the invented claims and the truncation. What it cannot catch is a
rewrite that is merely useless, because "this is a worse paragraph" is not a
property a rule can check.

### What a deployment does about it

Nothing. Do not run `pnpm enhance:fetch`. Without the weights,
`isEnhancementInstalled()` finds nothing, the editor tells the user the
feature is unavailable on this deployment, and the deterministic Recompose —
which needs no model and is what the letters are composed from anyway — is
unaffected. This is a supported state, it is the default, and it is now the
recommended one.

### If you want to try it anyway

```
pnpm enhance:fetch    # ~120MB into public/models and public/ort
pnpm build            # in that order
```

**In that order.** Next resolves `public/` at build time, so weights fetched
after a build are served as 404s — which is exactly what the feature does when
it is not installed, so it fails looking like a deployment that never ran the
step.

It has to be this origin. The CSP is `connect-src 'self' blob: data:`, so a
fetch to `huggingface.co` — what Transformers.js does by default — is blocked
outright. `enhance.browser.ts` sets `allowRemoteModels = false` and points the
loader at `/models/`. That is the one configuration in which the feature works
at all, and it is also what makes the privacy claim structural rather than a
promise: there is no code path from a user's cover letter to anybody else's
server. The measured pass confirmed it — every request during a run was
same-origin.

Re-run it after a fresh clone or after changing the pinned revision;
`enhance.hosting.test.ts` fails if the adapter and the script stop agreeing on
which commit that is.

### Before re-enabling it after a model change

Run `pnpm qa:enhance` and **read the proposals**. Checking that nothing threw
is what let a completely broken backend ship: the failure mode of a wrong
answer here is a plausible sentence, not an exception.
