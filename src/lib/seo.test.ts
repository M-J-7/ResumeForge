/**
 * The tripwire for the metadata every page has to carry.
 *
 * `seo.ts` explains the failure: Next merges `openGraph` and `alternates`
 * shallowly, so a page that declares neither inherits the root layout's —
 * which says this page is the home page, both to a crawler reading the
 * canonical link and to anyone who pastes the URL into a chat window. Eight
 * routes had it, and two of them had been found and fixed by hand a release
 * apart, which is what a defect with no test looks like.
 *
 * The helper makes the right thing easy. This is what keeps the next page
 * anybody adds from going back to the wrong thing — and it is the kind of
 * mistake that cannot be seen from inside the app, only in somebody else's
 * link preview.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageMetadata, appPageMetadata, OG_IMAGE } from "./seo";
import { alt as cardAlt, size as cardSize } from "@/app/opengraph-image";
import { SITE_NAME } from "./site";

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");

/** Every `page.tsx` under `src/app`, as a repository-relative path. */
function pageFiles(dir = APP): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `api` holds route handlers, which render nothing and have no metadata.
      if (entry !== "api") found.push(...pageFiles(full));
      continue;
    }
    if (entry === "page.tsx") found.push(path.relative(ROOT, full));
  }
  return found;
}

describe("every page declares where it lives", () => {
  it("finds the routes to check", () => {
    // A guard on the scanner itself: a glob that silently matches nothing
    // turns every assertion below into a pass.
    expect(pageFiles().length).toBeGreaterThan(10);
  });

  it.each(pageFiles())("%s sets a canonical or opts out of indexing", (file) => {
    const source = readFileSync(path.join(ROOT, file), "utf8");

    /*
     * Four acceptable shapes. The two helpers are the ones to reach for;
     * a hand-written `alternates`/`robots` still counts, because the thing
     * being prevented is a page that declares *neither* and inherits the
     * root's `canonical: "/"`, not a page that spells it out.
     */
    const declares =
      /\bpageMetadata\(/.test(source) ||
      /\bappPageMetadata\(/.test(source) ||
      /alternates:\s*\{\s*canonical/.test(source) ||
      /robots:\s*\{\s*index:\s*false/.test(source);

    expect(declares, `${file} inherits the root layout's canonical, which points at "/"`).toBe(
      true,
    );
  });
});

describe("pageMetadata", () => {
  it("gives the social card its own title, description and URL", () => {
    const meta = pageMetadata({
      title: "Resume templates",
      description: "Twelve free templates.",
      path: "/templates",
    });

    expect(meta.alternates?.canonical).toBe("/templates");
    expect(meta.openGraph?.url).toBe("/templates");
    // The brand is on the card explicitly: `title.template` applies to
    // `title` alone, and an untitled card in a chat window is an anonymous
    // link. See `seo.ts`.
    expect(meta.openGraph?.title).toBe(`Resume templates — ${SITE_NAME}`);
    expect(meta.openGraph?.description).toBe("Twelve free templates.");
  });

  it("asks for the large card, because there is a 1200x630 image to put in it", () => {
    // `summary` crops the card to a small square thumbnail. The site drew a
    // full-size Open Graph image and then asked every scraper to ignore it.
    const meta = pageMetadata({ title: "A", description: "B", path: "/a" });
    expect((meta.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  it("keeps the card image, which a page-level openGraph would otherwise drop", () => {
    /*
     * The regression this exists for. `src/app/opengraph-image.tsx` is
     * file-based metadata at the root segment, and metadata merges shallowly
     * — so a page declaring its own `openGraph` replaces the parent's
     * resolved object whole and the inherited image goes with it. Fixing
     * `og:url` removed `og:image` from every page but the home page, and the
     * only place either fact is visible is the served HTML.
     */
    const meta = pageMetadata({ title: "A", description: "B", path: "/a" });
    expect(meta.openGraph?.images).toEqual([OG_IMAGE]);
    expect((meta.twitter as { images?: string[] }).images).toEqual([OG_IMAGE.url]);
  });

  it("describes the card the image route actually draws", () => {
    // A copy, because importing that module here would pull `next/og` into
    // every page's module graph. This is what stops the copy drifting.
    expect({ width: OG_IMAGE.width, height: OG_IMAGE.height }).toEqual(cardSize);
    expect(OG_IMAGE.alt).toBe(cardAlt);
  });

  it("lets the landing page own its title outright", () => {
    const meta = pageMetadata({
      title: "unused",
      description: "B",
      path: "/",
      absoluteTitle: `Free ATS resume builder — ${SITE_NAME}`,
    });

    expect(meta.title).toEqual({ absolute: `Free ATS resume builder — ${SITE_NAME}` });
    // The product name once, not twice: the card must not append it again.
    expect(meta.openGraph?.title).toBe(`Free ATS resume builder — ${SITE_NAME}`);
  });
});

describe("appPageMetadata", () => {
  it("keeps application surfaces out of the index but still linked", () => {
    const meta = appPageMetadata({
      title: "Your resumes",
      description: "Resumes saved to your account.",
      path: "/dashboard",
    });

    expect(meta.robots).toEqual({ index: false, follow: true });
    // Still canonical: a crawler that follows the header link from an indexed
    // page must not read this as another copy of "/".
    expect(meta.alternates?.canonical).toBe("/dashboard");
  });
});
