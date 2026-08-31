/**
 * Backup, verify, and restore the database (M2-T5).
 *
 *   node scripts/backup.mjs create [--keep 14]
 *   node scripts/backup.mjs verify <file>
 *   node scripts/backup.mjs restore <file> <target>
 *   node scripts/backup.mjs list
 *
 * Reads `DATABASE_URL` for the live database and `BACKUP_DIR` for where
 * snapshots go (default `./backups`). Intended for cron:
 *
 *   0 * * * * cd /app && node scripts/backup.mjs create --keep 48
 *
 * Safe to run against a live server — SQLite's online backup API copies
 * committed pages while writers keep working. `restore` never writes over an
 * existing file, so a restore that turns out to be wrong cannot destroy the
 * copy you still had.
 *
 * The same functions are exercised end to end by `src/server/backup.test.ts`
 * on every push, which is what stops this from being a backup nobody has
 * tried.
 */

import { readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  backupFileName,
  createBackup,
  databaseFilePath,
  restoreBackup,
  verifyBackup,
} from "../src/server/backup.ts";

const [, , command, ...rest] = process.argv;

const backupDir = path.resolve(process.env.BACKUP_DIR ?? "backups");
const liveUrl = process.env.DATABASE_URL;

function requireLiveDatabase() {
  if (!liveUrl) {
    console.error("DATABASE_URL is not set, so there is nothing to back up.");
    process.exit(1);
  }
  return databaseFilePath(liveUrl);
}

function flag(name, fallback) {
  const index = rest.indexOf(`--${name}`);
  return index === -1 ? fallback : rest[index + 1];
}

function listBackups() {
  try {
    return readdirSync(backupDir)
      .filter((name) => name.endsWith(".db"))
      .sort();
  } catch {
    return [];
  }
}

function report(verification) {
  console.log(`  integrity        ${verification.integrity}`);
  console.log(`  broken refs      ${verification.brokenReferences}`);
  console.log(`  migrations       ${verification.migrations.length}`);
  for (const [table, count] of Object.entries(verification.tables)) {
    console.log(`  ${table.padEnd(16)} ${count}`);
  }
  for (const problem of verification.problems) console.log(`  PROBLEM: ${problem}`);
}

switch (command) {
  case "create": {
    const source = requireLiveDatabase();
    const destination = path.join(backupDir, backupFileName());

    const result = await createBackup(source, destination);
    const verification = verifyBackup(result.path);

    console.log(`Backed up ${source}`);
    console.log(`       to ${result.path}`);
    console.log(`     ${result.bytes} bytes in ${result.durationMs}ms`);
    report(verification);

    if (!verification.ok) {
      // A snapshot that fails its own check is worse than none, because it
      // will be trusted. Exit non-zero so cron reports it.
      console.error("This backup is NOT restorable. Investigate before relying on it.");
      process.exit(1);
    }

    const keep = Number(flag("keep", "0"));
    if (keep > 0) {
      const existing = listBackups();
      for (const name of existing.slice(0, Math.max(0, existing.length - keep))) {
        unlinkSync(path.join(backupDir, name));
        console.log(`Pruned ${name}`);
      }
    }
    break;
  }

  case "verify": {
    const target = rest[0];
    if (!target) {
      console.error("Usage: node scripts/backup.mjs verify <file>");
      process.exit(1);
    }
    const verification = verifyBackup(path.resolve(target));
    console.log(`Checked ${path.resolve(target)}`);
    report(verification);
    process.exit(verification.ok ? 0 : 1);
    break;
  }

  case "restore": {
    const [from, to] = rest;
    if (!from || !to) {
      console.error("Usage: node scripts/backup.mjs restore <file> <target>");
      console.error("The target must not already exist — restore beside the live file, then swap.");
      process.exit(1);
    }
    const result = await restoreBackup(path.resolve(from), path.resolve(to));
    console.log(`Restored to ${result.path} in ${result.durationMs}ms`);
    report(result.verification);
    console.log("");
    console.log("Nothing has been swapped. Stop the app, move this file into place,");
    console.log("and keep the original until you are sure.");
    break;
  }

  case "list": {
    const names = listBackups();
    if (names.length === 0) {
      console.log(`No backups in ${backupDir}`);
      break;
    }
    for (const name of names) {
      const { size, mtime } = statSync(path.join(backupDir, name));
      console.log(`${name}  ${String(size).padStart(12)} bytes  ${mtime.toISOString()}`);
    }
    break;
  }

  default:
    console.error("Usage: node scripts/backup.mjs <create|verify|restore|list>");
    process.exit(1);
}
