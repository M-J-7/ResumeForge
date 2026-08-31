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

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
