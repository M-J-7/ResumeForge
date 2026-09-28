/**
 * Page metadata, in one shape that cannot be half-written.
 *
 * ## The bug this exists to close
 *
 * Next merges metadata **shallowly**, and `openGraph` is a nested field. The
 * root layout declares one — `title: SITE_NAME`, `url: "/"` — and *no page in
 * this app declared its own*, so every route inherited it whole. The result
 * was not subtle: sharing `/check`, `/pricing` or any of the twelve content
 * pages in Slack, on LinkedIn or in a message to a friend who is job hunting
 * rendered a card titled "Six Seconds Resume", described with the site
 * blurb, pointing at the home page. Twenty distinct pages, one card.
 *
 * It is the same failure the privacy page's comment already describes for
 * `alternates.canonical` — a page that inherits the root's `canonical: "/"`
 * is telling a crawler it *is* the home page — caught there one route at a
 * time and missed everywhere else. Two routes were fixed by hand and six
 * still had it.
 *
 * A helper is the fix rather than a note in a review checklist, because the
 * failure is invisible from inside the app: the page looks right, the title
 * is right, and the only place the mistake shows is in somebody else's link
 * preview or in a search result nobody is looking at yet.
 *
 * ## Why it restates the card image
 *
 * The first version of this helper did not, on the reading that
 * `src/app/opengraph-image.tsx` is file-based metadata and the Next
 * documentation says file-based metadata "has the higher priority and will
 * override the `metadata` object". That is true **within a segment** and
 * misleading across them. The image file sits at the root segment; metadata
 * merges *shallowly*; so a page that declares its own `openGraph` replaces
 * the parent's resolved object whole, and there is no `opengraph-image` in
 * the page's own segment to put the image back.
 *
 * The symptom was that fixing `og:url` silently removed `og:image` from every
 * page except the home page — a worse card than the wrong one it replaced.
 * It was caught by reading the served HTML, which is the only place either
 * fact is visible, and is the reason `builder.spec.ts` now asserts on it.
 */

import type { Metadata } from "next";
import { SITE_NAME, siteUrl } from "./site";

/**
 * The card, restated so a page-level `openGraph` cannot drop it.
 *
 * A copy of what `src/app/opengraph-image.tsx` exports, not an import of it:
 * that module pulls in `next/og`, and importing it here would put an image
 * renderer in the module graph of every page in the app. `seo.test.ts` holds
 * these values to the image's own `size` and `alt`, so the copy cannot drift
 * — the same arrangement `opengraph-image.test.ts` uses to keep the card's
 * hex literals in step with the stylesheet.
 */
export const OG_IMAGE = {
  /**
   * The generated route. Next serves it from the root segment.
   *
   * Written without the `?<hash>` cache-buster Next appends when it emits
   * this tag itself, because that hash is not knowable from here. The cost is
   * that a scraper holding an old copy will not be prompted to re-fetch by
   * the URL changing; the alternative was keeping the hash and losing the
   * per-page title and URL, which is the larger of the two by a distance.
   * Slack, LinkedIn and X all re-scrape on request.
   */
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Build an ATS-safe resume in your browser. Free, forever.",
} as const;

export interface PageMetadataInput {
  /** The page title, without the product name — the template appends it. */
  title: string;
  /** One sentence to two, under 160 characters. Shown in the search result. */
  description: string;
  /** The route this page lives at, leading slash included. */
  path: string;
  /**
   * A title that owns the whole tag, template and all.
   *
   * The landing page is the one caller: `%s — Six Seconds Resume` over a
   * title that already carries the name would print it twice.
   */
  absoluteTitle?: string;
}

/**
 * An indexable page: canonical, Open Graph and Twitter, from one description.
 *
 * The social card's title carries the product name explicitly. `title.template`
 * applies to `title` alone, and a card that arrives in a chat window with no
 * brand on it is an anonymous link — which is most of what a preview is for.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle,
}: PageMetadataInput): Metadata {
  const social = absoluteTitle ?? `${title} — ${SITE_NAME}`;

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: social,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: social,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

/**
 * An application surface: the builder, the dashboard, the letter editor.
 *
 * These are not documents. They render as a loading state until the browser
 * hydrates, half of them need a session, and a search result pointing at one
 * shows a person nothing — so they are `noindex` rather than merely absent
 * from the sitemap, and they carry their own canonical so that a crawler
 * following a link from the header does not read `canonical: "/"` and
 * conclude it has found the home page again.
 *
 * `follow` stays on: the links out of these pages are the ordinary site
 * navigation, and there is no reason to strand it.
 */
export function appPageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: true },
  };
}

/** Where `pageMetadata` says a page lives, as an absolute URL. */
export function canonicalUrl(path: string): string {
  return siteUrl(path);
}
