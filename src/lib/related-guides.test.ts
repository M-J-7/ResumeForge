/**
 * The "Other guides" list at the end of every guide.
 *
 * It was every other guide, which was fine at four and a wall of links by
 * the tenth. Bounding it opens the failure `relatedExamples` already guards
 * against: a guide no other guide links to, reachable only from the index.
 */

import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides/guides";
import { otherGuides } from "./related";

describe("otherGuides", () => {
  it("is bounded, never links a guide to itself, and never twice to one guide", () => {
    for (const guide of GUIDES) {
      const slugs = otherGuides(guide).map((item) => item.slug);
      expect(slugs.length, guide.slug).toBeLessThanOrEqual(4);
      expect(slugs.length, guide.slug).toBeGreaterThan(0);
      expect(slugs).not.toContain(guide.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("links to every guide from some other guide", () => {
    const linked = new Set(GUIDES.flatMap((guide) => otherGuides(guide)).map((item) => item.slug));
    for (const guide of GUIDES) expect(linked.has(guide.slug), guide.slug).toBe(true);
  });

  it("leads a market's guide with that market's others, when it has any", () => {
    for (const guide of GUIDES) {
      if (guide.market === undefined) continue;
      const sameMarket = GUIDES.filter(
        (other) => other.slug !== guide.slug && other.market === guide.market,
      );
      if (sameMarket.length === 0) continue;
      expect(otherGuides(guide)[0]?.market, guide.slug).toBe(guide.market);
    }
  });

  it("never sends a market's reader to the other market's guide before a general one", () => {
    for (const guide of GUIDES) {
      if (guide.market === undefined) continue;
      const markets = otherGuides(guide).map((item) => item.market);
      const firstOther = markets.findIndex((m) => m !== undefined && m !== guide.market);
      const lastGeneral = markets.lastIndexOf(undefined);
      if (firstOther !== -1 && lastGeneral !== -1) {
        expect(firstOther, guide.slug).toBeGreaterThan(lastGeneral);
      }
    }
  });
});
