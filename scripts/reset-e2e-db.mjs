/**
 * Deletes the end-to-end database before a run.
 *
 * Two reasons, and the second is the one that bites.
 *
 * The E2E suite signs in about a dozen times, and the sign-in rate limiter
 * counts per IP across a whole hour. Every test run comes from the same
 * address, so a second run inside the hour inherits the first run's counters
 * and starts failing on a limit that is working exactly as intended. A test
 * suite that passes once per hour is a test suite people stop running.
 *
 * And starting from nothing is what makes the run prove something about a
 * real deployment: an empty volume, a server that applies its own migrations
 * on first use, and a sign-in that works — which is the first-deploy path
 * from `docs/RUNBOOK.md`, executed rather than described.
 */

import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const file = process.env.E2E_DATABASE_FILE ?? "e2e.db";

// The WAL and shared-memory files travel with the database. Leaving them
// behind next to a deleted database is how SQLite gets confused about a file
// it has never seen.
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(path.resolve(`${file}${suffix}`), { force: true });
}

console.log(`Reset ${file} for the end-to-end run.`);
