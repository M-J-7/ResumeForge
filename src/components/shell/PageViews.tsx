"use client";

/**
 * Counts a view of each page, and where the visit that saw it came from.
 *
 * Mounted once, in the root layout, and renders nothing. A view is sent on
 * arrival and on every client-side navigation after it, for pages on the list
 * in `src/lib/events.ts` — never for an account page's id, never with a query
 * string. The source is sent once per page load: a navigation inside the site
 * keeps the referrer of the load that started it, so counting it again would
 * credit Google with every page a visitor read after arriving from it.
 *
 * `track` does the rest — no cookie, same origin, and nothing at all when the
 * browser says the visitor has asked not to be counted.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { sourceOf, viewEvent } from "@/lib/events";
import { track } from "@/lib/track";

export function PageViews() {
  const pathname = usePathname();
  const arrived = useRef(false);

  useEffect(() => {
    const view = viewEvent(pathname);
    if (view) track(view);

    if (arrived.current) return;
    arrived.current = true;
    const source = sourceOf(document.referrer, window.location.origin);
    if (source) track(`src:${source}`);
  }, [pathname]);

  return null;
}
