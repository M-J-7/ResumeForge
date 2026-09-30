/**
 * Snapshots leave nothing beside them, and pruning takes what they left.
 *
 * Found on the live instance on 2026-09-30: `/data/backups` held the 48
 * snapshots it should and 894 `-wal`/`-shm` files it should not, two more
 * every hour. A snapshot copied the live database's WAL flag, so every open —
 * the verify straight after each backup — made a pair beside it, and pruning
 * deleted the snapshot and never the pair. `backup.ts` now takes snapshots
 * out of WAL mode as they are written and sweeps orphans when it prunes.
 */

import Database from "better-sqlite3";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBackup, pruneBackups, verifyBackup } from "./backup";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "backup-sidecars-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

/** A WAL-mode database with a row in it, as the live one is. */
function liveDatabase(): string {
  const file = path.join(directory, "live.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES ('u1');`);
  db.close();
  return file;
}

describe("createBackup", () => {
  it("writes a snapshot that is not in WAL mode, so opening it leaves no sidecars", async () => {
    const source = liveDatabase();
    const snapshotDir = path.join(directory, "backups");
    const snapshot = path.join(snapshotDir, "app-2026-09-30T00-00-00-000Z.db");

    await createBackup(source, snapshot);
    verifyBackup(snapshot);
    verifyBackup(snapshot);

    const db = new Database(snapshot, { readonly: true });
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.close();
    expect(readdirSync(snapshotDir)).toEqual(["app-2026-09-30T00-00-00-000Z.db"]);
  });
});

describe("pruneBackups", () => {
  function touch(name: string) {
    writeFileSync(path.join(directory, name), "");
  }

  it("keeps the newest hourly snapshots and takes the rest with their sidecars", () => {
    for (const hour of ["01", "02", "03", "04"]) {
      touch(`app-2026-09-30T${hour}-00-00-000Z.db`);
      touch(`app-2026-09-30T${hour}-00-00-000Z.db-wal`);
      touch(`app-2026-09-30T${hour}-00-00-000Z.db-shm`);
    }

    const removed = pruneBackups(directory, 2);

    expect(removed.snapshots).toEqual([
      "app-2026-09-30T01-00-00-000Z.db",
      "app-2026-09-30T02-00-00-000Z.db",
    ]);
    expect(readdirSync(directory).sort()).toEqual([
      "app-2026-09-30T03-00-00-000Z.db",
      "app-2026-09-30T03-00-00-000Z.db-shm",
      "app-2026-09-30T03-00-00-000Z.db-wal",
      "app-2026-09-30T04-00-00-000Z.db",
      "app-2026-09-30T04-00-00-000Z.db-shm",
      "app-2026-09-30T04-00-00-000Z.db-wal",
    ]);
  });

  it("sweeps sidecars whose snapshot is already gone — the ones already on the instance", () => {
    touch("app-2026-09-12T11-52-17-879Z.db-wal");
    touch("app-2026-09-12T11-52-17-879Z.db-shm");
    touch("app-2026-09-30T05-00-00-000Z.db");

    const removed = pruneBackups(directory, 48);

    expect(removed.snapshots).toEqual([]);
    expect(removed.sidecars.sort()).toEqual([
      "app-2026-09-12T11-52-17-879Z.db-shm",
      "app-2026-09-12T11-52-17-879Z.db-wal",
    ]);
    expect(readdirSync(directory)).toEqual(["app-2026-09-30T05-00-00-000Z.db"]);
  });

  it("never prunes the pre-migration snapshot, however many hourly ones there are", () => {
    touch("pre-migration-app-2026-09-30T06-37-45-759Z.db");
    touch("pre-migration-app-2026-09-30T06-37-45-759Z.db-wal");
    for (const hour of ["01", "02", "03"]) touch(`app-2026-09-30T${hour}-00-00-000Z.db`);

    pruneBackups(directory, 1);

    expect(existsSync(path.join(directory, "pre-migration-app-2026-09-30T06-37-45-759Z.db"))).toBe(
      true,
    );
    // Its WAL is beside a file that still exists, so it may hold data: kept.
    expect(
      existsSync(path.join(directory, "pre-migration-app-2026-09-30T06-37-45-759Z.db-wal")),
    ).toBe(true);
  });
});
