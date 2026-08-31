# syntax=docker/dockerfile:1

# Deployment image (M0-T13).
#
# Multi-stage so the runtime image carries no toolchain, no source, and no
# dev dependencies — only the standalone server Next emits, the static assets
# it serves, and the two things the server needs at runtime that are not code
# it imports: the migration SQL and the backup tooling.
#
# Note the vendored fonts: `sync-public-fonts` copies them into `public/`
# during the build, and `public/` is gitignored, so the runtime stage must
# copy them from the builder rather than expecting them in the repo. Without
# them the PDF cannot be generated at all.

# Node 24 (LTS). Node 20 reached end of life in April 2026 — an EOL runtime
# stops receiving security patches, which is not a state to ship in. It is
# also what makes `scripts/backup.mjs` able to import a TypeScript module
# directly, with no build step between the operator and a restore.
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prebuild` runs sync-public-fonts, which populates public/fonts and copies
# the pdfjs worker, then `prisma generate`.
RUN pnpm build

# ---- runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/data/app.db" \
    BACKUP_DIR="/data/backups"

# Never run the server as root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The server applies its own pending migrations on first use
# (`src/server/db.ts`), which is why the SQL has to travel with it. Next's
# tracing cannot know about a directory read at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations

# Backups run inside the container, because that is where the volume is.
# Two files and no build step: `node scripts/backup.mjs create --keep 48`.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/backup.mjs ./scripts/backup.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/server/backup.ts ./src/server/backup.ts

# Everything durable lives here: the database, its WAL, and the snapshots.
# Mount a real volume over it — an unmounted VOLUME is a container-lifetime
# directory, which is a database that disappears on the next deploy.
RUN mkdir -p /data/backups && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000

# Checks the database, not just that React rendered. A container serving a
# perfect landing page over a database it cannot open is exactly the state a
# healthcheck exists to catch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
