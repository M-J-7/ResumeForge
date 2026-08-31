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

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export interface AuthEnv {
  AUTH_GOOGLE_ID?: string | undefined;
  AUTH_GOOGLE_SECRET?: string | undefined;
  /** What makes `process.env` assignable to this. */
  [key: string]: string | undefined;
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
  return { clientId, clientSecret };
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
        // Explicit rather than inherited, so the value is visible at the
        // place someone would look to change it. See the header note.
        allowDangerousEmailAccountLinking: false,
        /**
         * Only the three fields the account actually needs.
         *
         * Auth.js's default mapping also returns `image`, Google's avatar
         * URL. Nothing renders it, §7's data model has no column for it, and
         * storing personal data no feature uses is a liability rather than a
         * courtesy — so it is dropped here rather than accepted and ignored.
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
