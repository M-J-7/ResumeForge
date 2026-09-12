/**
 * Rate limiting.
 *
 * Two properties carry the weight. The counter has to survive a restart —
 * an in-memory one is reset by every deploy and by every crash an attacker
 * can provoke — and the decision has to be a single atomic statement, or two
 * concurrent requests both read the same count and both pass, which is
 * exactly the case being defended against.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import {
  SIGN_IN_PER_EMAIL,
  SIGN_IN_PER_IP,
  checkSignInAllowed,
  consume,
  retryAfterMessage,
  shouldSweep,
  signInKey,
} from "./rate-limit";
import type { PrismaClient } from "@/generated/prisma/client";

let database: TestDatabase;
let client: PrismaClient;

const RULE = { limit: 3, windowMs: 60_000 };
const T0 = 1_800_000_000_000;

beforeEach(async () => {
  database = await createTestDatabase();
  client = database.client;
});

afterEach(async () => {
  await database.destroy();
});

/** Never sweeps, so a test's own rows stay put unless it asks otherwise. */
const at = (now: number) => ({ client, now, sweep: false });

describe("consume", () => {
  it("allows exactly the configured number of attempts", async () => {
    for (let attempt = 1; attempt <= RULE.limit; attempt += 1) {
      const result = await consume("k", RULE, at(T0));
      expect(result.allowed, `attempt ${attempt} should be allowed`).toBe(true);
      expect(result.remaining).toBe(RULE.limit - attempt);
    }

    const blocked = await consume("k", RULE, at(T0));
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("keeps counting separately per key", async () => {
    await consume("a", RULE, at(T0));
    await consume("a", RULE, at(T0));
    const other = await consume("b", RULE, at(T0));
    expect(other.remaining).toBe(RULE.limit - 1);
  });

  it("says how long until the window resets", async () => {
    await consume("k", RULE, at(T0));
    const blocked = await consume("k", { limit: 1, windowMs: 60_000 }, at(T0 + 10_000));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(RULE.windowMs);
  });

  it("starts a fresh window once the old one expires", async () => {
    for (let attempt = 0; attempt <= RULE.limit; attempt += 1) await consume("k", RULE, at(T0));
    expect((await consume("k", RULE, at(T0))).allowed).toBe(false);

    const later = await consume("k", RULE, at(T0 + RULE.windowMs + 1));
    expect(later.allowed).toBe(true);
    expect(later.remaining).toBe(RULE.limit - 1);
  });

  it("survives a process restart, because the counter is a row", async () => {
    for (let attempt = 0; attempt <= RULE.limit; attempt += 1) await consume("k", RULE, at(T0));

    // A new client against the same file is the closest thing to a restart
    // this test can stage — and the point is that nothing was in memory.
    const rows = await client.$queryRawUnsafe<{ count: number | bigint }[]>(
      `SELECT "count" FROM "RateLimit" WHERE "key" = 'k'`,
    );
    expect(Number(rows[0]?.count)).toBeGreaterThan(RULE.limit);
    expect((await consume("k", RULE, at(T0))).allowed).toBe(false);
  });

  it("counts concurrent attempts once each", async () => {
    // Read-then-write would let these all observe the same count and pass.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consume("burst", RULE, at(T0))),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(RULE.limit);
  });
});

describe("sweeping", () => {
  it("removes expired rows when it runs", async () => {
    await consume("old", RULE, at(T0));
    await consume("fresh", RULE, { client, now: T0 + RULE.windowMs + 1, sweep: true });

    const rows = await client.$queryRawUnsafe<{ key: string }[]>(`SELECT "key" FROM "RateLimit"`);
    // Unbounded growth matters here more than usual: better-sqlite3 is
    // synchronous, so an ever-growing table is eventually a stalled event
    // loop for every user, not only the one who triggered the scan.
    expect(rows.map((row) => row.key)).toEqual(["fresh"]);
  });

  it("does not sweep a window that is still open", async () => {
    await consume("live", RULE, at(T0));
    await consume("other", RULE, { client, now: T0 + 1, sweep: true });
    const rows = await client.$queryRawUnsafe<{ key: string }[]>(`SELECT "key" FROM "RateLimit"`);
    expect(rows).toHaveLength(2);
  });

  it("sweeps rarely, not on every call", () => {
    expect(shouldSweep(0)).toBe(true);
    expect(shouldSweep(0.5)).toBe(false);
  });
});

describe("checkSignInAllowed", () => {
  it("allows a normal sign-in", async () => {
    const result = await checkSignInAllowed("ada@example.com", "203.0.113.9", at(T0));
    expect(result.allowed).toBe(true);
  });

  it("blocks repeated requests for one address", async () => {
    for (let attempt = 0; attempt < SIGN_IN_PER_EMAIL.limit; attempt += 1) {
      expect((await checkSignInAllowed("ada@example.com", "203.0.113.9", at(T0))).allowed).toBe(
        true,
      );
    }
    const blocked = await checkSignInAllowed("ada@example.com", "203.0.113.9", at(T0));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("treats an address case-insensitively", async () => {
    for (let attempt = 0; attempt < SIGN_IN_PER_EMAIL.limit; attempt += 1) {
      await checkSignInAllowed("ada@example.com", null, at(T0));
    }
    // Otherwise the limit is bypassed by changing one letter's case.
    expect((await checkSignInAllowed("ADA@Example.com", null, at(T0))).allowed).toBe(false);
  });

  it("charges the IP budget even when the address is what blocked", async () => {
    // Short-circuiting on the first failure would make address rotation free.
    for (let attempt = 0; attempt <= SIGN_IN_PER_EMAIL.limit; attempt += 1) {
      await checkSignInAllowed("ada@example.com", "203.0.113.9", at(T0));
    }
    const rows = await client.$queryRawUnsafe<{ count: number | bigint }[]>(
      `SELECT "count" FROM "RateLimit" WHERE "key" = ?`,
      signInKey("ip", "203.0.113.9"),
    );
    expect(Number(rows[0]?.count)).toBeGreaterThan(SIGN_IN_PER_EMAIL.limit);
  });

  it("stops an attacker cycling through addresses from one IP", async () => {
    let blocked = false;
    for (let attempt = 0; attempt <= SIGN_IN_PER_IP.limit + 1; attempt += 1) {
      const result = await checkSignInAllowed(
        `victim-${attempt}@example.com`,
        "198.51.100.4",
        at(T0),
      );
      if (!result.allowed) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  it("still limits by address when there is no IP to go on", async () => {
    for (let attempt = 0; attempt < SIGN_IN_PER_EMAIL.limit; attempt += 1) {
      await checkSignInAllowed("ada@example.com", null, at(T0));
    }
    expect((await checkSignInAllowed("ada@example.com", null, at(T0))).allowed).toBe(false);
  });

  it("is generous enough not to catch a real person", async () => {
    // Someone who mistypes their address twice and then gets it right must
    // never be locked out; the limit exists for automation, not for people.
    expect(SIGN_IN_PER_EMAIL.limit).toBeGreaterThanOrEqual(5);
    expect(SIGN_IN_PER_IP.limit).toBeGreaterThan(SIGN_IN_PER_EMAIL.limit);
  });
});

describe("the counter table holds no personal data", () => {
  it("stores neither the address nor the IP that a key identifies", async () => {
    await checkSignInAllowed("ada@example.com", "203.0.113.9", at(T0));

    const rows = await client.$queryRawUnsafe<{ key: string }[]>(`SELECT "key" FROM "RateLimit"`);
    const keys = rows.map((row) => row.key).join(" ");

    // Nothing relates this table to a User, so a row keyed by a raw address
    // would survive account deletion — and would exist for people who only
    // ever requested a link and never signed in.
    expect(keys).not.toContain("ada@example.com");
    expect(keys).not.toContain("203.0.113.9");
    expect(rows).toHaveLength(2);
  });

  it("still identifies the same subject every time", () => {
    expect(signInKey("email", "Ada@Example.com ")).toBe(signInKey("email", "ada@example.com"));
    expect(signInKey("email", "ada@example.com")).not.toBe(signInKey("email", "bob@example.com"));
    // The kind is part of the input, so an address and an IP that happened to
    // hash alike could not share a counter.
    expect(signInKey("ip", "ada@example.com")).not.toBe(signInKey("email", "ada@example.com"));
  });
});

describe("retryAfterMessage", () => {
  it.each([
    [1_000, "in about a minute"],
    [60_000, "in about a minute"],
    [61_000, "in about 2 minutes"],
    [3_600_000, "in about 60 minutes"],
  ])("phrases %ims as %s", (ms, expected) => {
    expect(retryAfterMessage(ms)).toBe(expected);
  });
});
