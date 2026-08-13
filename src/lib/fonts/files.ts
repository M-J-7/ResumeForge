/**
 * The vendored font files and how they map to weights and styles.
 *
 * Filenames follow `<FamilySlug>-<Style>.ttf`, written by
 * `scripts/fetch-fonts.mjs`. The slug is the family name with spaces removed,
 * derived rather than stored so the two cannot drift.
 */

import { FONT_PAIRS, type FontPairId } from "./pairs";

export interface FontStyleDescriptor {
  readonly style: "Regular" | "Bold" | "Italic" | "BoldItalic";
  readonly fontWeight: 400 | 700;
  readonly fontStyle: "normal" | "italic";
}

export const FONT_STYLES: readonly FontStyleDescriptor[] = [
  { style: "Regular", fontWeight: 400, fontStyle: "normal" },
  { style: "Bold", fontWeight: 700, fontStyle: "normal" },
  { style: "Italic", fontWeight: 400, fontStyle: "italic" },
  { style: "BoldItalic", fontWeight: 700, fontStyle: "italic" },
];

export function familySlug(family: string): string {
  return family.replace(/\s+/g, "");
}

export function fontFileName(family: string, style: FontStyleDescriptor["style"]): string {
  return `${familySlug(family)}-${style}.ttf`;
}

export interface FontFileRef extends FontStyleDescriptor {
  readonly family: string;
  readonly file: string;
}

/** Every file needed to render one font pair. */
export function fontFilesForPair(id: FontPairId): FontFileRef[] {
  const { family } = FONT_PAIRS[id];
  return FONT_STYLES.map((s) => ({ ...s, family, file: fontFileName(family, s.style) }));
}

/** Every file the app ships, deduplicated by filename. */
export function allFontFiles(): FontFileRef[] {
  const seen = new Map<string, FontFileRef>();
  for (const id of Object.keys(FONT_PAIRS) as FontPairId[]) {
    for (const ref of fontFilesForPair(id)) {
      if (!seen.has(ref.file)) seen.set(ref.file, ref);
    }
  }
  return [...seen.values()];
}
