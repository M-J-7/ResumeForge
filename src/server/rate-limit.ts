/**
 * Rate limiting (production hardening).
 *
 * ## The specific thing this stops
 *
 * `POST /api/auth/signin/email` will send an email to any address it is
 * given. Without a limit that is two problems at once: anyone can use this
 * app to deliver mail to a stranger's inbox on repeat, and every one of those
 * sends is billed to whoever runs it. A transactional provider's rate limits
 * do not help — by the time they trip, the mail has been sent and the
 * reputation damage is done.
 *
 * Sign-in is also the only endpoint here that costs money per request, which
 * is why it is the one that is limited rather than everything indiscriminately.
 *
 * ## Why the counter is in SQLite and not in memory
 *
 * An in-process counter resets on every deploy, and on every crash an
 * attacker can provoke. The database survives both, and this application
 * already has one open. The cost is a single indexed upsert per attempt.
 *
 * ## Fixed window, not a token bucket
 *
 * A fixed window lets a caller burst at a boundary — up to 2× the limit
 * across two adjacent windows. For a human clicking "email me a link" that
 * is irrelevant, and the honest trade is that a fixed window is one atomic
 * statement while a sliding window is a table of timestamps to sweep. The
 * limit is set low enough that 2× is still harmless.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";

export interface RateLimitRule {
  /** Attempts allowed inside one window. */
  limit: number;
  windowMs: number;
}

/**
 * Per address. A magic link is single-use and arrives in seconds, so someone
 * legitimately needing a sixth link within an hour is already in a situation
 * a seventh will not fix.
 */
export const SIGN_IN_PER_EMAIL: RateLimitRule = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Per client address, and deliberately loose.
 *
 * An office, a university, or a mobile carrier's CGNAT can put thousands of
 * genuine users behind one address. A limit tight enough to inconvenience an
 * attacker there locks out a whole building, and the people it locks out
 * cannot tell what happened.
 *
 * The per-address limit above is the one doing real work: it is what stops a
 * specific person's inbox being bombed. This is a coarse backstop against a
 * script spraying many addresses from one host, and it is bounded rather than
 * airtight on purpose — an attacker with a pool of IPs is a problem for a
 * WAF, not for a counter inside the application.
 */
export const SIGN_IN_PER_IP: RateLimitRule = { limit: 60, windowMs: 60 * 60 * 1000 };

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in this window; 0 once blocked. */
  remaining: number;
  /** How long until the window resets. */
  retryAfterMs: number;
}

/**
 * One in this many calls also sweeps expired rows.
 *
 * Cheap amortised cleanup instead of a scheduled job. Without it the table
 * grows without bound, and `better-sqlite3` is synchronous — an unbounded
 * table is eventually a stalled event loop for every user, not just the one
 * who triggered it.
 */
const SWEEP_ODDS = 50;

/** Test seam, so a test can force or suppress the sweep. */
export function shouldSweep(random: number = Math.random()): boolean {
  return random < 1 / SWEEP_ODDS;
}

interface CounterRow {
  count: number | bigint;
  expiresAt: number | bigint | Date;
}

function toMillis(value: number | bigint | Date): number {
  if (value instanceof Date) return value.getTime();
  return Number(value);
}

/**
 * Records an attempt against `key` and says whether it is allowed.
 *
 * The whole decision is one statement. Read-then-write would let two
 * concurrent requests both read the same count and both pass — which is
 * exactly the case a limiter exists for.
 */
export async function consume(
  key: string,
  rule: RateLimitRule,
  options: { client?: PrismaClient; now?: number; sweep?: boolean } = {},
): Promise<RateLimitResult> {
  const client = options.client ?? (await getPrisma());
  const now = options.now ?? Date.now();
  const expiresAt = now + rule.windowMs;

  const rows = await client.$queryRawUnsafe<CounterRow[]>(
    `INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (?, 1, ?)
     ON CONFLICT("key") DO UPDATE SET
       "count"     = CASE WHEN "RateLimit"."expiresAt" <= ? THEN 1 ELSE "RateLimit"."count" + 1 END,
       "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ? THEN ? ELSE "RateLimit"."expiresAt" END
     RETURNING "count", "expiresAt"`,
    key,
    expiresAt,
    now,
    now,
    expiresAt,
  );

  if (options.sweep ?? shouldSweep()) {
    await client.$executeRawUnsafe(`DELETE FROM "RateLimit" WHERE "expiresAt" <= ?`, now);
  }

  const row = rows[0];
  if (!row) {
    // The upsert always returns a row. If it somehow did not, allowing the
    // request is the right failure direction: a limiter that locks everyone
    // out when it breaks is a worse outage than the abuse it prevents.
    return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
  }

  const count = Number(row.count);
  const windowEnd = toMillis(row.expiresAt);

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterMs: Math.max(0, windowEnd - now),
  };
}

/** Human phrasing for a rejection, in minutes rather than milliseconds. */
export function retryAfterMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return minutes === 1 ? "in about a minute" : `in about ${minutes} minutes`;
}

/**
 * Checks both limits for a sign-in attempt.
 *
 * The email counter is consumed first and the IP counter regardless of its
 * result, so a caller cycling through addresses still burns their IP budget.
 * Short-circuiting on the first failure would make address rotation free.
 */
export async function checkSignInAllowed(
  email: string,
  ip: string | null,
  options: { client?: PrismaClient; now?: number; sweep?: boolean } = {},
): Promise<RateLimitResult> {
  const byEmail = await consume(`signin:email:${email.toLowerCase()}`, SIGN_IN_PER_EMAIL, options);
  const byIp = ip
    ? await consume(`signin:ip:${ip}`, SIGN_IN_PER_IP, options)
    : { allowed: true, remaining: SIGN_IN_PER_IP.limit, retryAfterMs: 0 };

  if (byEmail.allowed && byIp.allowed) {
    return {
      allowed: true,
      remaining: Math.min(byEmail.remaining, byIp.remaining),
      retryAfterMs: 0,
    };
  }

  const blocking = !byEmail.allowed ? byEmail : byIp;
  return { allowed: false, remaining: 0, retryAfterMs: blocking.retryAfterMs };
}
