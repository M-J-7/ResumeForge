/**
 * Applying migrations at startup (production readiness).
 *
 * ## Why this exists at all
 *
 * The runtime image is Next's standalone output: the app server and nothing
 * else. Putting the Prisma CLI in it to run `migrate deploy` means shipping
 * the CLI, its query engine, and a TypeScript config loader — tens of
 * megabytes and a second toolchain — so that a container can run one command
 * against a single-writer SQLite file. The alternative, running the command
 * by hand before each deploy, is a step that gets forgotten exactly once and
 * then serves 500s until somebody notices.
 *
 * So the server applies its own migrations, and does it in a way Prisma's own
 * tooling still recognises: same `_prisma_migrations` table, same columns,
 * same checksum (SHA-256 of the migration file's bytes). `prisma migrate
 * status` against a database migrated by this code reports it up to date —
 * asserted in `migrate.test.ts` by running the real CLI, because "compatible
 * with Prisma" is a claim that has to be checked against Prisma rather than
 * against my reading of it.
 *
 * ## What it will not do
 *
 * It applies pending migrations and nothing else. It does not generate them,
 * does not diff the schema, does not roll anything back, and does not touch a
 * migration that has already been applied. If a migration file changed after
 * being applied, it stops — a checksum mismatch means the file on disk is not
 * what produced the database, and guessing which one is right is how a schema
 * quietly diverges from its own history.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";

/** Prisma's own bookkeeping table, created exactly as Prisma creates it. */
const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

export const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

export interface Migration {
  /** Directory name, which is also what Prisma records. */
  name: string;
  /** SHA-256 of the file's bytes, hex. Prisma's definition, verified. */
  checksum: string;
  sql: string;
}

/**
 * Splits a migration file into statements.
 *
 * Quote-aware rather than a plain `split(";")`. Prisma's SQLite output does
 * not currently contain a semicolon inside a string literal, but a default
 * value or a seeded row could add one at any time, and the failure would be a
 * half-executed migration — the worst possible thing to discover in
 * production. Comments are stripped first: every statement Prisma emits is
 * preceded by a `-- CreateTable` line, so filtering statements that *start*
 * with `--` after splitting silently discards all of them.
 */
export function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements: string[] = [];
  let current = "";
  let inString = false;

  for (let index = 0; index < withoutComments.length; index += 1) {
    const char = withoutComments[index]!;

    if (inString) {
      current += char;
      // '' is an escaped quote inside a SQL string, not the end of one.
      if (char === "'") {
        if (withoutComments[index + 1] === "'") {
          current += "'";
          index += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }

    if (char === ";") {
      if (current.trim().length > 0) statements.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) statements.push(current.trim());
  return statements;
}

/** Every migration on disk, in the order Prisma would apply them. */
export function readMigrations(directory: string = MIGRATIONS_DIR): Migration[] {
  let names: string[];
  try {
    names = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    // No migrations directory is a deployment mistake, not a state to
    // silently tolerate — but it is the caller's to report, with context.
    return [];
  }

  return names.map((name) => {
    const bytes = readFileSync(path.join(directory, name, "migration.sql"));
    return {
      name,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      sql: bytes.toString("utf8"),
    };
  });
}

interface AppliedRow {
  migration_name: string;
  checksum: string;
  finished_at: unknown;
  rolled_back_at: unknown;
}

export interface MigrationOutcome {
  applied: string[];
  alreadyApplied: string[];
  /** In the database but not on disk — the image is older than the schema. */
  unknownToThisBuild: string[];
}

export class MigrationChecksumError extends Error {
  constructor(name: string) {
    super(
      `Migration "${name}" has changed since it was applied. The file on disk is not what ` +
        `produced this database. Restore the original file, or create a new migration — ` +
        `never edit one that has shipped.`,
    );
    this.name = "MigrationChecksumError";
  }
}

/**
 * Brings the database up to date. Idempotent, and safe to call on every boot.
 *
 * Each migration runs inside a transaction. SQLite makes DDL transactional,
 * so a migration that fails halfway leaves nothing behind — which is what
 * makes retrying a failed deploy safe rather than a second guess about which
 * statements got through.
 */
export interface ApplyOptions {
  /**
   * Runs once, after it is known that migrations will be applied and before
   * the first one is. Not called when there is nothing pending, and not
   * called on a database with no migration history — a first boot has an
   * empty schema, so there is nothing a snapshot could protect.
   *
   * Passed the names about to be applied. Throwing aborts before any DDL
   * runs, which is the point: a caller that cannot take its safety snapshot
   * gets to decide whether to proceed, and it decides while the schema is
   * still untouched.
   */
  onBeforeApply?: (pending: string[]) => Promise<void>;
}

export async function applyPendingMigrations(
  client: PrismaClient,
  migrations: Migration[] = readMigrations(),
  { onBeforeApply }: ApplyOptions = {},
): Promise<MigrationOutcome> {
  await client.$executeRawUnsafe(MIGRATIONS_TABLE_DDL);

  const rows = await client.$queryRawUnsafe<AppliedRow[]>(
    `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`,
  );
  const applied = new Map(rows.map((row) => [row.migration_name, row]));

  const outcome: MigrationOutcome = {
    applied: [],
    alreadyApplied: [],
    unknownToThisBuild: rows
      .map((row) => row.migration_name)
      .filter((name) => !migrations.some((migration) => migration.name === name)),
  };

  // Worked out in a pass of its own so `onBeforeApply` can run while the
  // schema is still untouched. Interleaving it with the apply loop would call
  // the hook after the first migration had already landed, which is precisely
  // the state a pre-migration snapshot is supposed to predate.
  const isFinished = (row: AppliedRow | undefined): boolean =>
    row !== undefined && row.finished_at !== null && row.rolled_back_at === null;
  const pending = migrations
    .filter((migration) => !isFinished(applied.get(migration.name)))
    .map((migration) => migration.name);

  // `rows.length > 0` distinguishes an upgrade from a first boot. On an empty
  // volume every migration is pending and there is no data to lose, so a
  // snapshot there would only be a way for a fresh deploy to fail.
  if (pending.length > 0 && rows.length > 0 && onBeforeApply) {
    await onBeforeApply(pending);
  }

  for (const migration of migrations) {
    const row = applied.get(migration.name);

    if (row && row.finished_at !== null && row.rolled_back_at === null) {
      if (row.checksum !== migration.checksum) throw new MigrationChecksumError(migration.name);
      outcome.alreadyApplied.push(migration.name);
      continue;
    }

    const statements = splitStatements(migration.sql);
    const startedAt = Date.now();

    await client.$transaction(async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }
      // A previous attempt may have left an unfinished row behind.
      await tx.$executeRawUnsafe(
        `DELETE FROM "_prisma_migrations" WHERE migration_name = ?`,
        migration.name,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
        randomUUID(),
        migration.checksum,
        Date.now(),
        migration.name,
        startedAt,
        // Prisma records 1 per migration file, not one per statement — the
        // rows it wrote for this project's own migrations say so. Matching it
        // matters only because `migrate status` reads this table back.
        1,
      );
    });

    outcome.applied.push(migration.name);
  }

  return outcome;
}
