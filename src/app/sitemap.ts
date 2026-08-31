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
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
