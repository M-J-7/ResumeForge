/**
 * What an OAuth sign-in is allowed to write to the `Account` table (M2-T2).
 *
 * Auth.js hands the adapter the provider's **entire token response** — it
 * spreads the JSON the token endpoint returned into the account object and
 * the Prisma adapter passes that straight to `account.create`. Two separate
 * things go wrong with that here, and the first one is fatal.
 *
 * ## Google's token response does not fit the schema
 *
 * Google returns `expires_in`. §7's `Account` model has no such column: it
 * has `expires_at`, which Auth.js computes and adds *alongside* rather than
 * instead. Prisma rejects unknown arguments, so the first Google sign-in
 * ever attempted fails inside `linkAccount` — after the user has already
 * consented — and surfaces as `?error=Configuration`, a message about
 * server configuration that points nowhere near the token response.
 *
 * This is invisible to every check that does not run the real handshake,
 * which is why `e2e/oidc-server.ts` returns `expires_in` exactly as Google
 * does: the regression this guards against is the one that shipped.
 *
 * ## And the rest of it is a liability with no use
 *
 * The remaining fields are an access token, a refresh token, and an
 * `id_token` — a JWT whose claims include `picture`, the avatar URL that
 * `buildAuthConfig`'s profile mapper deliberately drops and that §7 has no
 * column for. Storing it inside a blob is still storing it. The tokens are
 * live credentials for someone's Google account, kept in a database that
 * would otherwise hold nothing an attacker could use elsewhere, for a
 * product that never calls a Google API after sign-in.
 *
 * So the account row keeps what identifies the account and nothing else.
 * The four fields below are exactly what `getUserByAccount` looks up by,
 * which is the only read this table ever gets.
 */

import type { Adapter, AdapterAccount } from "next-auth/adapters";

/**
 * Reduces a linked account to the fields that identify it.
 *
 * Written as an allowlist rather than a blocklist on purpose: a provider
 * that returns a field nobody anticipated is the case that breaks, and a
 * blocklist is a list of the fields somebody already thought of.
 */
export function accountIdentity(account: AdapterAccount): AdapterAccount {
  const { userId, type, provider, providerAccountId } = account;
  return { userId, type, provider, providerAccountId };
}

/**
 * Wraps an adapter so linked accounts are stored identity-only.
 *
 * Everything else about the adapter is untouched — this is not a
 * reimplementation, and a future adapter method arrives working rather
 * than missing.
 */
export function withIdentityOnlyAccounts(adapter: Adapter): Adapter {
  const { linkAccount } = adapter;
  if (!linkAccount) return adapter;
  return {
    ...adapter,
    linkAccount: (account) => linkAccount(accountIdentity(account)),
  };
}
