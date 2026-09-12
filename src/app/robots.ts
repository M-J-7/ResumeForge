/**
 * `robots.txt`.
 *
 * Two rules that matter beyond the defaults:
 *
 * - Anything behind a session is disallowed. `/dashboard` and `/api` are
 *   already unreachable without a cookie, so this is not a security control —
 *   it stops a crawler from filling logs and burning rate-limit budget on
 *   pages it will only ever be redirected away from.
 * - A deployment with no configured origin refuses indexing entirely. A
 *   staging copy that gets indexed competes with the real site in search
 *   results, and that is easy to do by accident and slow to undo.
 */

import type { MetadataRoute } from "next";
import { isPublicDeployment, siteUrl } from "@/lib/site";

/**
 * Evaluated per request, not at build time.
 *
 * The origin comes from the environment, and the environment at build time is
 * not the environment at run time — an image built in CI and run in
 * production would otherwise bake in CI's answer. Since that answer is "no
 * origin configured", the production site would serve a `robots.txt` that
 * disallows everything, and nobody would notice until the search traffic
 * never arrived.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicDeployment()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/builder", "/signin"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
