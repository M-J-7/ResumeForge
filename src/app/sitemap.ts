/**
 * The sitemap.
 *
 * Only the pages worth landing on cold. `/builder` is deliberately absent:
 * it is an application, not a document, it renders as a loading state until
 * the browser hydrates, and a crawler indexing it produces a search result
 * that shows a person nothing. `/dashboard` and `/signin` are absent for the
 * same reason plus a session they will never have.
 */

import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { EXAMPLE_SLUGS } from "@/lib/examples/roles";
import { GUIDE_SLUGS } from "@/lib/guides/guides";

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

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl("/"), changeFrequency: "monthly", priority: 1 },
    // A public tool that answers a question people search for, and the only
    // page here that is worth landing on before the builder itself (P31-A4).
    { url: siteUrl("/check"), changeFrequency: "monthly", priority: 0.9 },
    // The gallery (P32-B3). Its thumbnails need a browser to draw, but its
    // twelve names and descriptions are server-rendered text, which is what
    // a crawler indexes.
    { url: siteUrl("/templates"), changeFrequency: "monthly", priority: 0.8 },

    /*
     * The content surface (P36). Generated from the same arrays the routes
     * read, so a new example or guide appears here by existing rather than by
     * somebody remembering to add it — the failure mode of a hand-maintained
     * sitemap is that it silently stops listing the newest pages, which are
     * exactly the ones that need discovering.
     */
    { url: siteUrl("/examples"), changeFrequency: "monthly", priority: 0.8 },
    ...EXAMPLE_SLUGS.map((slug) => ({
      url: siteUrl(`/examples/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: siteUrl("/guides"), changeFrequency: "monthly", priority: 0.8 },
    ...GUIDE_SLUGS.map((slug) => ({
      url: siteUrl(`/guides/${slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),

    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
