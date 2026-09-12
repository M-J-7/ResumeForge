/**
 * The live Auth.js instance (M2-T2).
 *
 * Everything interesting is in `./config.ts`; this file only supplies the
 * real database, the real mail transport, and the real credentials.
 *
 * The config is a function rather than an object because the adapter needs
 * `getPrisma()`, which is async by design — importing a module must not open
 * a database connection as a side effect (see `src/server/db.ts`). Auth.js
 * awaits the function on every request and caches nothing, so `getPrisma()`
 * doing its own caching is what keeps that from being a per-request
 * connection.
 */

import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { getPrisma } from "@/server/db";
import { withIdentityOnlyAccounts } from "./adapter";
import { buildAuthConfig, googleCredentials } from "./config";
import { resolveMailTransport } from "./mail";

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const prisma = await getPrisma();
  return buildAuthConfig({
    // The adapter is written against `@prisma/client`'s own types; ours come
    // from the generated client in `src/generated/prisma`. Structurally the
    // same client, nominally different types — the cast is the whole of the
    // difference, and `db.test.ts` covers the tables it writes to.
    //
    // Wrapped so a linked OAuth account stores what identifies it and not
    // the provider's token response — which does not fit the schema and
    // would fail the first Google sign-in outright. See `./adapter.ts`.
    adapter: withIdentityOnlyAccounts(PrismaAdapter(prisma as never) as Adapter),
    mailTransport: () => resolveMailTransport(),
    google: googleCredentials(),
  });
});
