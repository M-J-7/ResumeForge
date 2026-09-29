/**
 * The site's icons: ours, in the card's colours, and in the shapes asked for.
 *
 * The favicon shipped from the first commit until 2026-09-28 was
 * create-next-app's — the Vercel triangle, beside every search result and in
 * every tab. Nothing failed: it is a valid icon, it just belongs to somebody
 * else. The first assertion is the one that would have caught it.
 *
 * `icon.svg` restates the social card's palette as hex, for the same reason
 * the card does (a renderer that reads no custom properties), so it is held to
 * the card's constants here the way `opengraph-image.test.ts` holds the card
 * to the stylesheet. Regenerate the raster files with
 * `node scripts/build-icons.mjs` after changing the SVG.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OG_ACCENT, OG_BACKGROUND } from "./opengraph-image";

const APP = path.join(process.cwd(), "src", "app");

/** md5 of the `favicon.ico` create-next-app writes. */
const STARTER_FAVICON_MD5 = "c30c7d42707a47a3f4591831641e50dc";

describe("site icons", () => {
  it("are not the starter favicon, and are drawn in the card's palette", () => {
    const favicon = readFileSync(path.join(APP, "favicon.ico"));
    expect(createHash("md5").update(favicon).digest("hex")).not.toBe(STARTER_FAVICON_MD5);

    const svg = readFileSync(path.join(APP, "icon.svg"), "utf8").toLowerCase();
    expect(svg).toContain(OG_BACKGROUND.toLowerCase());
    expect(svg).toContain(OG_ACCENT.toLowerCase());
  });

  it("ship favicon.ico at the sizes browsers and Google ask for", () => {
    // Google asks for a multiple of 48px; tabs draw at 16 and 32.
    const ico = readFileSync(path.join(APP, "favicon.ico"));
    expect(ico.readUInt16LE(2), "not an icon resource").toBe(1);

    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, index) => ico[6 + index * 16] || 256);
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48]));
  });
});
