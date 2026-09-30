/**
 * The usage counter's server half: counts in memory, written in batches.
 *
 * `POST /api/e` hands an accepted event name to `eventCounter.record`, which
 * adds one to a number in memory and returns. Nothing touches the database
 * on the request path. Every few minutes the numbers are added to
 * `EventCount` — one row per name per UTC day — in a single transaction.
 *
 * ## Why batched, and why not more often
 *
 * Three costs, all of them real on this deployment:
 *
 * - **`better-sqlite3` is synchronous.** A write per page view is a write on
 *   the event loop for every visitor, during exactly the traffic spike the
 *   counter exists to measure.
 * - **Litestream ships every write off-site within a second.** An idle
 *   database uploads nothing; one written every second uploads every second.
 * - **The bucket's free tier is 50,000 requests a month.** A write per event
 *   would spend that in days of modest traffic, and the backups with it.
 *
 * Batching makes all three proportional to time instead of traffic: at most
 * one transaction, and so one upload, per `FLUSH_MS`, however busy the site
 * is. The price is that a restart loses up to that many minutes of counts —
 * a deploy is a restart — which for a number read by the week is a fine
 * trade.
 *
 * ## A cap, because the endpoint is open
 *
 * Anyone can post an allowlisted name. They cannot make the table grow — it
 * is one row per name per day, and the names are a closed list — but they
 * could inflate a count. `WINDOW_CAP` bounds how much a window can add; past
 * it events are refused and the refusals themselves are counted, as
 * `meter:dropped`, so an inflated day is visible as one rather than looking
 * like a good day.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";
import { logError, logWarning } from "@/server/logging";

/**
 * How often counts are written. Five minutes: 288 transactions a day at the
 * very most, against a request budget measured per month. `EVENTS_FLUSH_MS`
 * shortens it where waiting would be the whole test (the e2e server).
 */
export const FLUSH_MS = Number(process.env.EVENTS_FLUSH_MS) || 5 * 60 * 1000;

/**
 * Events accepted per window. Far above anything this site's traffic is
 * likely to produce in five minutes — a front-page Hacker News thread is a
 * few thousand visits an hour — and far below what a script could otherwise
 * add to a single day's count.
 */
export const WINDOW_CAP = 20_000;

/** `2026-09-30` for an instant, in UTC. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

interface EventCounterOptions {
  cap?: number;
  flushMs?: number;
  now?: () => number;
  /** The client to write with. Defaults to the process-wide one. */
  client?: () => Promise<PrismaClient>;
  /** Off in tests, which call `flush` themselves. */
  schedule?: boolean;
}

export class EventCounter {
  private pending = new Map<string, number>();
  private accepted = 0;
  private dropped = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  private readonly cap: number;
  private readonly flushMs: number;
  private readonly now: () => number;
  private readonly client: () => Promise<PrismaClient>;
  private readonly schedule: boolean;

  constructor(options: EventCounterOptions = {}) {
    this.cap = options.cap ?? WINDOW_CAP;
    this.flushMs = options.flushMs ?? FLUSH_MS;
    this.now = options.now ?? Date.now;
    this.client = options.client ?? getPrisma;
    this.schedule = options.schedule ?? true;
  }

  /**
   * Adds one to `name` for today. The name must already have been accepted —
   * this does not check it. Returns false when the window's cap is full.
   */
  record(name: string): boolean {
    this.startTimer();
    if (this.accepted >= this.cap) {
      this.dropped += 1;
      return false;
    }
    this.accepted += 1;
    const key = `${utcDay(this.now())}\t${name}`;
    this.pending.set(key, (this.pending.get(key) ?? 0) + 1);
    return true;
  }

  /** What is waiting to be written, as `{ "day\tname": count }`. For tests. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.pending);
  }

  /**
   * Writes everything waiting, in one transaction, and opens a new window.
   * Returns the number of rows touched.
   *
   * The pending map is swapped out before the first await, so an event that
   * arrives mid-write lands in the next batch rather than being lost or
   * counted twice. If the write fails the batch is merged back and retried
   * next time — a failed flush delays counts, it never drops them.
   */
  async flush(): Promise<number> {
    if (this.dropped > 0) {
      const key = `${utcDay(this.now())}\tmeter:dropped`;
      this.pending.set(key, (this.pending.get(key) ?? 0) + this.dropped);
      logWarning("events", `window cap reached; ${this.dropped} events refused`);
      this.dropped = 0;
    }
    this.accepted = 0;
    if (this.pending.size === 0) return 0;

    const batch = this.pending;
    this.pending = new Map();
    const rows = [...batch].map(([key, count]) => {
      const [day, name] = key.split("\t") as [string, string];
      return { day, name, count };
    });

    try {
      const client = await this.client();
      await client.$transaction(
        rows.map(({ day, name, count }) =>
          client.$executeRawUnsafe(
            `INSERT INTO "EventCount" ("name", "day", "count") VALUES (?, ?, ?)
             ON CONFLICT("name", "day") DO UPDATE SET "count" = "EventCount"."count" + excluded."count"`,
            name,
            day,
            count,
          ),
        ),
      );
      return rows.length;
    } catch (error) {
      for (const [key, count] of batch) this.pending.set(key, (this.pending.get(key) ?? 0) + count);
      logError("events", error);
      return 0;
    }
  }

  private startTimer(): void {
    if (!this.schedule || this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.flushMs);
    // Never the reason the process stays alive.
    this.timer.unref?.();
  }
}

/**
 * The process-wide counter. Cached on `globalThis` for the same reason the
 * database client is: Next's dev server re-evaluates modules on every reload,
 * and each copy would otherwise hold its own counts and its own timer.
 */
const globalForEvents = globalThis as unknown as { eventCounter?: EventCounter };
export const eventCounter: EventCounter = (globalForEvents.eventCounter ??= new EventCounter());
