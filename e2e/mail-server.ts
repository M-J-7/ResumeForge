/**
 * A throwaway SMTP server the E2E run points the app at (M2-T2).
 *
 * M2-T2's acceptance is "both flows work end-to-end". Without something to
 * receive the mail, the magic-link flow cannot be tested until someone buys
 * a transactional email account — so it would ship unverified, which is the
 * one outcome worth avoiding.
 *
 * This deliberately exercises `smtpTransport`, the transport that actually
 * ships, rather than the development file outbox. The outbox refuses to run
 * under `NODE_ENV=production`, and the E2E run builds for production on
 * purpose, so the two facts line up: the outbox is covered by unit tests and
 * the production path is covered here.
 */

import { SMTPServer } from "smtp-server";

export interface CapturedMail {
  to: string[];
  raw: string;
}

export interface MailServer {
  /** `smtp://…` — what the app should be given as `EMAIL_SERVER`. */
  url: string;
  messages: CapturedMail[];
  /** Resolves with the first message to `address` that arrives, or rejects. */
  waitFor(address: string, timeoutMs?: number): Promise<CapturedMail>;
  close(): Promise<void>;
}

/** The port the app is configured with in `playwright.config.ts`. */
export const MAIL_PORT = 2526;

/**
 * Undoes quoted-printable encoding.
 *
 * nodemailer wraps the body at 76 columns, and the sign-in URL is longer
 * than that, so the raw message contains the link split across lines by soft
 * breaks. Searching the raw text for `https?://\S+` therefore finds only the
 * first fragment — a test that looked there would assert against a URL no
 * mail client would ever produce.
 */
export function decodeQuotedPrintable(body: string): string {
  return body
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

const LINK_PATTERN = /https?:\/\/[^\s"<>]+/;

/** The sign-in URL inside a captured message. */
export function signInLinkFrom(message: CapturedMail): string {
  const match = LINK_PATTERN.exec(decodeQuotedPrintable(message.raw));
  if (!match) throw new Error(`No sign-in link in the captured message:\n${message.raw}`);
  // The HTML part may re-encode `&` as `&amp;`; the plain-text part above it
  // does not, and that is the one this finds first.
  return match[0].replace(/&amp;/g, "&");
}

export async function startMailServer(port: number = MAIL_PORT): Promise<MailServer> {
  const messages: CapturedMail[] = [];

  const server = new SMTPServer({
    // No credentials and no TLS: this listens on loopback for the length of
    // one test run and never sees anything but its own fixtures.
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        messages.push({
          to: session.envelope.rcptTo.map((recipient) => recipient.address.toLowerCase()),
          raw: Buffer.concat(chunks).toString("utf8"),
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    url: `smtp://127.0.0.1:${port}`,
    messages,

    async waitFor(address, timeoutMs = 20_000) {
      const wanted = address.toLowerCase();
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = messages.find((message) => message.to.includes(wanted));
        if (found) return found;
        if (Date.now() > deadline) {
          throw new Error(
            `No mail for ${address} within ${timeoutMs}ms. Received: ${
              messages.flatMap((m) => m.to).join(", ") || "nothing"
            }`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },

    close() {
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
