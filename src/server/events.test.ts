/**
 * The usage counter's batching, against a real SQLite database.
 *
 * The properties that matter are the ones a per-request write would have had
 * for free and a batch has to earn: nothing counted twice, nothing lost to a
 * failed write or to an event that arrives while one is in flight, days kept
 * apart, and a cap that shows up in the numbers rather than hiding in them.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createTestDatabase, type TestDatabase } from "@/test/database";
import { EventCounter, utcDay } from "./events";

let database: TestDatabase;
let client: PrismaClient;

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);

beforeEach(async () => {
  database = await createTestDatabase();
  client = database.client;
});

afterEach(async () => {
  await database.destroy();
});

function counterAt(clock: { now: number }, options: { cap?: number } = {}) {
  return new EventCounter({
    now: () => clock.now,
    client: async () => client,
    schedule: false,
    ...options,
  });
}

async function rows(): Promise<{ name: string; day: string; count: number }[]> {
  const found = await client.$queryRawUnsafe<{ name: string; day: string; count: number | bigint }[]>(
    `SELECT "name", "day", "count" FROM "EventCount" ORDER BY "day", "name"`,
  );
  return found.map((row) => ({ ...row, count: Number(row.count) }));
}

describe("utcDay", () => {
  it("is the UTC calendar day, whatever the server's own zone", () => {
    expect(utcDay(Date.UTC(2026, 8, 30, 23, 59, 59))).toBe("2026-09-30");
    expect(utcDay(Date.UTC(2026, 9, 1, 0, 0, 0))).toBe("2026-10-01");
  });
});

describe("EventCounter", () => {
  it("writes nothing until it is flushed, and then one row per name per day", async () => {
    const clock = { now: T0 };
    const counter = counterAt(clock);
    counter.record("view:/");
    counter.record("view:/");
    counter.record("export:pdf");

    expect(await rows()).toEqual([]);
    expect(await counter.flush()).toBe(2);
    expect(await rows()).toEqual([
      { name: "export:pdf", day: "2026-09-30", count: 1 },
      { name: "view:/", day: "2026-09-30", count: 2 },
    ]);
  });

  it("adds to a day's count across flushes rather than replacing it", async () => {
    const clock = { now: T0 };
    const counter = counterAt(clock);
    counter.record("view:/check");
    await counter.flush();
    counter.record("view:/check");
    counter.record("view:/check");
    await counter.flush();

    expect(await rows()).toEqual([{ name: "view:/check", day: "2026-09-30", count: 3 }]);
    // An empty window writes nothing at all — which is what keeps an idle
    // database idle, and Litestream with nothing to ship.
    expect(await counter.flush()).toBe(0);
  });

  it("keeps days apart when a window spans midnight", async () => {
    const clock = { now: Date.UTC(2026, 8, 30, 23, 59) };
    const counter = counterAt(clock);
    counter.record("view:/");
    clock.now = Date.UTC(2026, 9, 1, 0, 1);
    counter.record("view:/");
    await counter.flush();

    expect(await rows()).toEqual([
      { name: "view:/", day: "2026-09-30", count: 1 },
      { name: "view:/", day: "2026-10-01", count: 1 },
    ]);
  });

  it("refuses past the window's cap, and counts the refusals where they will be seen", async () => {
    const counter = counterAt({ now: T0 }, { cap: 3 });
    const accepted = [1, 2, 3, 4, 5].map(() => counter.record("view:/"));
    expect(accepted).toEqual([true, true, true, false, false]);
    await counter.flush();

    expect(await rows()).toEqual([
      { name: "meter:dropped", day: "2026-09-30", count: 2 },
      { name: "view:/", day: "2026-09-30", count: 3 },
    ]);
    // A flush opens a new window.
    expect(counter.record("view:/")).toBe(true);
  });

  it("keeps a batch whose write failed, and writes it next time", async () => {
    let failing = true;
    const counter = new EventCounter({
      now: () => T0,
      schedule: false,
      client: async () => {
        if (failing) throw new Error("database is locked");
        return client;
      },
    });
    counter.record("export:docx");
    expect(await counter.flush()).toBe(0);
    expect(counter.snapshot()).toEqual({ "2026-09-30\texport:docx": 1 });

    failing = false;
    counter.record("export:docx");
    await counter.flush();
    expect(await rows()).toEqual([{ name: "export:docx", day: "2026-09-30", count: 2 }]);
  });

  it("puts an event that arrives mid-write in the next batch, not this one or none", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const counter = new EventCounter({
      now: () => T0,
      schedule: false,
      client: async () => {
        await gate;
        return client;
      },
    });

    counter.record("view:/");
    const flushing = counter.flush();
    counter.record("view:/"); // while the first batch waits on the database
    release();
    await flushing;

    expect(await rows()).toEqual([{ name: "view:/", day: "2026-09-30", count: 1 }]);
    expect(counter.snapshot()).toEqual({ "2026-09-30\tview:/": 1 });
    await counter.flush();
    expect(await rows()).toEqual([{ name: "view:/", day: "2026-09-30", count: 2 }]);
  });
});
