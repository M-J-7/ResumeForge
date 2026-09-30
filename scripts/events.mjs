/**
 * Prints the usage counts (MONETISATION.md Phase 1).
 *
 *   node scripts/events.mjs [days]          # the last 14 days by default
 *
 * On the instance, where the database is:
 *
 *   sudo docker compose exec -T app node scripts/events.mjs 30
 *
 * Read-only. Counts are held in memory and written every few minutes
 * (`src/server/events.ts`), so the most recent ones may not be here yet, and
 * a deploy loses whatever had not been written — both said in the output, so
 * nobody reads a quiet last hour as a dead site.
 *
 * Three blocks: which pages were viewed, where visits came from, and what
 * people did. Each row is a total for the period and the last seven days
 * beside it, newest last.
 */

import Database from "better-sqlite3";
import process from "node:process";

// `backup.ts` is TypeScript, loaded through Node's type stripping, and Node
// warns that the image's package.json does not say what module type it is —
// four lines of noise above a report somebody is trying to read. That one
// warning is dropped; any other is printed as usual.
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(warning);
});
const { databaseFilePath } = await import("../src/server/backup.ts");

const days = Math.max(1, Number(process.argv[2]) || 14);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dayOf = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const since = dayOf(days - 1);
const recent = Array.from({ length: Math.min(7, days) }, (_, i) => dayOf(Math.min(7, days) - 1 - i));

const db = new Database(databaseFilePath(url), { readonly: true, fileMustExist: true });
let rows;
try {
  rows = db
    .prepare(`SELECT "name", "day", "count" FROM "EventCount" WHERE "day" >= ? ORDER BY "name"`)
    .all(since);
} catch (error) {
  // The table arrives with a migration the server applies on first use.
  console.error(`No counts to read (${error instanceof Error ? error.message : error}).`);
  process.exit(1);
} finally {
  db.close();
}

/** name -> { total, byDay } */
const table = new Map();
for (const { name, day, count } of rows) {
  const entry = table.get(name) ?? { total: 0, byDay: new Map() };
  entry.total += count;
  entry.byDay.set(day, (entry.byDay.get(day) ?? 0) + count);
  table.set(name, entry);
}

const blocks = [
  ["PAGES VIEWED", "view:"],
  ["WHERE VISITS CAME FROM", "src:"],
  ["WHAT PEOPLE DID", ""],
];

/** A row's label is its name without the block's prefix. */
const labelOf = (name) => name.replace(/^(view|src):/, "");
const width = Math.max(28, ...[...table.keys()].map((name) => labelOf(name).length + 2));
const header = recent.map((day) => day.slice(5).padStart(6)).join("");

console.log(`Usage counts, ${since} to ${dayOf(0)} (UTC).`);
console.log("Counts are written every few minutes, and a deploy loses what had not been.\n");

for (const [title, prefix] of blocks) {
  const names = [...table.keys()]
    .filter((name) =>
      prefix ? name.startsWith(prefix) : !name.startsWith("view:") && !name.startsWith("src:"),
    )
    .sort((a, b) => table.get(b).total - table.get(a).total);
  console.log(`${title.padEnd(width)} ${"total".padStart(7)}${header}`);
  if (names.length === 0) console.log("  (none)");
  for (const name of names) {
    const { total, byDay } = table.get(name);
    const label = labelOf(name);
    const cells = recent.map((day) => String(byDay.get(day) ?? "·").padStart(6)).join("");
    console.log(`  ${label.padEnd(width - 2)} ${String(total).padStart(7)}${cells}`);
  }
  console.log("");
}
