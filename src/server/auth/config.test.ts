/**
 * Auth.js composition (M2-T2).
 *
 * The provider list and the session strategy are the two things most likely
 * to be changed casually and most consequential if they are, so both are
 * asserted here rather than left to be discovered on a deploy:
 *
 *   - a Credentials provider must never appear, because D7's "no passwords"
 *     is only structurally true while there is nothing that accepts one;
 *   - the session strategy must stay `database`, because M2-T2's "sign-out
 *     clears everything" is unachievable with a JWT that no server can
 *     revoke.
 */

import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "next-auth/adapters";
import {
  buildAuthConfig,
  EMAIL_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
  googleCredentials,
  MAGIC_LINK_MAX_AGE_SECONDS,
} from "./config";
import { describeAuthError, errorFromRedirectUrl, FALLBACK_AUTH_ERROR } from "./errors";
import { memoryTransport } from "./mail";
import { extractSignInLink } from "./mail";

/** Nothing here touches the adapter; it only has to be present. */
const adapter = {} as Adapter;

function build(google: { clientId: string; clientSecret: string } | null = null) {
  const transport = memoryTransport();
  const config = buildAuthConfig({ adapter, mailTransport: () => transport, google });
  return { config, transport };
}

/**
 * Resolves a provider the way Auth.js does at request time.
 *
 * A provider factory returns its user config nested under `options`, and
 * `parseProviders` merges that over the defaults before anything reads it.
 * A test that looks at the top level only would see `undefined` for every
 * option the caller actually set.
 */
function resolveProviders(config: ReturnType<typeof build>["config"]): Record<string, unknown>[] {
  return config.providers.map((provider) => {
    const resolved = (typeof provider === "function" ? provider() : provider) as unknown as Record<
      string,
      unknown
    > & { options?: Record<string, unknown> };
    const { options, ...defaults } = resolved;
    return { ...defaults, ...options };
  });
}

function providerIds(config: ReturnType<typeof build>["config"]): string[] {
  return resolveProviders(config).map((provider) => String(provider.id ?? ""));
}

describe("providers", () => {
  it("always offers the email flow", () => {
    expect(providerIds(build().config)).toContain(EMAIL_PROVIDER_ID);
  });

  it("omits Google when it has no credentials", () => {
    // Half-configured is worse than absent: the button would render, and
    // the failure would land on Google's error page after a redirect away.
    expect(providerIds(build().config)).not.toContain(GOOGLE_PROVIDER_ID);
  });

  it("adds Google when both halves are present", () => {
    const { config } = build({ clientId: "id", clientSecret: "secret" });
    expect(providerIds(config)).toContain(GOOGLE_PROVIDER_ID);
  });

  it("never includes a credentials provider (D7)", () => {
    const { config } = build({ clientId: "id", clientSecret: "secret" });
    expect(resolveProviders(config).map((provider) => provider.type)).not.toContain("credentials");
  });

  it("does not link a Google account onto an existing address automatically", () => {
    const { config } = build({ clientId: "id", clientSecret: "secret" });
    const google = resolveProviders(config).find((provider) => provider.id === GOOGLE_PROVIDER_ID);
    expect(google).toBeDefined();
    expect(google?.allowDangerousEmailAccountLinking).toBe(false);
  });
});

describe("email provider", () => {
  function emailProvider(config: ReturnType<typeof build>["config"]) {
    const resolved = resolveProviders(config).find((provider) => provider.id === EMAIL_PROVIDER_ID);
    return resolved as unknown as {
      maxAge: number;
      sendVerificationRequest: (params: {
        identifier: string;
        url: string;
        expires: Date;
      }) => Promise<void>;
    };
  }

  it("sends the link through the injected transport", async () => {
    const { config, transport } = build();
    await emailProvider(config).sendVerificationRequest({
      identifier: "ada@example.com",
      url: "https://example.com/api/auth/callback/email?token=abc",
      expires: new Date(Date.now() + MAGIC_LINK_MAX_AGE_SECONDS * 1000),
    });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]?.to).toBe("ada@example.com");
    expect(extractSignInLink(transport.sent[0]!)).toBe(
      "https://example.com/api/auth/callback/email?token=abc",
    );
  });

  it("resolves the transport only when a link is actually being sent", () => {
    // Resolving at config time would make a missing mail configuration break
    // every `auth()` call, including the ones that only read a session.
    const mailTransport = vi.fn(() => memoryTransport());
    buildAuthConfig({ adapter, mailTransport, google: null });
    expect(mailTransport).not.toHaveBeenCalled();
  });

  it("expires links well short of Auth.js's 24-hour default", () => {
    expect(emailProvider(build().config).maxAge).toBe(MAGIC_LINK_MAX_AGE_SECONDS);
    expect(MAGIC_LINK_MAX_AGE_SECONDS).toBeLessThan(60 * 60);
  });
});

describe("session", () => {
  it("keeps sessions in the database so sign-out can revoke them", () => {
    expect(build().config.session?.strategy).toBe("database");
  });

  it("puts the user id on the session, which every resume query is scoped by", () => {
    const { config } = build();
    const session = config.callbacks?.session?.({
      session: { user: { email: "a@b.c" }, expires: "" },
      user: { id: "user-1", email: "a@b.c", emailVerified: null },
    } as never) as { user?: { id?: string } };
    expect(session.user?.id).toBe("user-1");
  });

  it("routes Auth.js's own pages to ours", () => {
    const { config } = build();
    expect(config.pages).toMatchObject({
      signIn: "/signin",
      verifyRequest: "/signin/check-email",
      error: "/signin",
    });
  });
});

describe("googleCredentials", () => {
  it("requires both halves", () => {
    expect(googleCredentials({ AUTH_GOOGLE_ID: "id" })).toBeNull();
    expect(googleCredentials({ AUTH_GOOGLE_SECRET: "secret" })).toBeNull();
    expect(googleCredentials({ AUTH_GOOGLE_ID: " ", AUTH_GOOGLE_SECRET: "secret" })).toBeNull();
  });

  it("trims what it accepts", () => {
    expect(googleCredentials({ AUTH_GOOGLE_ID: " id ", AUTH_GOOGLE_SECRET: " secret " })).toEqual({
      clientId: "id",
      clientSecret: "secret",
    });
  });
});

describe("error messages", () => {
  it("explains the two-provider collision instead of naming it", () => {
    const message = describeAuthError("OAuthAccountNotLinked");
    expect(message).toBeTruthy();
    expect(message).not.toContain("OAuthAccountNotLinked");
    // The recovery has to be in the message: there is no password to reset,
    // so "use the other flow" is the only thing the user can do.
    expect(message).toMatch(/link/i);
  });

  it("tells the user a used link is expected behaviour, not a broken account", () => {
    expect(describeAuthError("Verification")).toMatch(/once|expired/i);
  });

  it("falls back rather than showing a raw code", () => {
    expect(describeAuthError("SomethingNew")).toBe(FALLBACK_AUTH_ERROR);
  });

  it("returns nothing when there is no error", () => {
    expect(describeAuthError(null)).toBeNull();
    expect(describeAuthError(undefined)).toBeNull();
  });

  it("reads an error out of a URL Auth.js handed back", () => {
    // `signIn(..., { redirect: false })` returns a failure as a URL rather
    // than throwing, so the action has to look at what it got back.
    expect(errorFromRedirectUrl("https://x.test/signin?error=Configuration")).toMatch(
      /server configuration|not configured/i,
    );
    expect(
      errorFromRedirectUrl("https://x.test/api/auth/verify-request?provider=email"),
    ).toBeNull();
  });
});
