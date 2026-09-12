/**
 * Guards the cheap page-count path against the authoritative one.
 *
 * `countPages` reads the page tree directly so `renderPdf` needs no pdfjs
 * worker. That is only acceptable while it agrees with pdfjs on every
 * document we actually produce — which is what this asserts.
 */

import { describe, expect, it } from "vitest";
import { countPages } from "./page-count";
import { readPageCount } from "./read";
import { renderPdf } from "@/lib/emit/pdf/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { ALL_FIXTURES, buildOverflowFixture } from "@/test/fixtures/resumes";

describe("countPages", () => {
  it.each(ALL_FIXTURES)("agrees with pdfjs on the $name fixture", async ({ document }) => {
    const { bytes } = await renderPdf(document, { resolveFont: nodeFontResolver });
    expect(countPages(bytes)).toBe(await readPageCount(bytes));
  });

  it("agrees with pdfjs across a multi-page sweep", async () => {
    for (const bullets of [1, 8, 14, 30]) {
      const { bytes } = await renderPdf(buildOverflowFixture(bullets), {
        resolveFont: nodeFontResolver,
      });
      expect(countPages(bytes), `${bullets} bullets`).toBe(await readPageCount(bytes));
    }
  });

  it("returns 0 for bytes that are not a PDF, rather than throwing", () => {
    expect(countPages(new TextEncoder().encode("not a pdf"))).toBe(0);
  });
});
