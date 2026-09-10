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
say "Currently at ${previous}"

say "Fetching"
git fetch --quiet origin
git reset --hard --quiet origin/master
current=$(git rev-parse --short HEAD)

if [[ $previous == "$current" ]]; then
  say "Already at ${current}. Nothing to do."
  exit 0
fi
say "Now at ${current}"
git --no-pager log --oneline "${previous}..${current}" | sed 's/^/    /'

say "Building"
docker compose build app backup

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

cat >&2 <<EOF

${RED}Unhealthy after 150 seconds.${OFF}

  docker compose logs --tail 100 app

To go back:

  git reset --hard ${previous}
  docker compose build app && docker compose up -d

A rollback does **not** undo a migration that has already applied. If the new
version migrated the schema, restore the snapshot taken at the top of this
script instead — docs/RUNBOOK.md, "Restoring".
EOF
exit 1
