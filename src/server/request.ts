/**
 * Facts about the incoming request that the app is allowed to act on.
 *
 * ## `x-forwarded-for` is a claim, not a fact
 *
 * Any client can send it. It is only meaningful when a reverse proxy the
 * operator controls **overwrites** it — which is the normal configuration on
 * Railway, Render, Fly, and any sane nginx, but is not automatic and is not
 * verifiable from inside the app.
 *
 * That is why it is used for rate limiting and nothing else. A forged header
 * lets an attacker spread their own attempts across fake addresses, which
 * costs them the per-address limit that still applies; it does not let them
 * impersonate anyone or reach anyone else's data, because nothing here is
 * authorised by IP. Authorisation is the session, always.
 */

import { headers } from "next/headers";

/** The client's address as the proxy reported it, or null. */
export async function clientIp(): Promise<string | null> {
  const incoming = await headers();

  // The leftmost entry is the original client; everything after it is the
  // chain of proxies that forwarded the request.
  const forwarded = incoming.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return incoming.get("x-real-ip")?.trim() || null;
}
