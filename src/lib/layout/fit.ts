/**
 * Page-fit analysis (M0-T10).
 *
 * Scope here is the indicator and a single suggestion. The full assistant —
 * ranked suggestions and bounded auto-fit by binary search — is M4-T3.
 *
 * The page count is always the measured one from the rendered PDF (D3). What
 * this module adds is the *fractional* part: how far into the last page the
 * content reaches, which is what turns "2 pages" into "1.2 pages — 4 lines
 * over" and makes the overflow actionable.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

/** Within this fraction of a page, trimming is realistic and worth offering. */
const NEAR_BOUNDARY = 0.15;

export interface PageFit {
  /** Measured page count from the artifact. */
  pageCount: number;
  /** Pages including the fraction used on the last one, e.g. 1.2. */
  fractionalPages: number;
  /** Content lines past the last full page. Zero when the fit is clean. */
  linesOver: number;
  /** True when a small trim would remove a page. */
  nearBoundary: boolean;
  summary: string;
}

export interface FitInputs {
  pageCount: number;
  /** Height of the text area on one page, in points. */
  usablePageHeightPt: number;
  /** Bottom of the last line of content on the final page, in points from the page top. */
  lastLineOffsetPt: number;
  lineHeightPt: number;
}

export function analyzeFit({
  pageCount,
  usablePageHeightPt,
  lastLineOffsetPt,
  lineHeightPt,
}: FitInputs): PageFit {
  if (pageCount <= 0 || usablePageHeightPt <= 0 || lineHeightPt <= 0) {
    return {
      pageCount: Math.max(pageCount, 0),
      fractionalPages: Math.max(pageCount, 0),
      linesOver: 0,
      nearBoundary: false,
      summary: "Nothing to lay out yet.",
    };
  }

  const lastPageFraction = Math.min(1, Math.max(0, lastLineOffsetPt / usablePageHeightPt));
  const fractionalPages = pageCount - 1 + lastPageFraction;

  // Overflow is measured against the *previous* whole page: a 1.2-page
  // document is 0.2 of a page past one page, and that fraction converted to
  // lines is the number the user can act on.
  const overflowPages = pageCount > 1 ? lastPageFraction : 0;
  const linesOver =
    pageCount > 1 ? Math.max(1, Math.ceil((overflowPages * usablePageHeightPt) / lineHeightPt)) : 0;

  const nearBoundary = pageCount > 1 && lastPageFraction <= NEAR_BOUNDARY;

  return {
    pageCount,
    fractionalPages: Math.round(fractionalPages * 10) / 10,
    linesOver,
    nearBoundary,
    summary: summarize(pageCount, fractionalPages, linesOver),
  };
}

function summarize(pageCount: number, fractionalPages: number, linesOver: number): string {
  const rounded = (Math.round(fractionalPages * 10) / 10).toFixed(1);
  if (pageCount === 1) return `${rounded} pages`;
  if (linesOver > 0) {
    return `${rounded} pages — ${linesOver} ${linesOver === 1 ? "line" : "lines"} over ${pageCount - 1}`;
  }
  return `${rounded} pages`;
}

export type SuggestionKind = "margins" | "density" | "fontSize" | "bullet";

export interface FitSuggestion {
  kind: SuggestionKind;
  label: string;
  /** Why this is the one being offered, in the user's terms. */
  rationale: string;
  /** Applies the change. Returns a new document; never mutates. */
  apply: (doc: ResumeDocument) => ResumeDocument;
}

/**
 * The single highest-value suggestion for shedding the overflow, or null when
 * the document already fits.
 *
 * Ordered by how little the reader loses: whitespace first, then density,
 * then type size, and only then the content itself. Each step stays inside
 * the legibility floors M4-T3 will also respect — a resume squeezed to 8pt
 * with quarter-inch margins fits on one page and gets thrown away.
 */
export function suggestFit(doc: ResumeDocument, fit: PageFit): FitSuggestion | null {
  if (!fit.nearBoundary) return null;
  const { settings } = doc;

  if (settings.margins > 0.6) {
    const next = Math.max(0.6, Math.round((settings.margins - 0.15) * 100) / 100);
    return {
      kind: "margins",
      label: `Tighten margins to ${next}"`,
      rationale: "Whitespace is the cheapest thing to give up — nothing the reader reads changes.",
      apply: (d) => ({ ...d, settings: { ...d.settings, margins: next } }),
    };
  }

  if (settings.density === "comfortable") {
    return {
      kind: "density",
      label: "Switch to compact spacing",
      rationale: "Closes the gaps between entries without touching the text size.",
      apply: (d) => ({ ...d, settings: { ...d.settings, density: "compact" } }),
    };
  }

  if (settings.fontSizePt > 10) {
    const next = Math.round((settings.fontSizePt - 0.5) * 10) / 10;
    return {
      kind: "fontSize",
      label: `Reduce body text to ${next}pt`,
      rationale: "Still comfortably readable in print; below 10pt it stops being.",
      apply: (d) => ({ ...d, settings: { ...d.settings, fontSizePt: next } }),
    };
  }

  const longest = findLongestBullet(doc);
  if (longest) {
    return {
      kind: "bullet",
      label: "Shorten your longest bullet",
      rationale: `"${longest.slice(0, 60)}…" is the longest line here. Cutting it by a few words is likely to win the page.`,
      // Content is the user's to change; we point at it rather than edit it (D8).
      apply: (d) => d,
    };
  }

  return null;
}

function findLongestBullet(doc: ResumeDocument): string | null {
  let longest: string | null = null;
  for (const section of doc.sections) {
    if (!section.visible || !("entries" in section)) continue;
    for (const entry of section.entries) {
      if (!("bullets" in entry)) continue;
      for (const bullet of entry.bullets) {
        if (longest === null || bullet.length > longest.length) longest = bullet;
      }
    }
  }
  return longest && longest.trim().length > 0 ? longest : null;
}

/**
 * Derives the fit inputs from a rendered document's own geometry.
 *
 * Everything here is measured from the artifact rather than predicted from
 * the model, which is the same discipline D3 applies to page count: the
 * renderer is the authority on where content actually landed.
 */
export function fitInputsFromPages(
  pages: ReadonlyArray<{ heightPt: number; lines: ReadonlyArray<{ y: number; height: number }> }>,
  marginsInches: number,
  lineHeightPt: number,
): FitInputs | null {
  const last = pages[pages.length - 1];
  if (!last || last.heightPt <= 0) return null;

  const marginPt = marginsInches * 72;
  const usablePageHeightPt = last.heightPt - marginPt * 2;
  const contentTopPt = last.heightPt - marginPt;

  // PDF y grows upward from the bottom, so the lowest baseline is the last
  // line of content. Subtracting from the content top gives distance down
  // the page, which is what the fraction is measured against.
  const lowestBaseline = last.lines.reduce(
    (lowest, line) => Math.min(lowest, line.y),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(lowestBaseline)) return null;

  return {
    pageCount: pages.length,
    usablePageHeightPt,
    lastLineOffsetPt: contentTopPt - lowestBaseline,
    lineHeightPt,
  };
}
