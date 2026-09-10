/**
 * The social card's palette, pinned to the stylesheet (§10.4b).
 *
 * `next/og` renders through Satori, which resolves no custom properties and
 * no Tailwind, so the card has to restate the palette as hex literals. That
 * is a copy, and copies drift silently — a redesign would change the site and
 * leave every share of every URL rendering in last year's colours, which is
 * exactly the kind of thing nobody notices because nobody looks at their own
 * link previews.
 *
 * So the literals are read back out of `globals.css` here. This does not test
 * the image; it tests that the two files still agree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OG_ACCENT, OG_BACKGROUND, OG_MUTED, OG_TEXT, alt, size } from "./opengraph-image";

const CSS = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

/**
 * The dark palette block, and only that one.
 *
 * `:root[data-theme="dark"]` is the canonical declaration; the
 * `prefers-color-scheme` fallback repeats it verbatim, and
 * `:root[data-theme="dark"] .band-invert` redeclares several of the same
 * names with *different* values — which is why this cannot simply take the
 * last match in the file.
 */
const DARK_BLOCK = (() => {
  const start = CSS.indexOf(':root[data-theme="dark"] {');
  expect(start, "the dark palette block moved").toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf("\n}", start));
})();

function darkToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`).exec(DARK_BLOCK);
  expect(match, `--${name} is not declared in the dark palette block`).not.toBeNull();
  return (match?.[1] ?? "").toLowerCase();
}

describe("the Open Graph card", () => {
  it("is the size every scraper expects", () => {
    // 1200×630 is what LinkedIn, Slack and X all crop against; anything else
    // gets letterboxed or refused.
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("has alt text, because a link preview is read aloud too", () => {
    expect(alt.length).toBeGreaterThan(20);
  });

  it("uses the palette's own dark surface and accent", () => {
    expect(OG_BACKGROUND.toLowerCase()).toBe(darkToken("surface-1"));
    expect(OG_ACCENT.toLowerCase()).toBe(darkToken("accent"));
    expect(OG_TEXT.toLowerCase()).toBe(darkToken("text"));
    expect(OG_MUTED.toLowerCase()).toBe(darkToken("text-muted"));
  });
});
