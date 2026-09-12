/**
 * Self-applying migrations.
 *
 * The test that matters most runs the **real Prisma CLI** against a database
 * this code migrated. "Compatible with Prisma's bookkeeping" is a claim that
 * has to be checked against Prisma, not against a careful reading of what
 * Prisma probably does — and if it were wrong, the symptom would be a
 * `migrate status` that reports drift on a perfectly good production
 * database, at the worst possible moment.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyPendingMigrations, readMigrations, splitStatements } from "./migrate";
import { applyPragmas, createPrismaClient } from "./db";
import { backupFileName, createBackup, verifyBackup } from "./backup";
import type { PrismaClient } from "@/generated/prisma/client";

let directory: string;
let file: string;
let client: PrismaClient;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "resume-migrate-"));
  file = path.join(directory, "test.db");
  client = createPrismaClient(`file:${file}`);
  await applyPragmas(client);
});

afterEach(async () => {
  await client.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("splitStatements", () => {
  it("splits on semicolons between statements", () => {
    expect(splitStatements("CREATE TABLE a (x TEXT);\nCREATE TABLE b (y TEXT);")).toEqual([
      "CREATE TABLE a (x TEXT)",
      "CREATE TABLE b (y TEXT)",
    ]);
  });

  it("strips comments before splitting, not after", () => {
    // Prisma prefixes every statement with `-- CreateTable`. Filtering
    // statements that begin with `--` after splitting discards all of them,
    // and the result is an empty database that fails much later.
    const sql = `-- CreateTable\nCREATE TABLE a (x TEXT);\n-- CreateIndex\nCREATE INDEX i ON a(x);`;
    expect(splitStatements(sql)).toEqual(["CREATE TABLE a (x TEXT)", "CREATE INDEX i ON a(x)"]);
  });

  it("does not split inside a string literal", () => {
    // A half-executed migration is the worst thing to discover in production,
    // and one default value containing a semicolon is all it would take.
    const sql = `INSERT INTO a (x) VALUES ('one; two');\nCREATE TABLE b (y TEXT);`;
    expect(splitStatements(sql)).toEqual([
      "INSERT INTO a (x) VALUES ('one; two')",
      "CREATE TABLE b (y TEXT)",
    ]);
  });

  it("handles an escaped quote inside a string", () => {
    const sql = `INSERT INTO a (x) VALUES ('it''s; fine');`;
    expect(splitStatements(sql)).toEqual(["INSERT INTO a (x) VALUES ('it''s; fine')"]);
  });

  it("ignores a trailing semicolon and blank statements", () => {
    expect(splitStatements("SELECT 1;;\n\n;")).toEqual(["SELECT 1"]);
  });
});

describe("readMigrations", () => {
  it("reads this project's own migrations in order", () => {
    const migrations = readMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(2);
    expect(migrations.map((m) => m.name)).toEqual([...migrations.map((m) => m.name)].sort());
    for (const migration of migrations) {
      expect(migration.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(migration.sql.length).toBeGreaterThan(0);
    }
  });

  it("treats a missing directory as no migrations rather than throwing", () => {
    expect(readMigrations(path.join(directory, "nope"))).toEqual([]);
  });
});

describe("applyPendingMigrations", () => {
  it("creates the whole schema from empty", async () => {
    const outcome = await applyPendingMigrations(client);

    expect(outcome.applied.length).toBeGreaterThanOrEqual(2);
    expect(outcome.alreadyApplied).toEqual([]);

    const tables = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = tables.map((table) => table.name);
    for (const table of ["User", "Resume", "Session", "Account", "VerificationToken"]) {
      expect(names, `missing ${table}`).toContain(table);
    }
  });

  it("is idempotent, which is what makes it safe on every boot", async () => {
    await applyPendingMigrations(client);
    const second = await applyPendingMigrations(client);

    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied.length).toBeGreaterThanOrEqual(2);
  });

  it("applies only what is pending", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all.slice(0, 1));
    const outcome = await applyPendingMigrations(client, all);

    expect(outcome.alreadyApplied).toEqual([all[0]!.name]);
    expect(outcome.applied).toEqual(all.slice(1).map((m) => m.name));
  });

  it("stops when a migration file changed after it was applied", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all);

    const tampered = all.map((migration, index) =>
      index === 0 ? { ...migration, checksum: "0".repeat(64) } : migration,
    );
    // Guessing which of the two is right is how a schema quietly diverges
    // from its own history.
    await expect(applyPendingMigrations(client, tampered)).rejects.toThrow(
      /has changed since it was applied/,
    );
  });

  it("reports a database that is ahead of the running build", async () => {
    await applyPendingMigrations(client);
    const outcome = await applyPendingMigrations(client, readMigrations().slice(0, 1));
    // A rolled-back deploy: the schema knows about a migration this image
    // does not. Worth reporting, not worth refusing to start over.
    expect(outcome.unknownToThisBuild.length).toBeGreaterThan(0);
  });

  it("leaves nothing behind when a migration fails", async () => {
    const broken = [
      {
        name: "99999999999999_broken",
        checksum: "f".repeat(64),
        sql: `CREATE TABLE ok_so_far (x TEXT);\nTHIS IS NOT SQL;`,
      },
    ];

    await expect(applyPendingMigrations(client, broken)).rejects.toThrow();

    // SQLite makes DDL transactional, which is what makes retrying a failed
    // deploy safe rather than a guess about which statements got through.
    const tables = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ok_so_far'",
    );
    expect(tables).toEqual([]);
  });

  it("records nothing for a migration that failed", async () => {
    const broken = [
      { name: "99999999999999_broken", checksum: "f".repeat(64), sql: `NOT SQL AT ALL;` },
    ];
    await expect(applyPendingMigrations(client, broken)).rejects.toThrow();

    await client.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT current_timestamp, applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0)`,
    );
    const rows = await client.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM "_prisma_migrations"`,
    );
    expect(rows.map((row) => row.migration_name)).not.toContain("99999999999999_broken");
  });

  it("survives a directory with no migrations", async () => {
    const outcome = await applyPendingMigrations(client, []);
    expect(outcome.applied).toEqual([]);
  });
});

describe("Prisma's own tooling accepts the result", () => {
  it("reports the database as up to date after we migrated it", async () => {
    await applyPendingMigrations(client);
    await client.$disconnect();

    // The claim under test is compatibility with Prisma, so Prisma is what
    // gets to answer. A wrong checksum or a missing column here would show
    // up in production as spurious drift on a perfectly good database.
    // Node is invoked on the CLI's entry point directly rather than through
    // `pnpm exec`: Node 24 refuses to spawn a .cmd shim without a shell, and
    // going through a shell to run a test is a portability problem of its own.
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const cli = require.resolve("prisma/build/index.js");

    const output = execFileSync(process.execPath, [cli, "migrate", "status"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: `file:${file}` },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(output).toMatch(/up to date|No pending migrations/i);
    expect(output).not.toMatch(/drift|not yet been applied|modified/i);

    client = createPrismaClient(`file:${file}`);
  }, 120_000);
});

describe("a migration directory that is not this project's", () => {
  it("applies a hand-written migration and records it the same way", async () => {
    const custom = path.join(directory, "migrations");
    mkdirSync(path.join(custom, "20200101000000_thing"), { recursive: true });
    writeFileSync(
      path.join(custom, "20200101000000_thing", "migration.sql"),
      "-- CreateTable\nCREATE TABLE thing (id TEXT PRIMARY KEY);\n",
      "utf8",
    );

    const outcome = await applyPendingMigrations(client, readMigrations(custom));
    expect(outcome.applied).toEqual(["20200101000000_thing"]);

    const rows = await client.$queryRawUnsafe<{ applied_steps_count: bigint; checksum: string }[]>(
      `SELECT applied_steps_count, checksum FROM "_prisma_migrations"`,
    );
    // SQLite integers come back as BigInt through the driver adapter.
    expect(Number(rows[0]?.applied_steps_count)).toBe(1);
    expect(rows[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("onBeforeApply — the pre-migration snapshot hook", () => {
  it("does not fire on a first boot, where there is nothing to protect", async () => {
    const calls: string[][] = [];
    const outcome = await applyPendingMigrations(client, readMigrations(), {
      onBeforeApply: async (pending) => void calls.push(pending),
    });

    // Every migration was pending, but the database had no history: an empty
    // volume has no data a snapshot could save, and failing a fresh deploy
    // over one would be the only thing this could achieve.
    expect(outcome.applied.length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("fires once on an upgrade, naming what is about to be applied", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all.slice(0, 1));

    const calls: string[][] = [];
    await applyPendingMigrations(client, all, {
      onBeforeApply: async (pending) => void calls.push(pending),
    });

    expect(calls).toEqual([all.slice(1).map((m) => m.name)]);
  });

  it("does not fire when there is nothing pending", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all);

    const calls: string[][] = [];
    await applyPendingMigrations(client, all, {
      onBeforeApply: async (pending) => void calls.push(pending),
    });

    expect(calls).toEqual([]);
  });

  it("aborts before any DDL runs when the hook throws", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all.slice(0, 1));

    await expect(
      applyPendingMigrations(client, all, {
        onBeforeApply: async () => {
          throw new Error("no backup directory");
        },
      }),
    ).rejects.toThrow("no backup directory");

    // The whole value of failing here: the schema is exactly where it was, so
    // the operator fixes the backup and retries rather than restoring.
    const outcome = await applyPendingMigrations(client, all);
    expect(outcome.alreadyApplied).toEqual([all[0]!.name]);
    expect(outcome.applied).toEqual(all.slice(1).map((m) => m.name));
  });
});

describe("snapshot before migrating, end to end", () => {
  it("writes a real snapshot that opens as a database", async () => {
    const all = readMigrations();
    await applyPendingMigrations(client, all.slice(0, 1));

    const backups = path.join(directory, "backups");
    await applyPendingMigrations(client, all, {
      onBeforeApply: async () => {
        await createBackup(file, path.join(backups, backupFileName()));
      },
    });

    const written = readdirSync(backups);
    expect(written).toHaveLength(1);
    expect(verifyBackup(path.join(backups, written[0]!)).ok).toBe(true);
  });
});
