/**
 * The sign-in email's content (M2-T2).
 *
 * Two of these are policy tests rather than behaviour tests: no remote asset
 * of any kind, and nothing but the address in the body. Both are easy to
 * break by adding a logo or a "here is your resume" nicety, and neither
 * would fail anything else in the suite.
 */

import { describe, expect, it } from "vitest";
import { describeExpiry, escapeHtml, magicLinkMessage } from "./email";
import { extractSignInLink } from "./mail";

const URL_UNDER_TEST =
  "https://resumes.example.com/api/auth/callback/email?token=abc&email=a%40b.c";

function build(overrides: Partial<Parameters<typeof magicLinkMessage>[0]> = {}) {
  const now = new Date("2026-08-30T12:00:00Z");
  return magicLinkMessage({
    identifier: "ada@example.com",
    url: URL_UNDER_TEST,
    expires: new Date(now.getTime() + 15 * 60_000),
    now,
    ...overrides,
  });
}

describe("magicLinkMessage", () => {
  it("puts a followable link in the plain-text body", () => {
    // The same parser the tests and the dev banner use, so a body no mail
    // client could act on cannot pass this.
    expect(extractSignInLink(build())).toBe(URL_UNDER_TEST);
  });

  it("links to the same URL from the HTML body", () => {
    expect(build().html).toContain(
      `href="https://resumes.example.com/api/auth/callback/email?token=abc&amp;email=a%40b.c"`,
    );
  });

  it("names the host and the address the link was requested for", () => {
    const message = build();
    expect(message.text).toContain("resumes.example.com");
    expect(message.text).toContain("ada@example.com");
  });

  it("says the link is single-use and when it expires", () => {
    const message = build();
    expect(message.text).toMatch(/works once/);
    expect(message.text).toMatch(/15 minutes/);
  });

  it("tells a recipient who did not request it that nothing has happened", () => {
    // Without this the safe response looks like "click it to cancel", which
    // is the opposite of safe.
    expect(build().text).toMatch(/nothing has happened/i);
  });

  it("loads nothing from a remote host", () => {
    // A remote image is a tracking pixel whether or not it was meant as one,
    // and §9 rules out that kind of collection.
    const { html } = build();
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/background(-image)?\s*:/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/<script/i);
  });

  it("escapes the address into the HTML body", () => {
    const message = build({ identifier: "<script>alert(1)</script>@example.com" });
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
  });
});

describe("escapeHtml", () => {
  it("covers the characters that change meaning in markup", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("describeExpiry", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it.each([
    [1, "1 minute"],
    [15, "15 minutes"],
    [89, "89 minutes"],
    [120, "2 hours"],
    [1440, "24 hours"],
  ])("describes %i minutes as %s", (minutes, expected) => {
    expect(describeExpiry(inMinutes(minutes), now)).toBe(expected);
  });

  it("never reports a link as already expired", () => {
    // A link that arrives after its own deadline should still read as
    // something to try, not as a message about a past event.
    expect(describeExpiry(inMinutes(-5), now)).toBe("1 minute");
  });
});
