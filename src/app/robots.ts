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
