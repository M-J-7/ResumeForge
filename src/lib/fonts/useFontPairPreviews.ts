"use client";

/**
 * Loads each font pair's Regular weight as a real, usable browser font, so
 * the design panel can show "Modern" set in Arimo rather than in a generic
 * sans fallback (P23-F3).
 *
 * ## Why this exists at all
 *
 * The font files are already vendored and served from `/fonts/` — that
 * pipeline exists for react-pdf's `Font.register` and for the worker that
 * measures text for pagination, both DOM-adjacent but neither one puts a
 * `@font-face` in the page's own stylesheet. Nothing before this needed the
 * *browser* to render prose in these faces; a settings panel showing what
 * each pair actually looks like is the first thing that does.
 *
 * ## Why the FontFace API instead of a stylesheet
 *
 * A `<style>` block with five `@font-face` rules would work, but it loads
 * all five the moment the module is imported. `document.fonts.add` lets each
 * `FontFace` be constructed lazily — only when the design panel first opens —
 * and the browser's own font cache means opening it twice costs one request
 * per family, not five per visit.
 */

import { useEffect, useState } from "react";
import { FONT_PAIR_IDS, FONT_PAIRS, type FontPairId } from "./pairs";
import { fontFileUrl } from "./paths.browser";
import { fontFileName } from "./files";

let loadOnce: Promise<void> | null = null;

function loadAllPreviewFaces(): Promise<void> {
  loadOnce ??= Promise.all(
    FONT_PAIR_IDS.map(async (id) => {
      const { family } = FONT_PAIRS[id];
      // Regular only. A settings swatch shows a name and a short label, never
      // bold or italic text, so the other three weights per family would be
      // pure unused download.
      const url = fontFileUrl(fontFileName(family, "Regular"));
      const face = new FontFace(family, `url(${url})`);
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => undefined)
    .catch(() => undefined); // A failed load leaves the fallback stack showing; not fatal.

  return loadOnce;
}

/** True once every pair's preview face has attempted to load (success or not). */
export function useFontPairPreviewsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadAllPreviewFaces().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

/** The CSS `font-family` value for a pair's preview, falling back gracefully until loaded. */
export function previewFontFamily(id: FontPairId): string {
  const { family } = FONT_PAIRS[id];
  return `"${family}", ui-sans-serif, system-ui, sans-serif`;
}
