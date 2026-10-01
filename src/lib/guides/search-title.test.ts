/**
 * A guide's `<title>` fits a results page and leads with what was searched.
 *
 * The headings are written for a reader who has arrived — "Resume for campus
 * placement: what the drive does with it" — and as titles they ran to 70–103
 * characters with the site name, so a results page showed the essay half
 * and cut the rest (live audit, 2026-09-30).
 */

import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides";

describe("searchTitle", () => {
  it("fits in sixty characters, and is not the heading cut short", () => {
    for (const guide of GUIDES) {
      expect(guide.searchTitle.length, guide.slug).toBeLessThanOrEqual(60);
      expect(guide.searchTitle.length, guide.slug).toBeGreaterThan(20);
    }
  });

  it("is unique, so no two guides compete for one query", () => {
    const titles = GUIDES.map((guide) => guide.searchTitle.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("carries the slug's own words — the query the page is for", () => {
    for (const guide of GUIDES) {
      const words = guide.slug.split("-").filter((word) => word.length > 3 && word !== "what");
      const leading = guide.searchTitle.toLowerCase();
      expect(
        words.some((word) => leading.includes(word.slice(0, 5))),
        `${guide.slug}: "${guide.searchTitle}"`,
      ).toBe(true);
    }
  });
});
