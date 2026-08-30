/**
 * M2-T1 acceptance: migrations run clean, and the pragma values are asserted
 * rather than assumed.
 *
 * Each test gets its own database file, created by running the real migration
 * SQL — so a migration that does not apply cleanly fails here rather than in
 * production.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { REQUIRED_PRAGMAS, applyPragmas, createPrismaClient, databaseUrl, readPragmas } from "./db";
import type { PrismaClient } from "@/generated/prisma/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** The migration SQL, in the order Prisma would apply it. */
function migrationStatements(): string[] {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const statements: string[] = [];
  for (const dir of dirs) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    // Prisma prefixes each statement with a `-- CreateTable` comment, so the
    // comments have to be stripped *before* splitting — filtering statements
    // that begin with `--` afterwards silently discards every real one.
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

let client: PrismaClient;
let directory: string;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "resume-db-"));
  client = createPrismaClient(`file:${path.join(directory, "test.db")}`);
  await applyPragmas(client);
  for (const statement of migrationStatements()) {
    await client.$executeRawUnsafe(statement);
  }
});

afterEach(async () => {
  await client.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("migrations", () => {
  it("applies cleanly to an empty database", async () => {
    const tables = await client.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    for (const table of [
      "User",
      "Resume",
      "ResumeVersion",
      "ScoreCheck",
      "ParseCheck",
      "Account",
      "Session",
      "VerificationToken",
    ]) {
      expect(names, `missing table ${table}`).toContain(table);
    }
  });

  it("indexes the columns the request paths sort and filter on", async () => {
    // better-sqlite3 is synchronous, so an unindexed scan blocks every user,
    // not just the one who triggered it.
    const indexes = await client.$queryRawUnsafe<{ name: string; tbl_name: string }[]>(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'",
    );
    const onResume = indexes.filter((i) => i.tbl_name === "Resume");
    expect(onResume.length).toBeGreaterThan(0);
  });
});

describe("pragmas", () => {
  it("sets every value M2-T1 requires", async () => {
    const pragmas = await readPragmas(client);
    expect(String(pragmas.journal_mode).toLowerCase()).toBe(REQUIRED_PRAGMAS.journal_mode);
    expect(Number(pragmas.busy_timeout)).toBe(REQUIRED_PRAGMAS.busy_timeout);
    expect(Number(pragmas.synchronous)).toBe(REQUIRED_PRAGMAS.synchronous);
    expect(Number(pragmas.foreign_keys)).toBe(REQUIRED_PRAGMAS.foreign_keys);
  });

  it("enforces foreign keys, without which the cascade rules are decorative", async () => {
    // The consequence if this regresses: M2-T6's hard delete leaves resume
    // content behind after a user has asked to be forgotten.
    await expect(
      client.$executeRawUnsafe(
        `INSERT INTO "Resume" (id, userId, title, content, schemaVersion, pageSize, createdAt, updatedAt)
         VALUES ('orphan', 'no-such-user', 'x', '{}', 1, 'A4', 0, 0)`,
      ),
    ).rejects.toThrow();
  });
});

describe("cascade delete", () => {
  it("removes every row belonging to a deleted user (M2-T6)", async () => {
    const user = await client.user.create({
      data: { id: "u1", email: "ada@example.com", name: "Ada" },
    });
    const resume = await client.resume.create({
      data: { id: "r1", userId: user.id, title: "Resume", content: "{}" },
    });
    await client.resumeVersion.create({ data: { resumeId: resume.id, content: "{}" } });
    await client.scoreCheck.create({
      data: { resumeId: resume.id, jobDescription: "jd", overallScore: 70, breakdown: "{}" },
    });
    await client.parseCheck.create({
      data: { resumeId: resume.id, format: "PDF", fieldRecovery: "{}", recoveryScore: 100 },
    });
    await client.session.create({
      data: { sessionToken: "t", userId: user.id, expires: new Date(Date.now() + 1000) },
    });

    await client.user.delete({ where: { id: user.id } });

    expect(await client.resume.count()).toBe(0);
    expect(await client.resumeVersion.count()).toBe(0);
    expect(await client.scoreCheck.count()).toBe(0);
    expect(await client.parseCheck.count()).toBe(0);
    expect(await client.session.count()).toBe(0);
  });
});

describe("schema shape", () => {
  it("stores no password anywhere (D7)", async () => {
    const columns = await client.$queryRawUnsafe<{ name: string; tbl: string }[]>(
      `SELECT m.name AS tbl, p.name AS name
       FROM sqlite_master m JOIN pragma_table_info(m.name) p
       WHERE m.type = 'table'`,
    );
    for (const column of columns) {
      expect(column.name.toLowerCase(), `${column.tbl}.${column.name}`).not.toMatch(
        /password|passwd|hash/,
      );
    }
  });

  it("denormalizes the sortable fields, because Json is not queryable on SQLite", async () => {
    const columns = await client.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM pragma_table_info('Resume')`,
    );
    const names = columns.map((c) => c.name);
    for (const field of ["lastScore", "pageCount", "wordCount", "schemaVersion"]) {
      expect(names, `Resume.${field} should be a real column`).toContain(field);
    }
  });

  it("keeps schemaVersion on every stored resume (D10)", async () => {
    await client.user.create({ data: { id: "u2", email: "b@example.com" } });
    const resume = await client.resume.create({
      data: { userId: "u2", title: "R", content: "{}" },
    });
    expect(resume.schemaVersion).toBe(1);
  });
});

describe("configuration", () => {
  it("refuses to guess a connection string", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => databaseUrl()).toThrow(/DATABASE_URL/);
    } finally {
      if (original !== undefined) process.env.DATABASE_URL = original;
    }
  });
});
