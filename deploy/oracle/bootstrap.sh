#!/usr/bin/env bash
#
# Turns a bare instance into a running deployment. Idempotent: safe to re-run,
# and re-running is the intended way to fix a half-finished first attempt.
#
# ## What it will not do
#
# It will not invent your domain or your SMTP credentials, and it will not start
# the stack without them. A deployment that comes up on
# the wrong hostname gets a Let's Encrypt certificate for a name nobody uses
# and burns an attempt against a rate limit that is five per week; one without
# EMAIL_SERVER looks perfect until the first person tries to sign in and never
# receives the link. So the first run writes a template, tells you which lines
# to fill, and stops.
#
# It also will not run `pnpm enhance:fetch`. That is deliberate and it is not
# an oversight — see the note where the stack starts, and QA.md §11.
#
#   sudo ./deploy/oracle/bootstrap.sh

set -euo pipefail

APP_DIR="/opt/resume-builder"
ENV_FILE="${APP_DIR}/.env.production"
GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; OFF=$'\033[0m'

say()  { printf '%s==>%s %s\n' "$GREEN" "$OFF" "$*"; }
warn() { printf '%s!!!%s %s\n' "$YELLOW" "$OFF" "$*"; }
die()  { printf '%sxxx%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo — this writes to /opt and talks to the Docker socket."
[[ -d $APP_DIR ]] || die "$APP_DIR does not exist. cloud-init clones it; check /var/log/cloud-init-output.log."

cd "$APP_DIR"

# ---------------------------------------------------------------------------
# 1. The things cloud-init should already have done
# ---------------------------------------------------------------------------
#
# Checked rather than assumed. cloud-init failing part-way is silent from the
# console's point of view — the instance boots, SSH works, and nothing is
# installed — so this is where that gets caught, with the log named.

say "Checking the base image"

command -v docker >/dev/null || die "Docker is not installed. See /var/log/cloud-init-output.log."
docker compose version >/dev/null 2>&1 || die "The Docker compose plugin is missing. See /var/log/cloud-init-output.log."

# The Oracle-specific trap. The VCN security list can be perfectly correct and
# the instance still refuses 80/443, because the image's own iptables rules end
# in a REJECT. Inserting at the top is the fix; `-A` appends *after* the REJECT
# and does nothing at all, which is the version everybody writes first and
# which fails silently — the rule is listed and the port is still closed.
#
# Re-runnable: `-C` asks whether the exact rule already exists, so a second run
# does not stack duplicates.
ensure_port() {
  local port=$1
  if iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    printf '%s    port %s already open locally%s\n' "$DIM" "$port" "$OFF"
    return
  fi
  warn "Port $port was not open in the instance's own firewall. Opening it."
  iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
  netfilter-persistent save >/dev/null
}
ensure_port 80
ensure_port 443

if ! swapon --show | grep -q '/swapfile'; then
  warn "No swap. Creating 2G — the PDF worker allocates in bursts."
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# ---------------------------------------------------------------------------
# 2. The environment
# ---------------------------------------------------------------------------

if [[ ! -f $ENV_FILE ]]; then
  say "Writing $ENV_FILE"

  # Generated here and never anywhere else. Not in Terraform state, not in a
  # repository, not in this script's output. Rotating it signs everyone out,
  # so it is generated once and then left alone.
  secret=$(openssl rand -base64 32)

  cat >"$ENV_FILE" <<EOF
# Written by deploy/oracle/bootstrap.sh. Fill in every FILL_ME and re-run it.
#
# Not in git, and it must never be: AUTH_SECRET below is the key that signs
# every session cookie.

# ---- Generated. Leave alone. ----------------------------------------------
AUTH_SECRET="${secret}"

# ---- Required. The deploy will not start without these. -------------------

# The public origin, https. Auth.js builds sign-in callbacks from it; behind a
# proxy that does not normalise Host, leaving it unset lets a forged header
# send a working sign-in link somewhere else.
AUTH_URL="https://FILL_ME"

# The hostname Caddy serves and gets a certificate for. Same host as AUTH_URL:
# a mismatch produces a valid certificate for an origin nothing is served on.
SITE_DOMAIN="FILL_ME"

# The one third party that sees a user's address (D6). The message carries a
# login link and never resume content. Brevo's free tier is 300 a day, which
# is 300 sign-ins; Resend's is 3,000 a month. Both are plain SMTP, so nothing
# in the application changes between them.
EMAIL_SERVER="smtp://USER:PASSWORD@smtp-relay.brevo.com:587"
EMAIL_FROM="Resume Builder <no-reply@FILL_ME>"

# ---- Optional -------------------------------------------------------------

# Google sign-in. Both or neither: half-configured renders a button that fails
# after redirecting away from the site. The redirect URI to register is
# <AUTH_URL>/api/auth/callback/google, and Google refuses hosts on the Public
# Suffix List — so a *.duckdns.org name cannot be made to work here, whatever
# else it can do (docs/BLOCKERS.md, B3).
# AUTH_GOOGLE_ID=
# AUTH_GOOGLE_SECRET=

# Off-site replication (D9). Only read once the litestream service in
# docker-compose.yml is uncommented, and only after the restore rehearsal in
# RUNBOOK.md has actually been run. An untested backup is not a backup.
# LITESTREAM_ACCESS_KEY_ID=
# LITESTREAM_SECRET_ACCESS_KEY=
EOF
  chmod 600 "$ENV_FILE"
fi

if grep -q 'FILL_ME' "$ENV_FILE"; then
  cat <<EOF

$(printf '%s' "$YELLOW")Stopping here, and that is the correct outcome.$(printf '%s' "$OFF")

  $ENV_FILE still contains FILL_ME. Fill in:

    SITE_DOMAIN    the hostname whose A record points at this machine
    AUTH_URL       https:// followed by the same hostname
    EMAIL_SERVER   an SMTP URL — Brevo (300/day) or Resend (3,000/month)
    EMAIL_FROM     an address at a domain you control

  Then run this script again.

  Do not start the stack before DNS resolves to this instance. Caddy asks
  Let's Encrypt for a certificate as soon as it starts, and failed attempts
  count against a limit of five per hostname per week.

    dig +short \$SITE_DOMAIN     should print this instance's public IP

EOF
  exit 1
fi

# ---------------------------------------------------------------------------
# 3. Pre-flight
# ---------------------------------------------------------------------------

set -a; source "$ENV_FILE"; set +a

say "Checking DNS before asking Let's Encrypt for anything"
public_ip=$(curl -fsS --max-time 10 https://api.ipify.org || echo "")
resolved=$(getent hosts "$SITE_DOMAIN" | awk '{print $1}' | head -1 || echo "")

if [[ -z $resolved ]]; then
  die "$SITE_DOMAIN does not resolve. Add the A record and wait; nothing below will work without it."
elif [[ -n $public_ip && $resolved != "$public_ip" ]]; then
  warn "$SITE_DOMAIN resolves to $resolved but this machine is $public_ip."
  warn "If that is a CDN in front of us, fine. If it is a stale record, stop and fix it:"
  warn "Caddy will fail the ACME challenge and you get five attempts a week."
  read -r -p "    Continue anyway? [y/N] " reply < /dev/tty
  [[ ${reply,,} == y ]] || exit 1
else
  printf '%s    %s -> %s%s\n' "$DIM" "$SITE_DOMAIN" "$resolved" "$OFF"
fi

# ---------------------------------------------------------------------------
# 4. Start
# ---------------------------------------------------------------------------
#
# ## Why `pnpm enhance:fetch` is not here
#
# The optional local cover-letter model is **not** vendored, and this is a
# decision with evidence behind it rather than a default nobody revisited. The
# QA §11 measured pass ran `Xenova/flan-t5-small` in a real browser for the
# first time and found that it does not produce cover-letter prose: it echoes
# its input, drops facts, or emits fragments. The guardrail catches the
# dangerous failures and cannot catch a merely useless rewrite.
#
# Without the weights the app says the feature is unavailable on this
# deployment and the deterministic Recompose — which needs no model — works
# exactly as before. That is the supported state and it is the right one until
# a model passes §11. See docs/QA.md and docs/enhance feature.md.

# Build here, or pull what CI built?
#
# The Always Free A1 can build its own image. The other Always Free shape,
# E2.1.Micro, cannot: an eighth of an OCPU and 1 GB of memory runs the
# standalone server fine but does not finish `next build`. When APP_IMAGE names
# a published image we pull it; otherwise we build as before.
#
# APP_IMAGE lives in ./.env, which is the file Compose reads for substitution —
# not .env.production, which is the one handed to the container.
if [[ -f .env ]] && grep -q '^APP_IMAGE=' .env; then
  say "Pulling the image CI built ($(grep '^APP_IMAGE=' .env | cut -d= -f2-))"
  docker compose pull app
else
  say "Building the image (this takes a while on a small instance)"
  docker compose build
fi

say "Starting"
docker compose up -d --remove-orphans
systemctl enable resume-builder.service >/dev/null 2>&1 || true

say "Waiting for the app to answer its own health check"
for attempt in $(seq 1 60); do
  if docker compose exec -T app node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      2>/dev/null; then
    say "Healthy after ${attempt}0s"
    break
  fi
  [[ $attempt -eq 60 ]] && die "Never became healthy. docker compose logs app"
  sleep 10
done

cat <<EOF

$(printf '%s' "$GREEN")Running.$(printf '%s' "$OFF")  https://${SITE_DOMAIN}

Check, in this order — each one fails differently and the order matters:

  1. curl -fsS https://${SITE_DOMAIN}/api/health
     Touches the database, so a pass means more than "a page rendered".
     If TLS fails here: docker compose logs caddy, and read the ACME error.

  2. Open https://${SITE_DOMAIN}/ and https://${SITE_DOMAIN}/signin

  3. Send yourself a sign-in link. The first real test of EMAIL_SERVER is the
     first sign-in — there is no earlier signal, and it fails silently from
     the app's point of view.

Then, before you tell anyone about it:

  - docs/RUNBOOK.md, "Backups": local snapshots are already running hourly.
    Off-site replication is still owed, and the rehearsal is the acceptance.
  - docs/QA.md has the checks no automated suite can do.

EOF
