/**
 * Prisma CLI configuration (M2-T1).
 *
 * Prisma 7 no longer accepts `url` inside the schema's datasource block. The
 * connection string for migration and introspection commands lives here; the
 * runtime client gets a driver adapter instead (`src/server/db.ts`).
 *
 * `.env` is loaded explicitly — Prisma 7 does not read it on its own, and the
 * failure mode otherwise is an unresolved-variable error that reads like a
 * missing config rather than a missing file.
 */

import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
