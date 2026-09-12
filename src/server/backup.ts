/**
 * Backup and restore (M2-T5, the part that can be rehearsed here).
 *
 * ## Why this exists alongside Litestream
 *
 * D9 puts Litestream in front of an S3 bucket for continuous off-site
 * replication, and that is still the right answer for recovering from a lost
 * volume. But it needs a bucket, a Docker host, and a rehearsal nobody has
 * run yet — which means until all three exist there is no backup at all, only
 * a plan for one. §10 calls that the largest tail risk in the architecture.
 *
 * This is a second, simpler layer that needs none of them: SQLite's own
 * online backup API, a verify step, and a restore. It runs on a schedule
 * against the same volume, and — the part that matters — **the whole
 * take-verify-restore cycle is exercised in the test suite on every push.**
 * A backup path that is executed on every CI run is a different kind of
 * object from one that is documented and has never been tried.
 *
 * Local snapshots and off-site replication answer different failures: a
 * snapshot recovers from a bad migration or a mistaken delete, replication
 * recovers from the machine catching fire. Neither substitutes for the other,
 * so the runbook keeps both.
 *
 * ## Why the online backup API, and not `cp`
 *
 * Copying a live SQLite file with `cp` copies it mid-write. Under WAL the
 * result is a database plus a partial log, and it may open, pass a cursory
 * look, and be missing the last transactions — the worst failure mode there
 * is, because it is silent. `Database.backup()` drives SQLite's own backup
 * API, which produces a consistent snapshot of committed state while writers
 * keep working.
 */

import Database from "better-sqlite3";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

/** Turns `file:./app.db` — or a bare path — into a filesystem path. */
export function databaseFilePath(url: string): string {
  const withoutScheme = url.startsWith("file:") ? url.slice("file:".length) : url;
  // `file:./x.db` and `file:x.db` are both relative to the working directory,
  // which is how Prisma reads them.
  return path.resolve(withoutScheme.replace(/^\/\//, ""));
}

/** A backup filename that sorts chronologically and survives a shell glob. */
export function backupFileName(now: Date = new Date()): string {
  return `app-${now.toISOString().replace(/[:.]/g, "-")}.db`;
}

export interface BackupResult {
  path: string;
  bytes: number;
  /** Wall-clock milliseconds. Recorded so the runbook's RTO is measured. */
  durationMs: number;
}

/**
 * Takes a consistent snapshot of a database that may be in use.
 *
 * Safe to run against the live file while the server is serving: SQLite's
 * backup API copies committed pages and restarts if a writer changes them
 * underneath it.
 */
export async function createBackup(
  sourcePath: string,
  destinationPath: string,
): Promise<BackupResult> {
  mkdirSync(path.dirname(destinationPath), { recursive: true });

  const started = Date.now();
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(destinationPath);
  } finally {
    source.close();
  }

  return {
    path: destinationPath,
    bytes: statSync(destinationPath).size,
    durationMs: Date.now() - started,
  };
}

export interface VerificationResult {
  ok: boolean;
  /** SQLite's own answer; "ok" when the file is structurally sound. */
  integrity: string;
  /** Rows whose foreign keys point at nothing. Empty is the only good answer. */
  brokenReferences: number;
  /** Migrations the snapshot has applied, so a restore can be dated. */
  migrations: string[];
  tables: Record<string, number>;
  problems: string[];
}

/** Tables worth counting: losing rows from any of these is losing user work. */
const COUNTED_TABLES = ["User", "Resume", "ResumeVersion", "Session", "Account"] as const;

/**
 * Checks a backup is actually restorable, before it is ever needed.
 *
 * `PRAGMA integrity_check` alone is not enough. It reports structural damage,
 * but a perfectly well-formed database with no rows in it is also a failed
 * backup — and that is the failure a `cp` of a live file produces. So this
 * also counts what should be there and checks the foreign keys resolve.
 */
export function verifyBackup(backupPath: string): VerificationResult {
  const problems: string[] = [];
  const db = new Database(backupPath, { readonly: true, fileMustExist: true });

  try {
    const [integrityRow] = db.pragma("integrity_check") as { integrity_check: string }[];
    const integrity = integrityRow?.integrity_check ?? "unknown";
    if (integrity !== "ok") problems.push(`integrity_check returned "${integrity}"`);

    const broken = db.pragma("foreign_key_check") as unknown[];
    if (broken.length > 0) problems.push(`${broken.length} row(s) reference something missing`);

    const tables: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      try {
        const row = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as {
          count: number;
        };
        tables[table] = Number(row.count);
      } catch {
        problems.push(`table "${table}" is missing`);
      }
    }

    let migrations: string[] = [];
    try {
      migrations = (
        db
          .prepare(
            `SELECT migration_name FROM "_prisma_migrations"
              WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
              ORDER BY migration_name`,
          )
          .all() as { migration_name: string }[]
      ).map((row) => row.migration_name);
    } catch {
      problems.push("no migration history — this is not a database this app wrote");
    }

    return {
      ok: problems.length === 0,
      integrity,
      brokenReferences: broken.length,
      migrations,
      tables,
      problems,
    };
  } finally {
    db.close();
  }
}

export interface RestoreResult extends BackupResult {
  verification: VerificationResult;
}

/**
 * Restores a backup **to a new path**, never over the live database.
 *
 * The order is the whole point. Writing over the live file means a restore
 * that turns out to be wrong has destroyed the only other copy, and the
 * moment you find that out is the moment you had least slack. Restoring
 * beside it leaves the original intact until a person decides to swap them.
 *
 * Refuses outright if the target exists, for the same reason.
 */
export async function restoreBackup(
  backupPath: string,
  targetPath: string,
): Promise<RestoreResult> {
  const resolvedTarget = path.resolve(targetPath);
  if (path.resolve(backupPath) === resolvedTarget) {
    throw new Error("Refusing to restore a backup over itself.");
  }

  let exists = false;
  try {
    statSync(resolvedTarget);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists) {
    throw new Error(
      `Refusing to overwrite ${resolvedTarget}. Restore to a new path, check it, then swap.`,
    );
  }

  // A backup that fails verification must not be presented as a restore.
  const verification = verifyBackup(backupPath);
  if (!verification.ok) {
    throw new Error(`That backup is not restorable: ${verification.problems.join("; ")}`);
  }

  const result = await createBackup(backupPath, resolvedTarget);
  return { ...result, verification: verifyBackup(resolvedTarget) };
}

/** True when two snapshots hold the same rows. What a restore has to preserve. */
export function sameContents(a: VerificationResult, b: VerificationResult): boolean {
  const keys = new Set([...Object.keys(a.tables), ...Object.keys(b.tables)]);
  for (const key of keys) {
    if (a.tables[key] !== b.tables[key]) return false;
  }
  return a.migrations.join() === b.migrations.join();
}
