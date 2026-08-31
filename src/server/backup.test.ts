/**
 * The restore rehearsal (M2-T5).
 *
 * M2-T5's acceptance is a *rehearsed* restore, not a configured one. This is
 * that rehearsal, run on every push: seed real rows, take a snapshot while
 * the database is open and being written to, verify it, restore it to a fresh
 * path, and confirm the restored file holds exactly what the original did and
 * can still be queried through Prisma.
 *
 * The failure this is really guarding against is the quiet one. A backup
 * taken by copying a live file usually opens, usually passes a glance, and is
 * missing the last transactions — and you find out during the incident.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { copyFileSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  backupFileName,
  createBackup,
  databaseFilePath,
  restoreBackup,
  sameContents,
  verifyBackup,
} from "./backup";
import { applyPragmas, createPrismaClient } from "./db";
import { applyPendingMigrations } from "./migrate";
import { createResume } from "./resumes";
import { midCareerResume, fresherResume } from "@/test/fixtures/resumes";
import type { PrismaClient } from "@/generated/prisma/client";

let directory: string;
let livePath: string;
let client: PrismaClient;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "resume-backup-"));
  livePath = path.join(directory, "app.db");
  client = createPrismaClient(`file:${livePath}`);
  await applyPragmas(client);
  await applyPendingMigrations(client);

  await client.user.create({ data: { id: "u1", email: "ada@example.com", name: "Ada" } });
  await createResume("u1", { document: midCareerResume, title: "Backend" }, client);
  await createResume("u1", { document: fresherResume, title: "Graduate" }, client);
});

afterEach(async () => {
  await client.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("databaseFilePath", () => {
  it.each([
    ["file:./app.db", path.resolve("./app.db")],
    ["file:/data/app.db", path.resolve("/data/app.db")],
    ["/data/app.db", path.resolve("/data/app.db")],
  ])("resolves %s", (url, expected) => {
    expect(databaseFilePath(url)).toBe(expected);
  });
});

describe("backupFileName", () => {
  it("sorts chronologically and survives a shell glob", () => {
    const early = backupFileName(new Date("2026-08-31T09:00:00.000Z"));
    const late = backupFileName(new Date("2026-08-31T10:00:00.000Z"));
    expect([late, early].sort()).toEqual([early, late]);
    expect(early).not.toMatch(/[:*?"<>|]/);
  });
});

describe("taking a backup of a live database", () => {
  it("copies committed state while the connection is still open", async () => {
    const destination = path.join(directory, "backups", backupFileName());
    const result = await createBackup(livePath, destination);

    expect(result.bytes).toBeGreaterThan(0);
    const verification = verifyBackup(result.path);
    expect(verification.ok, verification.problems.join("; ")).toBe(true);
    expect(verification.tables.Resume).toBe(2);
    expect(verification.tables.User).toBe(1);
  });

  it("includes writes made moments earlier, including those still in the WAL", async () => {
    // The failure mode being ruled out: a snapshot that opens cleanly and is
    // silently missing the last transactions.
    await createResume("u1", { document: midCareerResume, title: "Third" }, client);

    const destination = path.join(directory, "after.db");
    await createBackup(livePath, destination);

    expect(verifyBackup(destination).tables.Resume).toBe(3);
  });

  it("records the migrations the snapshot was taken at", async () => {
    const destination = path.join(directory, "dated.db");
    await createBackup(livePath, destination);
    // Without this, a restore cannot be dated against the code that will run
    // on top of it.
    expect(verifyBackup(destination).migrations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("verification", () => {
  it("rejects a file that is not a database at all", () => {
    const junk = path.join(directory, "junk.db");
    writeFileSync(junk, "this is not a database", "utf8");
    expect(() => verifyBackup(junk)).toThrow();
  });

  it("rejects a structurally sound database that is missing our tables", () => {
    // `PRAGMA integrity_check` alone would pass this. An empty-but-valid file
    // is exactly what a mistimed copy produces, so counting matters as much
    // as checking.
    const empty = path.join(directory, "empty.db");
    const db = new Database(empty);
    db.exec("CREATE TABLE unrelated (x TEXT)");
    db.close();

    const verification = verifyBackup(empty);
    expect(verification.ok).toBe(false);
    expect(verification.problems.join(" ")).toMatch(/missing|migration history/);
  });

  it("notices a truncated file", async () => {
    const destination = path.join(directory, "truncated.db");
    await createBackup(livePath, destination);
    // Half a database is the shape a interrupted `cp` leaves behind, and it
    // must not be mistaken for a usable snapshot.
    truncateSync(destination, 4096);
    expect(() => verifyBackup(destination)).toThrow();
  });
});

describe("restore", () => {
  it("restores to a new path and preserves every row", async () => {
    const backupPath = path.join(directory, "snapshot.db");
    await createBackup(livePath, backupPath);
    const before = verifyBackup(backupPath);

    const restoredPath = path.join(directory, "restored.db");
    const result = await restoreBackup(backupPath, restoredPath);

    expect(result.verification.ok, result.verification.problems.join("; ")).toBe(true);
    expect(sameContents(before, result.verification)).toBe(true);
  });

  it("produces a database the app can actually serve from", async () => {
    // Row counts are necessary and not sufficient: the restored file has to
    // work through the same client the server uses, with the same pragmas.
    const backupPath = path.join(directory, "snapshot.db");
    await createBackup(livePath, backupPath);
    const restoredPath = path.join(directory, "restored.db");
    await restoreBackup(backupPath, restoredPath);

    const restoredClient = createPrismaClient(`file:${restoredPath}`);
    try {
      await applyPragmas(restoredClient);
      const resumes = await restoredClient.resume.findMany({ orderBy: { title: "asc" } });
      expect(resumes.map((resume) => resume.title)).toEqual(["Backend", "Graduate"]);

      // And it is still migratable, so the next deploy on top of a restore
      // does not need special handling.
      const outcome = await applyPendingMigrations(restoredClient);
      expect(outcome.applied).toEqual([]);
    } finally {
      await restoredClient.$disconnect();
    }
  });

  it("refuses to write over an existing file", async () => {
    const backupPath = path.join(directory, "snapshot.db");
    await createBackup(livePath, backupPath);
    const occupied = path.join(directory, "occupied.db");
    copyFileSync(backupPath, occupied);

    // Restoring over the live database destroys the only other copy at the
    // exact moment you have least slack.
    await expect(restoreBackup(backupPath, occupied)).rejects.toThrow(/Refusing to overwrite/);
  });

  it("refuses to restore a backup over itself", async () => {
    const backupPath = path.join(directory, "snapshot.db");
    await createBackup(livePath, backupPath);
    await expect(restoreBackup(backupPath, backupPath)).rejects.toThrow(/over itself/);
  });

  it("refuses to present an unusable backup as a restore", async () => {
    const junk = path.join(directory, "not-ours.db");
    const db = new Database(junk);
    db.exec("CREATE TABLE unrelated (x TEXT)");
    db.close();

    await expect(restoreBackup(junk, path.join(directory, "out.db"))).rejects.toThrow(
      /not restorable/,
    );
  });
});

describe("the measured rehearsal", () => {
  it("completes a full take-verify-restore cycle and reports how long it took", async () => {
    // This is M2-T5's acceptance, executed rather than documented. The
    // numbers are logged so the runbook's RTO column can be filled from a
    // real run rather than an estimate.
    const backupPath = path.join(directory, "rehearsal.db");
    const restoredPath = path.join(directory, "rehearsal-restored.db");

    const backup = await createBackup(livePath, backupPath);
    const verification = verifyBackup(backupPath);
    const restored = await restoreBackup(backupPath, restoredPath);

    expect(verification.ok).toBe(true);
    expect(restored.verification.ok).toBe(true);
    expect(sameContents(verification, restored.verification)).toBe(true);

    console.info(
      `[backup rehearsal] ${backup.bytes} bytes | backup ${backup.durationMs}ms | ` +
        `restore ${restored.durationMs}ms | resumes ${verification.tables.Resume}`,
    );
    // Not a benchmark, a smoke alarm: a snapshot of a small database taking
    // minutes means something is very wrong with the volume.
    expect(backup.durationMs).toBeLessThan(30_000);
  });
});
