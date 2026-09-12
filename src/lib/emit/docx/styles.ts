/**
 * DOCX style and page geometry derivation (M0-T5).
 *
 * The central idea, per D4: DOCX parses well *because* its XML names the
 * semantic role of every paragraph. A heading marked up as `Heading1` tells
 * a parser "this is a section heading"; the same text set in bold 14pt tells
 * it nothing. So this emitter defines real named paragraph styles and every
 * paragraph references one — direct run formatting is used only where it
 * carries no structural meaning.
 *
 * Per D5 the font is referenced *by name* (`Arial`, `Calibri`, …) rather
 * than embedded. Naming a font in a document is not redistribution; only
 * embedding is. Because our PDF twins are metric-compatible, both outputs
 * render near-identically.
 */

import { getFontPair } from "@/lib/fonts/pairs";
import type { Settings } from "@/lib/resume/schema";

/** Word measures lengths in twentieths of a point. */
export const TWIPS_PER_POINT = 20;
export const TWIPS_PER_INCH = 1440;

/**
 * Page sizes in twips, per M0-T5. These are exact, not rounded conversions —
 * getting them wrong shifts pagination relative to the PDF, which is the one
 * thing cross-format page parity depends on.
 */
export const PAGE_SIZE_TWIPS = {
  A4: { width: 11906, height: 16838 },
  LETTER: { width: 12240, height: 15840 },
} as const;

/** Word expresses font size in half-points. */
export function halfPoints(pt: number): number {
  return Math.round(pt * 2);
}

export function pointsToTwips(pt: number): number {
  return Math.round(pt * TWIPS_PER_POINT);
}

export function inchesToTwips(inches: number): number {
  return Math.round(inches * TWIPS_PER_INCH);
}

/** Style ids. `Normal`, `Heading1`, and `Heading2` are Word's own. */
export const STYLE_IDS = {
  normal: "Normal",
  name: "Title",
  contact: "ContactInfo",
  sectionHeading: "Heading1",
  entryHeading: "Heading2",
  entryMeta: "EntryMeta",
  bullet: "ResumeBullet",
} as const;

/** The single numbering definition all bullets reference. */
export const BULLET_NUMBERING_REFERENCE = "resume-bullets";

export interface DocxMetrics {
  bodyHalfPoints: number;
  /** Unitless line spacing expressed the way Word wants it. */
  lineTwips: number;
  gapTwips: number;
  fontName: string;
  fontFallback: readonly string[];
}

export function buildMetrics(settings: Settings): DocxMetrics {
  const pair = getFontPair(settings.fontPair);
  const gapPt =
    settings.density === "compact" ? settings.fontSizePt * 0.35 : settings.fontSizePt * 0.55;

  return {
    bodyHalfPoints: halfPoints(settings.fontSizePt),
    lineTwips: pointsToTwips(settings.fontSizePt * settings.lineHeight),
    gapTwips: pointsToTwips(gapPt),
    fontName: pair.docxName,
    fontFallback: pair.docxFallback,
  };
}
