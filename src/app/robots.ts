/**
 * `robots.txt`.
 *
 * Two rules that matter beyond the defaults:
 *
 * - Anything behind a session is disallowed. `/dashboard` and `/api` are
 *   already unreachable without a cookie, so this is not a security control —
 *   it stops a crawler from filling logs and burning rate-limit budget on
 *   pages it will only ever be redirected away from.
 * - **The application surfaces a crawler can actually reach are not.**
 *   `/builder`, `/signin` and `/letters` were in this list, and all three are
 *   linked from the header or the footer of every indexed page. A URL that is
 *   linked everywhere and disallowed here is the textbook way to be listed as
 *   a bare URL with "No information is available for this page" underneath
 *   it: `Disallow` forbids *fetching*, not indexing, and the `noindex` that
 *   would have kept the page out is inside a document the crawler was told
 *   not to fetch. They carry `robots: { index: false }` through
 *   `appPageMetadata` instead, which works precisely because they can be
 *   read. `/dashboard` keeps the disallow — it is linked only to somebody who
 *   is already signed in, so no crawler ever meets it.
 * - A deployment with no configured origin refuses indexing entirely. A
 *   staging copy that gets indexed competes with the real site in search
 *   results, and that is easy to do by accident and slow to undo.
 */

import type { MetadataRoute } from "next";
import { isPublicDeployment, siteUrl } from "@/lib/site";

/*
 * Prerendered, as a file — since 2026-09-30.
 *
 * This used to be `force-dynamic`, for a reason that was right when it was
 * written: the origin came from the run-time environment, and an image built
 * in CI would have baked in CI's answer — "no origin", so a robots.txt that
 * disallows everything. Landmine 27 removed that reason. The image is now
 * built with the public origin as a build argument, and the Dockerfile
 * refuses to build without one, so the origin at build time *is* the one at
 * run time.
 *
 * And the per-request version had started to cost something. Rendered on a
 * 1/8-OCPU instance for every crawler that asked, it failed to arrive once
 * during a Lighthouse run against the live site, and Google reads a
 * robots.txt it cannot fetch as a reason to stop crawling. A file cannot fail
 * that way.
 */

export default function robots(): MetadataRoute.Robots {
  if (!isPublicDeployment()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
