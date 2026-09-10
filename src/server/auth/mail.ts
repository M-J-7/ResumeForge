/**
 * How a magic link actually reaches the user (M2-T2).
 *
 * Auth.js will happily take an SMTP connection string and be done with it.
 * That is not enough here, for a reason that showed up as soon as this task
 * was picked up: M2-T2's acceptance is "both flows work end-to-end", and a
 * flow whose only delivery path needs a paid provider account cannot be
 * tested at all until someone buys one. The flow then ships unverified,
 * which is exactly the failure this seam exists to prevent.
 *
 * So delivery is an interface with three implementations:
 *
 *   - `smtpTransport` — production. A real transactional provider. Per D6
 *     this is the one piece of infrastructure allowed to see a user's email
 *     address, because it carries a login link and never resume content.
 *   - `outboxTransport` — development and CI. Writes each message to a file
 *     so a Playwright test can read the link back and follow it, exercising
 *     token creation, delivery, single-use consumption, and session creation
 *     for real.
 *   - `memoryTransport` — unit tests. Keeps messages in an array.
 *
 * The outbox refuses to run in production. That is the whole safety
 * argument: a deploy that forgets `EMAIL_SERVER` must fail loudly at the
 * first sign-in attempt, not quietly write everyone's magic links to the
 * server's disk.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  /** Names the delivery path in logs and in the sign-in page's dev banner. */
  readonly id: "smtp" | "outbox" | "memory";
  send(message: MailMessage): Promise<void>;
}

/** Where a message came to rest, as the outbox records it. */
export interface OutboxEntry extends MailMessage {
  from: string;
  sentAt: string;
}

export const DEFAULT_MAIL_FROM = "Six Seconds Resume <no-reply@localhost>";

/* -------------------------------------------------------------------------- */
/* SMTP                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Real delivery through a transactional provider.
 *
 * `nodemailer` is imported lazily. It pulls in a large tree of Node-only
 * modules, and a bundler following a static import from the auth config
 * drags all of it into every route that merely calls `auth()`.
 */
export function smtpTransport(server: string, from: string = DEFAULT_MAIL_FROM): MailTransport {
  return {
    id: "smtp",
    async send(message) {
      const { createTransport } = await import("nodemailer");
      const result = await createTransport(server).sendMail({ from, ...message });
      // `rejected` and `pending` are how nodemailer reports a per-recipient
      // failure on an otherwise successful SMTP conversation. Without this
      // check a bounced address looks like a delivered one, and the user
      // waits forever for a link that was never accepted.
      const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
      if (failed.length > 0) {
        throw new Error(`Sign-in email was not accepted for: ${failed.join(", ")}`);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Outbox (development and CI)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Writes each message to `dir` as JSON, one file per message.
 *
 * One file per message rather than an appended log: the test that reads this
 * back is polling while the server writes, and a half-written line in a
 * shared log is indistinguishable from a corrupt one.
 */
export function outboxTransport(dir: string, from: string = DEFAULT_MAIL_FROM): MailTransport {
  return {
    id: "outbox",
    async send(message) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "The file outbox is a development transport and must never run in production. " +
            "Set EMAIL_SERVER to a real transactional provider.",
        );
      }
      await mkdir(dir, { recursive: true });
      const entry: OutboxEntry = { from, ...message, sentAt: new Date().toISOString() };
      // Sortable prefix, unique suffix: the timestamp orders the directory
      // listing, the uuid keeps two messages in the same millisecond apart.
      const name = `${String(Date.now()).padStart(14, "0")}-${randomUUID()}.json`;
      await writeFile(path.join(dir, name), JSON.stringify(entry, null, 2), "utf8");
    },
  };
}

/** Everything the outbox holds, newest first. A missing directory reads as empty. */
export async function readOutbox(dir: string): Promise<OutboxEntry[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const ordered = names.filter((name) => name.endsWith(".json")).sort();
  ordered.reverse();

  const entries: OutboxEntry[] = [];
  for (const name of ordered) {
    try {
      const raw = await readFile(path.join(dir, name), "utf8");
      entries.push(JSON.parse(raw) as OutboxEntry);
    } catch {
      // A file caught mid-write is not a failure worth propagating; the
      // caller is polling and will see it complete on the next pass.
    }
  }
  return entries;
}

/* -------------------------------------------------------------------------- */
/* Memory (unit tests)                                                         */
/* -------------------------------------------------------------------------- */

export interface MemoryTransport extends MailTransport {
  readonly sent: MailMessage[];
}

export function memoryTransport(): MemoryTransport {
  const sent: MailMessage[] = [];
  return {
    id: "memory",
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

const LINK_PATTERN = /https?:\/\/\S+/;

/**
 * Pulls the sign-in URL out of a message body.
 *
 * Shared by the tests and by the dev banner, so there is one definition of
 * "the link in the email". A test that parses the body its own way can pass
 * against a message no mail client would render usefully.
 */
export function extractSignInLink(message: Pick<MailMessage, "text">): string | null {
  const match = LINK_PATTERN.exec(message.text);
  return match ? match[0] : null;
}

export interface MailEnv {
  EMAIL_SERVER?: string | undefined;
  EMAIL_FROM?: string | undefined;
  AUTH_DEV_OUTBOX?: string | undefined;
  NODE_ENV?: string | undefined;
  /** What makes `process.env` assignable to this. */
  [key: string]: string | undefined;
}

/**
 * Picks the transport from the environment.
 *
 * Order matters: a configured `EMAIL_SERVER` always wins, so leaving the dev
 * outbox set on a machine that also has real credentials cannot silently
 * divert mail away from the provider that is actually working.
 */
export function resolveMailTransport(env: MailEnv = process.env): MailTransport {
  const from = env.EMAIL_FROM?.trim() || DEFAULT_MAIL_FROM;
  const server = env.EMAIL_SERVER?.trim();
  const outbox = env.AUTH_DEV_OUTBOX?.trim();

  if (server) return smtpTransport(server, from);
  if (outbox && env.NODE_ENV !== "production") return outboxTransport(path.resolve(outbox), from);

  throw new Error(
    "No way to send the sign-in email. Set EMAIL_SERVER (and EMAIL_FROM) to a " +
      "transactional provider, or set AUTH_DEV_OUTBOX to a directory to write " +
      "messages to disk during local development.",
  );
}
