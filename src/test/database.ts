/**
 * A real SQLite database per test (M2).
 *
 * Built by running the actual migration SQL rather than by pushing the
 * schema, so a migration that does not apply cleanly fails in the test suite
 * rather than on a deploy.
 *
 * Shared by `server/db.test.ts` and `server/resumes.test.ts`. The statement
 * splitting in particular is worth having in one place: Prisma prefixes every
 * statement with a `-- CreateTable` comment, so the comments have to be
 * stripped *before* splitting on `;` — filtering out statements that begin
 * with `--` afterwards silently discards every real one, and the result is an
 * empty database that fails much later with a confusing error.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyPragmas, createPrismaClient } from "@/server/db";
import type { PrismaClient } from "@/generated/prisma/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** The migration SQL, in the order Prisma would apply it. */
export function migrationStatements(): string[] {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const statements: string[] = [];
  for (const dir of dirs) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    const withoutComments = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    for (const statement of withoutComments.split(";")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) statements.push(trimmed);
    }
  }
  return statements;
}

export interface TestDatabase {
  client: PrismaClient;
  /** Disconnects and removes the temporary directory. */
  destroy(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const directory = mkdtempSync(path.join(tmpdir(), "resume-db-"));
  const client = createPrismaClient(`file:${path.join(directory, "test.db")}`);
  await applyPragmas(client);
  for (const statement of migrationStatements()) {
    await client.$executeRawUnsafe(statement);
  }

  return {
    client,
    async destroy() {
      await client.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
