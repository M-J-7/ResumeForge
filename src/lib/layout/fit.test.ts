/**
 * M0-T10 acceptance: the overflow amount is accurate to within one line, and
 * accepting a suggestion visibly changes the page count.
 */

import { describe, expect, it } from "vitest";
import { analyzeFit, fitInputsFromPages, suggestFit } from "./fit";
import { renderPdf } from "@/lib/emit/pdf/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { readPages } from "@/lib/pdf/read";
import { buildOverflowFixture, midCareerResume } from "@/test/fixtures/resumes";
import type { ResumeDocument } from "@/lib/resume/schema";

const A4_HEIGHT_PT = 841.89;

function inputsFor(pageCount: number, lastLineOffsetPt: number) {
  return {
    pageCount,
    usablePageHeightPt: A4_HEIGHT_PT - 108,
    lastLineOffsetPt,
    lineHeightPt: 12.6,
  };
}

describe("analyzeFit", () => {
  it("reports a fractional page count", () => {
    const fit = analyzeFit(inputsFor(1, (A4_HEIGHT_PT - 108) * 0.5));
    expect(fit.pageCount).toBe(1);
    expect(fit.fractionalPages).toBeCloseTo(0.5, 1);
  });

  it("counts lines over the previous page boundary", () => {
    const usable = A4_HEIGHT_PT - 108;
    // Four lines onto page two.
    const fit = analyzeFit(inputsFor(2, 12.6 * 4));
    expect(fit.pageCount).toBe(2);
    expect(fit.linesOver).toBe(4);
    expect(fit.summary).toContain("4 lines over 1");
    expect(fit.fractionalPages).toBeCloseTo(1 + (12.6 * 4) / usable, 1);
  });

  it("stays accurate to within one line across a sweep of overflow amounts", () => {
    for (let lines = 1; lines <= 12; lines += 1) {
      const fit = analyzeFit(inputsFor(2, 12.6 * lines));
      expect(Math.abs(fit.linesOver - lines), `${lines} lines`).toBeLessThanOrEqual(1);
    }
  });

  it("flags a near-boundary overflow but not a comfortably full page", () => {
    expect(analyzeFit(inputsFor(2, 12.6 * 2)).nearBoundary).toBe(true);
    // Two thirds down the second page is a real second page, not an overflow.
    expect(analyzeFit(inputsFor(2, (A4_HEIGHT_PT - 108) * 0.66)).nearBoundary).toBe(false);
  });

  it("reports no overflow for a single page", () => {
    const fit = analyzeFit(inputsFor(1, 400));
    expect(fit.linesOver).toBe(0);
    expect(fit.nearBoundary).toBe(false);
  });

  it("degrades safely on nonsense input rather than dividing by zero", () => {
    const fit = analyzeFit({
      pageCount: 0,
      usablePageHeightPt: 0,
      lastLineOffsetPt: 0,
      lineHeightPt: 0,
    });
    expect(fit.linesOver).toBe(0);
    expect(Number.isFinite(fit.fractionalPages)).toBe(true);
  });
});

describe("suggestFit", () => {
  it("offers nothing when the document is not near a boundary", () => {
    const fit = analyzeFit(inputsFor(1, 300));
    expect(suggestFit(midCareerResume, fit)).toBeNull();
  });

  it("gives up whitespace before anything the reader reads", () => {
    const fit = analyzeFit(inputsFor(2, 12.6 * 2));
    const suggestion = suggestFit(midCareerResume, fit);
    expect(suggestion?.kind).toBe("margins");
  });

  it("moves to density once margins are already tight", () => {
    const tight: ResumeDocument = {
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins: 0.6, density: "comfortable" },
    };
    expect(suggestFit(tight, analyzeFit(inputsFor(2, 12.6)))?.kind).toBe("density");
  });

  it("moves to font size once margins and density are exhausted", () => {
    const tight: ResumeDocument = {
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins: 0.6, density: "compact", fontSizePt: 11 },
    };
    expect(suggestFit(tight, analyzeFit(inputsFor(2, 12.6)))?.kind).toBe("fontSize");
  });

  it("never suggests a font size below the legibility floor", () => {
    const floor: ResumeDocument = {
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins: 0.6, density: "compact", fontSizePt: 10 },
    };
    const suggestion = suggestFit(floor, analyzeFit(inputsFor(2, 12.6)));
    expect(suggestion?.kind).not.toBe("fontSize");
  });

  it("points at the longest bullet last, and does not rewrite it (D8)", () => {
    const exhausted: ResumeDocument = {
      ...midCareerResume,
      settings: { ...midCareerResume.settings, margins: 0.6, density: "compact", fontSizePt: 10 },
    };
    const suggestion = suggestFit(exhausted, analyzeFit(inputsFor(2, 12.6)));
    expect(suggestion?.kind).toBe("bullet");
    // Applying it is a no-op: we name the problem, the user writes the words.
    expect(suggestion?.apply(exhausted)).toEqual(exhausted);
  });

  it("keeps every applied suggestion inside the schema's allowed range", () => {
    let doc: ResumeDocument = midCareerResume;
    for (let i = 0; i < 6; i += 1) {
      const suggestion = suggestFit(doc, analyzeFit(inputsFor(2, 12.6)));
      if (!suggestion) break;
      doc = suggestion.apply(doc);
      expect(doc.settings.margins).toBeGreaterThanOrEqual(0.4);
      expect(doc.settings.fontSizePt).toBeGreaterThanOrEqual(9);
    }
  });
});

describe("end-to-end against a real render", () => {
  /** Measures a document the way the preview does: render, then read back. */
  async function measure(doc: ResumeDocument) {
    const rendered = await renderPdf(doc, { resolveFont: nodeFontResolver });
    const pages = await readPages(rendered.bytes);
    const inputs = fitInputsFromPages(
      pages,
      doc.settings.margins,
      doc.settings.fontSizePt * doc.settings.lineHeight,
    );
    expect(inputs).not.toBeNull();
    return { fit: analyzeFit(inputs!), pageCount: rendered.pageCount };
  }

  it("measures the overflow from the artifact, agreeing with the rendered page count", async () => {
    const { fit, pageCount } = await measure(buildOverflowFixture(14));
    expect(fit.pageCount).toBe(pageCount);
    expect(fit.pageCount).toBe(2);
    expect(fit.linesOver).toBeGreaterThan(0);
  });

  it("does not offer to trim a document that genuinely needs two pages", async () => {
    // Twelve lines onto page two is a real second page, not a near miss.
    // Offering to shave margins here would be advice that cannot work.
    const doc = buildOverflowFixture(14);
    const { fit } = await measure(doc);
    expect(fit.nearBoundary).toBe(false);
    expect(suggestFit(doc, fit)).toBeNull();
  });

  it("offers a suggestion at the real page boundary, and accepting it wins the page", async () => {
    // Walk up until the document first spills onto a second page. That is
    // the state the indicator exists for, and the only one where a trim can
    // honestly be promised to help.
    let boundaryDoc: ResumeDocument | null = null;
    let boundaryFit = null;
    for (let bullets = 1; bullets <= 14; bullets += 1) {
      const candidate = buildOverflowFixture(bullets);
      const { fit } = await measure(candidate);
      if (fit.pageCount === 2) {
        boundaryDoc = candidate;
        boundaryFit = fit;
        break;
      }
    }

    expect(boundaryDoc, "no bullet count produced a second page").not.toBeNull();
    expect(boundaryFit!.nearBoundary).toBe(true);

    const suggestion = suggestFit(boundaryDoc!, boundaryFit!);
    expect(suggestion).not.toBeNull();

    const tightened = suggestion!.apply(boundaryDoc!);
    const after = await measure(tightened);
    expect(after.pageCount).toBe(1);
  });

  it("reports a one-page document as under a page", async () => {
    const { bytes, pageCount } = await renderPdf(midCareerResume, {
      resolveFont: nodeFontResolver,
    });
    const pages = await readPages(bytes);
    const inputs = fitInputsFromPages(
      pages,
      midCareerResume.settings.margins,
      midCareerResume.settings.fontSizePt * midCareerResume.settings.lineHeight,
    );
    const fit = analyzeFit(inputs!);
    expect(fit.pageCount).toBe(pageCount);
    expect(fit.linesOver).toBe(0);
    expect(fit.fractionalPages).toBeLessThanOrEqual(1);
    expect(fit.fractionalPages).toBeGreaterThan(0);
  });
});
