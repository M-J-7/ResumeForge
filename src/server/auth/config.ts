/**
 * Auth.js configuration (M2-T2).
 *
 * Built as a pure function of its dependencies rather than assembled at
 * module scope, so the composition can be asserted in a unit test without
 * booting Next, opening a database, or holding real OAuth credentials.
 * `./index.ts` is the thin layer that supplies the real ones.
 *
 * ## No passwords, and no room for one later (D7)
 *
 * Two providers, both passwordless: an email magic link and Google. There is
 * no Credentials provider and no password column in the schema. That single
 * decision deletes password reset, breach exposure, credential stuffing, and
 * login rate limiting — weeks of security-sensitive work a solo developer
 * would otherwise own forever.
 *
 * ## Sessions live in the database, not in a JWT
 *
 * The plan says "sessions in the same SQLite file", and the reason is
 * sign-out. A JWT session cannot be revoked; signing out only deletes the
 * cookie, and a copy of that token keeps working until it expires. M2-T2's
 * acceptance says sign-out clears everything, which is only true of a
 * session the server can delete. The cost is one indexed row read per
 * request, which is exactly what the `Session.sessionToken` unique index is
 * for.
 *
 * ## Account linking is deliberately off
 *
 * If someone signs in by magic link and later uses Google with the same
 * address, Auth.js reports `OAuthAccountNotLinked` rather than merging the
 * accounts. That is the safe default: automatic linking trusts an OAuth
 * provider's email claim, and a provider that does not verify addresses
 * turns "sign in with X" into account takeover. The recovery here is good —
 * the magic link to the same address always works — so the sign-in page
 * explains it rather than the config weakening it.
 */

import type { NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import { magicLinkMessage } from "./email";
import type { MailTransport } from "./mail";
import { logWarning } from "@/server/logging";

/**
 * How long a magic link stays valid.
 *
 * Auth.js defaults to 24 hours. That is a long time for a working sign-in
 * link to sit in an inbox that may be synced to a shared device, and the
 * cost of a shorter window is one extra click. Fifteen minutes still covers
 * a slow mail relay.
 */
export const MAGIC_LINK_MAX_AGE_SECONDS = 15 * 60;

/** Session lifetime, refreshed at most once a day to keep writes down. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

export const EMAIL_PROVIDER_ID = "email";
export const GOOGLE_PROVIDER_ID = "google";

/** Google's OpenID issuer — where every real deployment discovers from. */
export const GOOGLE_ISSUER = "https://accounts.google.com";

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  /** The OpenID issuer the provider discovers its endpoints from. */
  issuer: string;
}

export interface AuthEnv {
  AUTH_GOOGLE_ID?: string | undefined;
  AUTH_GOOGLE_SECRET?: string | undefined;
  AUTH_GOOGLE_ISSUER?: string | undefined;
  /** What makes `process.env` assignable to this. */
  [key: string]: string | undefined;
}

/** Hosts an `http:` issuer may live on: the ones that cannot leave the machine. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * The issuer to discover Google's endpoints from.
 *
 * Google's, unless `AUTH_GOOGLE_ISSUER` names another one. That override
 * exists for one reason: it lets the end-to-end suite run the **real** OAuth
 * code path — real discovery, real PKCE, a real signed `id_token`, the real
 * adapter write — against a local issuer, the same way `EMAIL_SERVER` points
 * the real SMTP transport at a capture server instead of stubbing the send.
 * Google's own consent screen is the only thing left for a human.
 *
 * It is honoured for `https:`, and for `http:` on loopback only. A plain-HTTP
 * issuer on any other host would put the authorization code and the id_token
 * on the wire in clear text, and a mistyped or injected value would send
 * every sign-in to whoever answers there. Anything else is discarded in
 * favour of Google: a deployment that gets this wrong keeps working against
 * the real provider rather than quietly trusting a fake one.
 */
export function googleIssuer(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return GOOGLE_ISSUER;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    warnOnce(`AUTH_GOOGLE_ISSUER is not a URL; using ${GOOGLE_ISSUER}`);
    return GOOGLE_ISSUER;
  }

  if (url.protocol === "https:") return value;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return value;

  warnOnce(`AUTH_GOOGLE_ISSUER must be https, or http on loopback; using ${GOOGLE_ISSUER}`);
  return GOOGLE_ISSUER;
}

/**
 * Warns once per process.
 *
 * The config is rebuilt on every request that touches `auth()`, so warning
 * unconditionally would put a line in the log for every page view — enough
 * noise to bury the thing it is warning about.
 */
let warned = false;
function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  logWarning("auth/config", message);
}

/**
 * Google is configured only when both halves are present.
 *
 * Half-configured is worse than absent: the button renders, the user clicks
 * it, and the failure surfaces as an opaque provider error after a redirect
 * away from the site.
 */
export function googleCredentials(env: AuthEnv = process.env): GoogleCredentials | null {
  const clientId = env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = env.AUTH_GOOGLE_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, issuer: googleIssuer(env.AUTH_GOOGLE_ISSUER) };
}

export interface BuildAuthConfigOptions {
  adapter: Adapter;
  /**
   * Resolved lazily, and only when a link is actually being sent. Resolving
   * at config time would make a missing mail configuration break every
   * `auth()` call — including the ones that only read an existing session,
   * which need no mail at all.
   */
  mailTransport: () => MailTransport;
  google: GoogleCredentials | null;
}

export function buildAuthConfig({
  adapter,
  mailTransport,
  google,
}: BuildAuthConfigOptions): NextAuthConfig {
  const providers: NextAuthConfig["providers"] = [
    {
      // A plain provider object rather than Auth.js's `Nodemailer` factory:
      // that factory throws unless given an SMTP server, which would rule
      // out the file-outbox transport the tests depend on. Everything it
      // would have done for us — the token, the hashing, the single-use
      // consumption — is Auth.js's job either way; only delivery is ours.
      id: EMAIL_PROVIDER_ID,
      type: "email",
      name: "Email",
      maxAge: MAGIC_LINK_MAX_AGE_SECONDS,
      async sendVerificationRequest({ identifier, url, expires }) {
        const message = magicLinkMessage({ identifier, url, expires });
        await mailTransport().send({ to: identifier, ...message });
      },
    },
  ];

  if (google) {
    providers.push(
      Google({
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        // Google's, except under the end-to-end suite. Everything else about
        // the provider — endpoints, PKCE, the id_token — follows from
        // discovering this. See `googleIssuer`.
        issuer: google.issuer,
        /**
         * Always show the account chooser.
         *
         * Without a `prompt`, Google reuses whatever account the browser is
         * already signed into and returns immediately. The user never sees a
         * choice — the button just blinks and they are signed in, possibly as
         * someone they did not intend to be. Most people applying for jobs
         * have a personal account and a work or university one, and the
         * account they land on here is the one their resumes belong to
         * forever: account linking is deliberately off (see the header note),
         * so picking the wrong one is not something they can undo from
         * inside this app.
         *
         * `select_account` is also simply what "Sign in with Google" looks
         * like everywhere else, and a login that behaves unlike every other
         * Google login reads as broken even when it works.
         *
         * Not `consent`, which re-asks for scope approval on every single
         * sign-in. That is noise for a login requesting nothing beyond
         * identity, and it trains people to click through consent screens.
         *
         * No `access_type: "offline"` either. That asks for a refresh token,
         * and per the 2026-08-31 amendment to D7 `./adapter.ts` stores no
         * tokens at all — nothing here calls a Google API after sign-in. A
         * credential we would discard on arrival is pure breach liability.
         */
        authorization: { params: { prompt: "select_account" } },
        // Explicit rather than inherited, so the value is visible at the
        // place someone would look to change it. See the header note.
        allowDangerousEmailAccountLinking: false,
        /**
         * All three checks, because Auth.js's default is one.
         *
         * A provider with no `checks` of its own gets `["pkce"]`, which
         * leaves `state` and `nonce` off the authorization request
         * entirely. PKCE does carry most of the weight — a code stolen or
         * planted cannot be redeemed without the verifier sealed in the
         * browser's own cookie — but it carries it alone, and the whole
         * defence then rests on that one cookie behaving. `state` is the
         * CSRF check the OAuth spec asks for, and `nonce` binds the
         * id_token to this request rather than to any earlier one. Both are
         * a cookie and a query parameter; neither costs the user anything.
         */
        checks: ["pkce", "state", "nonce"],
        /**
         * Only the three fields the account actually needs.
         *
         * Auth.js's default mapping also returns `image`, Google's avatar
         * URL. Nothing renders it, §7's data model has no column for it, and
         * storing personal data no feature uses is a liability rather than a
         * courtesy — so it is dropped here rather than accepted and ignored.
         *
         * Dropping it here is only half of it: the same claim rides inside
         * the `id_token`, which is why `./adapter.ts` keeps that out of the
         * database too.
         */
        profile: (profile: { sub: string; name?: string; email: string }) => ({
          id: profile.sub,
          name: profile.name ?? null,
          email: profile.email,
        }),
      }),
    );
  }

  return {
    adapter,
    providers,
    session: {
      strategy: "database",
      maxAge: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    pages: {
      signIn: "/signin",
      verifyRequest: "/signin/check-email",
      error: "/signin",
    },
    callbacks: {
      /**
       * Puts the user id on the session.
       *
       * Every resume row is scoped by `userId`, so without this the data
       * layer would have to re-look-up the user by email on every request —
       * a second query, and one keyed on a mutable field.
       */
      session({ session, user }) {
        if (session.user) session.user.id = user.id;
        return session;
      },
    },
  };
}
