/**
 * Font pair definitions — pure data, no font binaries.
 *
 * This module is imported by the resume schema (to validate `settings.fontPair`)
 * and by the DOCX emitter, so it must stay free of heavy imports. Actual font
 * file registration for react-pdf lives in `./register.ts`.
 *
 * Per D1: we ship metric-compatible open-licensed fonts rather than the
 * proprietary originals, because generating a PDF *embeds* the font file and
 * that is redistribution.
 *
 * Per D5: the PDF emitter embeds the open twin; the DOCX emitter writes the
 * original font *name* (referencing a name is not redistribution). Because the
 * twins are metric-compatible, both outputs render near-identically.
 */

export const FONT_PAIR_IDS = ["classic", "modern", "clean", "editorial", "technical"] as const;

export type FontPairId = (typeof FONT_PAIR_IDS)[number];

export interface FontPairDefinition {
  readonly id: FontPairId;
  /** Shown in the picker. */
  readonly label: string;
  /** One line on why a user would choose this pair. */
  readonly description: string;
  /** Embedded family name, used by the PDF emitter. */
  readonly family: string;
  /** Font name written into the DOCX (per D5 — referenced, never embedded). */
  readonly docxName: string;
  /** Fallback chain for readers lacking `docxName`. */
  readonly docxFallback: readonly string[];
  /** The proprietary face this pair is metric-compatible with, if any. */
  readonly metricTwinOf: string | null;
}

export const FONT_PAIRS: Readonly<Record<FontPairId, FontPairDefinition>> = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Traditional serif. The safest choice for law, finance, and academia.",
    family: "Tinos",
    docxName: "Times New Roman",
    docxFallback: ["Tinos", "Liberation Serif", "serif"],
    metricTwinOf: "Times New Roman",
  },
  modern: {
    id: "modern",
    label: "Modern",
    description: "Neutral sans-serif. Reads cleanly everywhere and never distracts.",
    family: "Arimo",
    docxName: "Arial",
    docxFallback: ["Arimo", "Liberation Sans", "Helvetica", "sans-serif"],
    metricTwinOf: "Arial",
  },
  clean: {
    id: "clean",
    label: "Clean",
    description: "Softer sans-serif. Familiar to anyone who has opened Word this decade.",
    family: "Carlito",
    docxName: "Calibri",
    docxFallback: ["Carlito", "sans-serif"],
    metricTwinOf: "Calibri",
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Old-style serif with more character. Good for design and writing roles.",
    family: "EB Garamond",
    docxName: "Garamond",
    docxFallback: ["EB Garamond", "Georgia", "serif"],
    metricTwinOf: null,
  },
  technical: {
    id: "technical",
    label: "Technical",
    description: "Precise, engineered sans-serif. Popular in software and hardware.",
    family: "IBM Plex Sans",
    docxName: "IBM Plex Sans",
    docxFallback: ["Segoe UI", "Helvetica", "sans-serif"],
    metricTwinOf: null,
  },
} as const;

export const DEFAULT_FONT_PAIR_ID: FontPairId = "modern";

export function getFontPair(id: FontPairId): FontPairDefinition {
  return FONT_PAIRS[id];
}

/** Every family the app must be able to embed, in registration order. */
export const FONT_FAMILIES = Object.values(FONT_PAIRS).map((p) => p.family);
