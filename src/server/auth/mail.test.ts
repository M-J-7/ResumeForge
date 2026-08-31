/**
 * The delivery seam (M2-T2).
 *
 * The property that matters most here is the last one: the file outbox must
 * refuse to run in production. It exists so the magic-link flow can be
 * tested without an email account, and the cost of that convenience is a
 * transport that would write every user's sign-in link to disk if it ever
 * escaped a development machine.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  extractSignInLink,
  memoryTransport,
  outboxTransport,
  readOutbox,
  resolveMailTransport,
} from "./mail";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "resume-mail-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const MESSAGE = {
  to: "ada@example.com",
  subject: "Sign in",
  text: "Open https://example.com/api/auth/callback/email?token=abc to sign in.",
  html: "<p>hi</p>",
};

describe("outboxTransport", () => {
  it("writes a message that can be read back whole", async () => {
    await outboxTransport(directory, "no-reply@example.com").send(MESSAGE);

    const entries = await readOutbox(directory);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ...MESSAGE, from: "no-reply@example.com" });
    expect(Date.parse(entries[0]!.sentAt)).not.toBeNaN();
  });

  it("returns messages newest first", async () => {
    const transport = outboxTransport(directory);
    await transport.send({ ...MESSAGE, subject: "first" });
    await transport.send({ ...MESSAGE, subject: "second" });

    const entries = await readOutbox(directory);
    expect(entries.map((e) => e.subject)).toEqual(["second", "first"]);
  });

  it("creates the directory rather than failing on a fresh checkout", async () => {
    const nested = path.join(directory, "does", "not", "exist");
    await outboxTransport(nested).send(MESSAGE);
    expect(await readOutbox(nested)).toHaveLength(1);
  });

  it("reads an absent directory as empty", async () => {
    expect(await readOutbox(path.join(directory, "nothing-here"))).toEqual([]);
  });

  it("skips a file caught mid-write instead of failing the whole read", async () => {
    await outboxTransport(directory).send(MESSAGE);
    writeFileSync(path.join(directory, "99999999999999-partial.json"), '{"to": "ada@', "utf8");

    const entries = await readOutbox(directory);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.to).toBe(MESSAGE.to);
  });

  it("refuses to run in production", async () => {
    const original = process.env.NODE_ENV;
    // NODE_ENV is readonly in the Next type augmentation; the assignment is
    // the point of the test.
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      await expect(outboxTransport(directory).send(MESSAGE)).rejects.toThrow(
        /never run in production/,
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = original;
    }
  });
});

describe("memoryTransport", () => {
  it("collects what it was asked to send", async () => {
    const transport = memoryTransport();
    await transport.send(MESSAGE);
    expect(transport.sent).toEqual([MESSAGE]);
  });
});

describe("extractSignInLink", () => {
  it("finds the URL in a message body", () => {
    expect(extractSignInLink(MESSAGE)).toBe(
      "https://example.com/api/auth/callback/email?token=abc",
    );
  });

  it("returns null when there is no link", () => {
    expect(extractSignInLink({ text: "no link here" })).toBeNull();
  });
});

describe("resolveMailTransport", () => {
  it("prefers a configured SMTP server over the dev outbox", () => {
    const transport = resolveMailTransport({
      EMAIL_SERVER: "smtp://user:pass@smtp.example.com:587",
      AUTH_DEV_OUTBOX: directory,
      NODE_ENV: "development",
    });
    // Leaving the outbox set on a machine with real credentials must not
    // silently divert mail away from the provider that works.
    expect(transport.id).toBe("smtp");
  });

  it("falls back to the outbox in development", () => {
    expect(resolveMailTransport({ AUTH_DEV_OUTBOX: directory, NODE_ENV: "development" }).id).toBe(
      "outbox",
    );
  });

  it("will not select the outbox in production", () => {
    expect(() =>
      resolveMailTransport({ AUTH_DEV_OUTBOX: directory, NODE_ENV: "production" }),
    ).toThrow(/EMAIL_SERVER/);
  });

  it("names both options when nothing is configured", () => {
    // The error is the only thing a developer sees when sign-in does not
    // work, so it has to say what to set rather than that something is unset.
    expect(() => resolveMailTransport({})).toThrow(/EMAIL_SERVER.*AUTH_DEV_OUTBOX/s);
  });

  it("treats whitespace-only configuration as unset", () => {
    expect(() => resolveMailTransport({ EMAIL_SERVER: "   ", AUTH_DEV_OUTBOX: "  " })).toThrow();
  });
});
