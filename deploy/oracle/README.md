# Deploying to Oracle Cloud Always Free

Everything in this directory is decided. There are no options to weigh at
deploy time and no judgement calls left in the scripts — the reasoning is
written down beside each choice so it can be argued with later, but the
default path is a straight line.

What is **not** here is anything that needs an account: an Oracle tenancy, a
domain, and an SMTP provider. Three sign-ups — the backup bucket is created by
Terraform in the same Oracle tenancy, so it is not a fourth. Each is called out
below under **You**, with exactly what to paste where.

---

## What it costs

Nothing, except the domain.

| Piece            | What                      | Free allowance                                       |
| ---------------- | ------------------------- | ---------------------------------------------------- |
| The VM           | Ampere A1, 2 OCPU / 12 GB | The whole Always Free A1 quota, since 15 June 2026   |
| Disk             | 50 GB boot volume         | Of 200 GB always-free block storage                  |
| Public IP        | 1 reserved                | 2 free **while attached to a running instance**      |
| TLS              | Let's Encrypt via Caddy   | Free, automatic, already in the Compose stack        |
| Off-site backups | Oracle Object Storage     | 20 GB always free, same tenancy — no extra account   |
| Sign-in email    | Brevo                     | 300/day — one email per sign-in, so 300 sign-ins/day |
| **The domain**   | ~£10/year                 | **Not free.** See step 2 below.                      |

The reserved IP is free while it is attached, which it is for the life of the
instance. It is reserved rather than ephemeral so that rebuilding the instance
does not mean repointing DNS and waiting for it to propagate while Caddy fails
ACME challenges against a five-per-week limit. If you ever destroy the instance
and do not replace it, release the address (`oci network public-ip delete`)
rather than leaving it detached — a detached reserved address is the one state
the free allowance does not cover.

The A1 allowance **halved on 15 June 2026** — 4 OCPU / 24 GB became 2 / 12,
with no announcement, and instances over the new limit were stopped from
18 August. `main.tf` requests the current numbers. Most guides online still
quote the old ones, and following them creates something that works for six
weeks and then stops.

---

## The order, and why it is this order

DNS before TLS, TLS before sign-in. Each step's failure is invisible until the
step after it, so doing them out of order means debugging the wrong thing.

### 0. **You** — get the code onto GitHub first

`cloud-init.yaml` clones `https://github.com/M-J-7/RESUME_BUILDER.git` and
`deploy.sh` pulls `origin/master`. **The instance builds what is on master, not
what is on your laptop**, so anything uncommitted is not deployed — it is
simply absent, and the deployment will look like a working older version
rather than like a mistake.

```bash
git status --short | wc -l     # should be 0, or close to it
git push origin master
```

If you deploy from a fork or a private repository, change the clone URL in
`cloud-init.yaml`. A private one also needs a deploy key on the instance,
which is the one thing here that is not scripted.

### 1. **You** — an Oracle Cloud account

<https://cloud.oracle.com/> → _Start for free_. A card is required for
identity verification and is not charged for Always Free resources; the
account stays in the free tier unless you explicitly upgrade it.

**Choose the home region carefully.** It cannot be changed afterwards, and A1
capacity is the whole reason this matters. `uk-london-1`, `us-ashburn-1` and
`eu-frankfurt-1` are heavily contended; a smaller region near you will
usually give you an instance on the first attempt rather than the twentieth.

Then, locally:

```bash
oci setup config          # writes ~/.oci/config and an API key
```

### 2. **You** — a domain

Buy one. About £10 a year, and it is the only thing on this page that costs
money.

**Why not a free subdomain.** `*.duckdns.org` and friends work for everything
except Google sign-in: Google refuses redirect URIs whose host is on the
Public Suffix List, and every free dynamic-DNS host is on it. That is their
rule and there is no way around it (`docs/BLOCKERS.md`, B3). Magic-link email
is a complete way in on its own, so a free subdomain does ship a working
product — one with a single sign-in method and an address that reads as a
hobby project. It is a real option; it is not the one this file assumes.

### 3. Create the instance

```bash
cd deploy/oracle
cp terraform.tfvars.example terraform.tfvars   # fill in three values
terraform init
terraform apply
```

#### When it says `Out of host capacity`

It will, probably more than once. This is not a configuration error — A1
capacity in popular regions is genuinely exhausted most of the time, and
Oracle does not queue requests.

```bash
# Regions with more than one availability domain: try the others.
terraform apply -var availability_domain_index=1
terraform apply -var availability_domain_index=2

# Otherwise: retry. Capacity frees up continuously and unpredictably.
until terraform apply -auto-approve; do sleep 300; done
```

Five minutes between attempts, not five seconds. Hammering the API gets the
tenancy rate-limited, which turns a wait into a longer wait. People routinely
report getting an instance after hours of this; a quieter home region at
signup is the only thing that actually avoids it.

**If it never succeeds**, the fallback is a €4/month Hetzner CX22 running the
_identical_ Compose stack — `docker-compose.yml`, `Caddyfile` and
`bootstrap.sh` are not Oracle-specific, and only `main.tf` and the iptables
step in `cloud-init.yaml` are. Google Cloud's Always Free `e2-micro` with a
**standard** persistent disk is the other free option; 1 GB of memory means
giving it swap and expecting the PDF worker to notice.

### 4. **You** — point DNS at it

`terraform apply` prints the public IP. Create an `A` record for the hostname
you intend to serve, and wait for it to resolve.

```bash
dig +short your-domain.com     # must print the instance's IP
```

**Do not skip the wait.** Caddy asks Let's Encrypt for a certificate the
moment it starts, and failed attempts count against a limit of **five per
hostname per week**. `bootstrap.sh` checks this for you and refuses to start
if the name does not resolve — that check is the reason it exists.

### 5. **You** — an SMTP provider

[Brevo](https://www.brevo.com/) (300/day) or [Resend](https://resend.com/)
(3,000/month). Both are plain SMTP, so nothing in the application changes
between them, and you can swap later by editing one line.

This is the only third party that ever sees a user's email address (D6), and
the message it carries is a login link — never resume content.

### 6. Start it

```bash
ssh ubuntu@<the public IP>
cd /opt/resume-builder
sudo ./deploy/oracle/bootstrap.sh
```

The first run writes `.env.production` with a generated `AUTH_SECRET`, tells
you which four lines to fill in, and stops. Fill them in, run it again, and it
builds and starts the stack.

Expect the build to take a while. It compiles `better-sqlite3` from source on
two Ampere cores.

### 7. Check it, in this order

```bash
curl -fsS https://your-domain.com/api/health     # touches the database
```

Then open `/` and `/signin`, and **send yourself a sign-in link** — the first
real test of `EMAIL_SERVER` is the first sign-in, and it fails silently from
the application's point of view.

---

## Afterwards

### Backups

Hourly local snapshots are already running (the `backup` service, pruned to 48).
They recover from a bad migration or a mistaken delete. They sit on the same
volume as the database, so they recover from **nothing** that takes the volume
with it. That gap is the largest single tail risk in the architecture: one lost
disk is every user's resumes.

Closing it is Litestream, and `terraform apply` has already created the bucket
it replicates to — `<instance_name>-backups`, in this same tenancy, against the
20 GB Always Free object storage allowance. Three steps are left, and only the
last one proves anything.

**1. Credentials.** These are **Customer Secret Keys**, not API signing keys.
The signing keys are for Oracle's own SDK and will authenticate nothing here;
this is the single most common way this step fails.

```bash
user=$(oci iam user list --query 'data[0].id' --raw-output)
oci iam customer-secret-key create --user-id "$user" --display-name litestream
```

The response's `id` is `LITESTREAM_ACCESS_KEY_ID` and `key` is
`LITESTREAM_SECRET_ACCESS_KEY`. **The secret is shown once.** Put both in
`.env.production` on the instance and nowhere else — in particular not in
`terraform.tfvars`, which is why Terraform does not create them.

**2. Point Litestream at the bucket.** `terraform output` prints both values:

```bash
terraform output litestream_bucket     # -> bucket:
terraform output litestream_endpoint   # -> endpoint:
```

Fill them into `litestream.yml` along with `region`, then uncomment the
`litestream` service in `docker-compose.yml` and `docker compose up -d`.

It stays commented until then on purpose: against an unfilled template
Litestream restart-loops on a bucket that does not exist, which is noise on
the one deploy where you most need the logs readable.

**3. Rehearse the restore. This is the acceptance, not the configuration.**
`docker kill` — never `stop`, because a graceful stop lets Litestream flush,
and flushing was never the case in doubt — destroy the volume, restore, run
`node scripts/backup.mjs verify`, and write the measured RPO and RTO into the
empty table in `docs/RUNBOOK.md`. An untested backup is not a backup.

Any S3-compatible bucket works if you would rather not use Oracle's:
Cloudflare R2 (10 GB, no egress charge), Backblaze B2, Tigris, AWS. Only
`endpoint` and `region` change, and `litestream.yml` documents both.

### Upgrades

```bash
sudo ./deploy/oracle/deploy.sh
```

Snapshot, fetch, rebuild, stop, start. Deliberately **not** a rolling deploy:
`better-sqlite3` is a single writer against one file, and a rolling deploy runs
two containers at once by design. The seconds of downtime are the price of the
rest of `docs/RUNBOOK.md` being true.

### Tearing it down

`terraform destroy` will **refuse**, and that is deliberate. Two resources carry
`prevent_destroy`: the backup bucket, which holds every user's resume data, and
the reserved public IP, which is the address DNS points at. Neither should go
away because somebody ran the wrong command in the wrong directory.

To actually remove them, delete the `lifecycle` block from each in `main.tf`
first — an edit is a deliberate act in a way a flag is not. Release the IP
afterwards if you are not replacing the instance:

```bash
oci network public-ip delete --public-ip-id "$(terraform output -raw public_ip_ocid 2>/dev/null)"
```

### Idle reclamation

Oracle stops Always Free A1 instances whose 95th-percentile CPU **and** network
**and** memory all sit under 20% across a 7-day window — all three, so
exceeding any one is enough. The hourly backup job and Litestream between them
keep disk and network from flatlining.

Do not add a busy loop to game the thresholds. If it bites anyway, move to
Hetzner and run the identical Compose file.

### The optional enhancement model

`bootstrap.sh` deliberately does not run `pnpm enhance:fetch`, and you should
not either. The QA §11 measured pass ran that model in a real browser for the
first time and it does not produce cover-letter prose — it echoes its input,
drops facts, or emits fragments. Without the weights the app says the feature
is unavailable on this deployment and the deterministic Recompose, which needs
no model, is unaffected.

See `docs/QA.md` §11 for the measurements and `docs/enhance feature.md` for
what would have to change.

---

## Files

| File              | What it is                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- |
| `main.tf`         | The VM, its network, and the security list. Always Free by construction.           |
| `cloud-init.yaml` | First boot: Docker, swap, **the iptables rules Oracle's image blocks 80/443 with** |
| `bootstrap.sh`    | Writes `.env.production`, checks DNS, builds, starts. Idempotent.                  |
| `deploy.sh`       | Snapshot, pull, rebuild, stop-then-start. Never rolling.                           |

Two halves of the firewall, in two files, and **neither works alone**: the
security list in `main.tf` opens 80/443 at the VCN, and `cloud-init.yaml`
opens them in the instance's own iptables. Oracle's images ship rules that
accept 22 and reject the rest regardless of the security list. An instance
with only the first half refuses HTTP by dropping the connection, which looks
exactly like a DNS mistake or a container that did not start. It is the single
most common way an Oracle deployment ends up unreachable.
