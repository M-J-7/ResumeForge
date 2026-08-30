/**
 * The database connection (M2-T1).
 *
 * ## The pragmas are not optional
 *
 * SQLite's defaults are wrong for a web server, and the failure modes are
 * ugly rather than obvious:
 *
 * - `journal_mode=WAL` lets readers and the writer work concurrently. Without
 *   it a single write blocks every read, which under load looks like the app
 *   hanging rather than like a database setting. WAL is stored *in the
 *   database file*, so it persists once set.
 * - `busy_timeout=5000` makes a contended write wait instead of failing
 *   instantly with `SQLITE_BUSY`. The default is 0 — no wait at all.
 * - `synchronous=NORMAL` is the right pairing with WAL: durable across a
 *   process crash, and only at risk in an OS-level crash — which is exactly
 *   what Litestream (D9, M2-T5) exists to cover.
 * - `foreign_keys=ON` is **off by default in SQLite**. Without it the
 *   `onDelete: Cascade` rules in the schema are decorative, and M2-T6's hard
 *   delete would silently leave resume content behind after a user asked to
 *   be forgotten. This one is per-connection and has to be set every time.
 *
 * ## better-sqlite3 is synchronous
 *
 * Every query blocks the event loop for the whole process — not just the
 * request that issued it. A missing index is not a slow page here; it is a
 * slow *server*. Keep queries indexed and bounded, and never scan a table on
 * a request path.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** What `assertPragmas` requires. `synchronous: 1` is NORMAL. */
export const REQUIRED_PRAGMAS = {
  journal_mode: "wal",
  busy_timeout: 5000,
  synchronous: 1,
  foreign_keys: 1,
} as const;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return url;
}

/**
 * Applies the pragmas the adapter does not set for us.
 *
 * `busy_timeout` comes from the adapter's `timeout` option; the rest are
 * statements. Run on every client, because three of the four are
 * per-connection settings rather than properties of the file.
 */
export async function applyPragmas(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe("PRAGMA journal_mode = WAL");
  await client.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
  await client.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await client.$executeRawUnsafe(`PRAGMA busy_timeout = ${REQUIRED_PRAGMAS.busy_timeout}`);
}

/** Reads the pragmas back, so a test can assert on what is actually in force. */
export async function readPragmas(client: PrismaClient): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(REQUIRED_PRAGMAS)) {
    const rows = await client.$queryRawUnsafe<Record<string, unknown>[]>(`PRAGMA ${name}`);
    const row = rows[0];
    result[name] = row ? Object.values(row)[0] : undefined;
  }
  return result;
}

export function createPrismaClient(url: string = databaseUrl()): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url,
    // better-sqlite3's own busy timeout, which is what SQLite reads as
    // `busy_timeout`. Setting it here covers the window before
    // `applyPragmas` has run.
    timeout: REQUIRED_PRAGMAS.busy_timeout,
  });
  return new PrismaClient({ adapter });
}

/** A client with the pragmas already applied. Prefer this over the raw constructor. */
export async function connect(url: string = databaseUrl()): Promise<PrismaClient> {
  const client = createPrismaClient(url);
  await applyPragmas(client);
  return client;
}

/**
 * The process-wide client, created on first use.
 *
 * Lazy on purpose: importing a module must not open a database connection as
 * a side effect. Eager construction makes the module unimportable anywhere
 * `DATABASE_URL` is absent — tests, build-time analysis, a stray import from
 * a client component — and turns a configuration problem into an import
 * error a long way from its cause.
 *
 * Cached on `globalThis` because Next's dev server re-evaluates modules on
 * every hot reload; without this each reload opens another connection and
 * they accumulate until SQLite refuses new ones.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaReady?: Promise<PrismaClient>;
};

/** Returns the shared client with its pragmas already applied. */
export function getPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prismaReady) return globalForPrisma.prismaReady;

  const client = globalForPrisma.prisma ?? createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaReady = applyPragmas(client).then(() => client);
  return globalForPrisma.prismaReady;
}

/** Test seam: drops the cached client so the next call builds a fresh one. */
export async function resetPrisma(): Promise<void> {
  const client = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaReady = undefined;
  if (client) await client.$disconnect();
}
