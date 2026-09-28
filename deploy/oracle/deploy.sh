#!/usr/bin/env bash
#
# Ship a new version.
#
# ## Stop, then start. Never both at once
#
# `better-sqlite3` is a single writer against one file. A rolling deploy runs
# the old and the new container together by design, which is two writers, and
# two writers against one SQLite file is data loss rather than contention.
# So this takes the app down for the seconds a container takes to start, and
# those seconds are the price of the rest of docs/RUNBOOK.md being true.
#
# Caddy stays up throughout, so the outage is a 502 rather than a dead name.
#
#   sudo ./deploy/oracle/deploy.sh

set -euo pipefail

APP_DIR="/opt/resume-builder"
GREEN=$'\033[32m'; RED=$'\033[31m'; OFF=$'\033[0m'
say() { printf '%s==>%s %s\n' "$GREEN" "$OFF" "$*"; }
die() { printf '%sxxx%s %s\n' "$RED" "$OFF" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."
cd "$APP_DIR"

say "Snapshot first"
# Before the code changes, not after. A deploy that ships a migration which
# narrows a column is the case this exists for, and by the time it has gone
# wrong the pre-deploy state is the only thing worth having.
docker compose exec -T app node scripts/backup.mjs create --keep 48

previous=$(git rev-parse --short HEAD)
previous_full=$(git rev-parse HEAD)
say "Currently at ${previous}"

say "Fetching"
git fetch --quiet origin
target=$(git rev-parse origin/master)
current=$(git rev-parse --short "$target")

if [[ $previous == "$current" ]]; then
  say "Already at ${current}. Nothing to do."
  exit 0
fi
say "Deploying ${current}"
git --no-pager log --oneline "${previous}..${current}" | sed 's/^/    /'

# Pull what CI built, or build here — the same choice bootstrap.sh makes.
#
# This used to build unconditionally, and the E2.1.Micro this runs on cannot
# finish `next build`: the first deploy after bootstrap would have hung or
# been killed for memory. When ./.env names a published image, pull it.
#
# Pulled by *commit*, not by `latest`. CI tags every publish with the full sha
# (.github/workflows/ci.yml), and `latest` is whichever publish finished last —
# which, a minute after a push, is still the previous commit. Deploying
# `latest` would restart onto old code and report success. The pinned image is
# then tagged locally under the name ./.env uses, so a later hand-typed
# `docker compose up` runs what was deployed rather than a stale `latest`.
#
# The image is fetched before the checkout moves, so a commit CI has not
# published yet stops here with the instance exactly as it was.
image=""
if [[ -f .env ]] && grep -q '^APP_IMAGE=' .env; then
  image=$(grep '^APP_IMAGE=' .env | tail -n 1 | cut -d= -f2- | tr -d "\"'")
  repo=$image
  # Strip a tag, but not a registry port: only a colon in the last segment is one.
  [[ ${image##*/} == *:* ]] && repo=${image%:*}
  pinned="${repo}:${target}"

  say "Pulling ${pinned}"
  docker pull --quiet "$pinned" >/dev/null \
    || die "No image for ${current} yet. Wait for CI's publish job on master, then re-run."
  docker tag "$pinned" "$image"
fi

git reset --hard --quiet origin/master
say "Checked out ${current}"

# The Dockerfile refuses to build without the public origin — the content
# pages are prerendered and bake it into their canonical links — and AUTH_URL
# in .env.production is that origin.
# Tolerant of a missing line: under `pipefail` a grep that matches nothing
# would end the deploy here, including a pull that never needed the value.
site_url=$({ grep '^AUTH_URL=' .env.production 2>/dev/null || true; } | tail -n 1 | cut -d= -f2- | tr -d "\"'")

if [[ -z $image ]]; then
  say "Building"
  NEXT_PUBLIC_SITE_URL="$site_url" docker compose build app backup
fi

# Pending migrations are applied by the server on first use
# (src/server/db.ts), inside a transaction, using Prisma's own
# _prisma_migrations table. There is no separate migrate step to forget, and a
# migration that fails leaves nothing behind — so a retry is safe rather than
# a guess.
say "Restarting"
docker compose up -d --remove-orphans

say "Waiting for health"
for attempt in $(seq 1 30); do
  if docker compose exec -T app node -e \
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      2>/dev/null; then
    say "Healthy. Deployed ${previous} -> ${current}"
    exit 0
  fi
  sleep 5
done

if [[ -n $image ]]; then
  # CI published the previous commit under its sha, so going back is a pull
  # and a retag rather than a rebuild the instance cannot do. The pull is a
  # no-op when an earlier deploy already fetched it.
  restore_image="docker pull ${repo}:${previous_full} && docker tag ${repo}:${previous_full} ${image}"
else
  restore_image="NEXT_PUBLIC_SITE_URL=${site_url} docker compose build app backup"
fi

cat >&2 <<EOF

${RED}Unhealthy after 150 seconds.${OFF}

  docker compose logs --tail 100 app

To go back:

  git reset --hard ${previous}
  ${restore_image}
  docker compose up -d

A rollback does **not** undo a migration that has already applied. If the new
version migrated the schema, restore the snapshot taken at the top of this
script instead — docs/RUNBOOK.md, "Restoring".
EOF
exit 1
