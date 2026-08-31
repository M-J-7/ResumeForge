/**
 * The one gate every signed-in surface goes through (M2-T2).
 *
 * Kept out of `./index.ts` because it imports `next/navigation`, and the
 * auth instance is also reached from places where redirecting is not a
 * meaningful response — a Server Action returning a value, say.
 *
 * The check lives here rather than in `proxy.ts`. Two reasons, and the
 * second is the one that matters:
 *
 *   1. Proxy runs before routes and is documented as deployable to a CDN
 *      edge. This session lives in SQLite behind a native module, which
 *      cannot load there.
 *   2. Proxy sees requests to *pages*. Server Actions are reachable by
 *      direct POST, so a gate that only guards page routes guards the part
 *      an attacker was not going to use. Every action here re-checks, and
 *      every query in `server/resumes.ts` takes ownership as an argument.
 *
 * Route-level use of this function is therefore for the redirect, not for
 * the security. The security is in the data layer.
 */

import { redirect } from "next/navigation";
import { auth } from "./index";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** The signed-in user, or `null`. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, name: user.name ?? null };
}

/** The signed-in user, or a redirect to sign-in. Never returns null. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/signin?error=SessionRequired");
  return user;
}
