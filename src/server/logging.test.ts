/**
 * Log scrubbing (§9).
 *
 * The tests that matter are the ones about content nobody wrote to a log on
 * purpose: a serialized resume arriving inside a database error, an address
 * inside a mail failure, a sign-in token inside a URL. Those are how "we
 * never log your resume" stops being true without anyone noticing.
 */

import { describe, expect, it } from "vitest";
import { logError, scrubForLog } from "./logging";
import { midCareerResume } from "@/test/fixtures/resumes";

describe("scrubForLog", () => {
  it("keeps the part of an error that identifies the fault", () => {
    const scrubbed = scrubForLog(new TypeError("Cannot read properties of undefined"));
    expect(scrubbed).toContain("TypeError");
    expect(scrubbed).toContain("Cannot read properties of undefined");
  });

  it("removes a serialized resume carried inside a database error", () => {
    // Nobody logged the document. The driver reported the failing statement
    // together with its parameters, and the parameter *is* the document.
    const error = new Error(
      `UNIQUE constraint failed. Parameters: ${JSON.stringify(midCareerResume)}`,
    );
    const scrubbed = scrubForLog(error);

    expect(scrubbed).toContain("UNIQUE constraint failed");
    expect(scrubbed).not.toContain("Senior Backend Engineer");
    expect(scrubbed).not.toContain(midCareerResume.contact.fullName);
  });

  it("removes email addresses", () => {
    expect(scrubForLog("could not deliver to ada.lovelace@example.co.uk")).toBe(
      "could not deliver to <email>",
    );
  });

  it("removes a sign-in token from a URL", () => {
    // A magic-link token in a log is a working credential for whoever reads
    // the log.
    const scrubbed = scrubForLog(
      "GET /api/auth/callback/email?token=8f14e45fceea167a5a36dedd4bea2543deadbeefcafe&email=a@b.co",
    );
    expect(scrubbed).not.toContain("8f14e45fceea167a5a36dedd4bea2543deadbeefcafe");
    expect(scrubbed).toContain("token=<redacted>");
  });

  it("removes connection strings, which carry credentials", () => {
    expect(
      scrubForLog("failed to connect to smtp://user:hunter2@mail.example.com:587"),
    ).not.toContain("hunter2");
    expect(scrubForLog("open failed: file:/data/app.db")).not.toContain("/data/app.db");
  });

  it("removes a long opaque string that might be a token", () => {
    expect(scrubForLog("session eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij")).toContain(
      "<token>",
    );
  });

  it("truncates a message long enough to be a payload", () => {
    const scrubbed = scrubForLog(`failed to write row ${"and again ".repeat(200)}`);
    expect(scrubbed.length).toBeLessThan(600);
    expect(scrubbed).toMatch(/truncated/);
  });

  it("handles values that are not errors at all", () => {
    expect(scrubForLog("plain string")).toBe("plain string");
    expect(scrubForLog(null)).toBe("null");
    expect(scrubForLog(42)).toBe("42");
  });

  it("does not throw on a circular object", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => scrubForLog(circular)).not.toThrow();
  });

  it("leaves a short structured hint readable", () => {
    // The aim is a log that says what broke, not a log that says nothing.
    expect(scrubForLog({ code: "P2002" })).toContain("P2002");
  });
});

describe("logError", () => {
  it("writes one scrubbed line with the context in front", () => {
    const seen: string[] = [];
    const original = console.error;
    console.error = (message: string) => seen.push(message);
    try {
      logError("mail", new Error("could not send to ada@example.com"));
    } finally {
      console.error = original;
    }

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("[mail]");
    expect(seen[0]).not.toContain("ada@example.com");
  });
});
