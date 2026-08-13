/**
 * Registers vendored fonts with react-pdf.
 *
 * The source of each file differs by environment — a filesystem path under
 * Node (tests, scripts) and a URL in the browser (where the preview renders
 * the real PDF, per D2) — so the resolver is injected rather than assumed.
 */

import { Font } from "@react-pdf/renderer";
import { FONT_PAIRS, type FontPairId } from "./pairs";
import { fontFilesForPair } from "./files";

/** Maps a bare filename such as `Arimo-Bold.ttf` to something react-pdf can load. */
export type FontSourceResolver = (fileName: string) => string;

const registered = new Set<string>();

/**
 * react-pdf hyphenates by default, breaking words across lines with inserted
 * hyphens. That is wrong twice over for a resume: it looks unprofessional, and
 * a hyphen injected mid-word is a real hazard for text extraction — a parser
 * reading "Kuber-\nnetes" does not match a search for "Kubernetes".
 *
 * This disables it globally. Call before rendering anything.
 */
export function disableHyphenation(): void {
  Font.registerHyphenationCallback((word) => [word]);
}

/** Registers one pair. Repeat calls for the same pair are ignored. */
export function registerFontPair(id: FontPairId, resolve: FontSourceResolver): void {
  const { family } = FONT_PAIRS[id];
  if (registered.has(family)) return;

  Font.register({
    family,
    fonts: fontFilesForPair(id).map((ref) => ({
      src: resolve(ref.file),
      fontWeight: ref.fontWeight,
      fontStyle: ref.fontStyle,
    })),
  });

  registered.add(family);
}

export function registerAllFontPairs(resolve: FontSourceResolver): void {
  for (const id of Object.keys(FONT_PAIRS) as FontPairId[]) {
    registerFontPair(id, resolve);
  }
}

/** Test seam — lets a suite re-register against a different resolver. */
export function resetFontRegistrationCache(): void {
  registered.clear();
}
