/**
 * URL access to the vendored font files. Browser only.
 *
 * The files are served from `public/fonts/`, populated by
 * `scripts/sync-public-fonts.mjs` on `predev` and `prebuild`. Node reads the
 * same binaries straight off disk via `./paths.node.ts`.
 */

export const FONT_URL_PREFIX = "/fonts";

export function fontFileUrl(fileName: string): string {
  return `${FONT_URL_PREFIX}/${fileName}`;
}

export const browserFontResolver = fontFileUrl;
