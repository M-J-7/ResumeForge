/**
 * The pricing page, held to the rules the rest of the site follows.
 *
 * A pricing page is where a product's copy discipline is most tested and most
 * load-bearing, because it is the page a reader arrives at already suspicious.
 * Three things are checked.
 *
 * **The free claim stays true.** D13 says downloads are never paywalled, and
 * this asserts there is a tier that costs nothing and that nothing about a
 * download appears behind a price.
 *
 * **The page and the machine-readable version agree.** `structured-data.ts`
 * emits an `Offer` for the Pass; the figure in it and the figure on the page
 * come from one constant, and this pins them together.
 *
 * **Nothing is offered for sale that cannot be bought.** There is no billing
 * code here, so the Pass is `available: false` and its markup is `PreOrder`.
 * The day that changes, both change together or this fails.
 */

import { describe, expect, it } from "vitest";
import { PASS, PRICING_REFUSALS, PRICING_TIERS } from "./pricing";
import { softwareApplicationJsonLd } from "./structured-data";

/** The phrases D14 forbids — the same list the guides and the FAQ are screened for. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

/** Wording that marks a sentence as refusing the claim it names. */
const REFUSAL =
  /\b(will not|cannot|can't|nobody can|no one can|does not|do not|is not|are not|never|no\s)\b/i;

function allCopy(): string[] {
  return [
    ...PRICING_TIERS.flatMap((tier) => [tier.name, tier.priceNote, tier.who, ...tier.features]),
    ...PRICING_REFUSALS,
  ];
}

describe("pricing", () => {
  it("keeps a tier that costs nothing (D13)", () => {
    const free = PRICING_TIERS.filter((tier) => tier.price === null);
    expect(free.length).toBeGreaterThanOrEqual(1);
    for (const tier of free) expect(tier.available).toBe(true);
  });

  it("never puts a download behind a price", () => {
    // The single decision this whole page is built around, as a test. A paid
    // tier listing an export format as one of *its* features would mean the
    // free tiers no longer have it, which is the pattern D13 forecloses.
    for (const tier of PRICING_TIERS) {
      if (tier.price === null) continue;
      for (const feature of tier.features) {
        expect(
          /\b(pdf|docx|word|plain text|json resume|download|export)\b/i.test(feature),
          `the paid tier lists "${feature}", which is a download`,
        ).toBe(false);
      }
    }

    const freeFeatures = PRICING_TIERS.filter((tier) => tier.price === null)
      .flatMap((tier) => tier.features)
      .join(" ");
    for (const format of ["PDF", "Word", "plain text", "JSON Resume"]) {
      expect(freeFeatures, format).toContain(format);
    }
  });

  it("offers nothing for sale that cannot be bought", () => {
    // There is no billing code in this repository. A tier marked available
    // over no checkout is the lie this page exists not to tell, and the
    // `PreOrder` in the markup is the same statement to a machine.
    const paid = PRICING_TIERS.filter((tier) => tier.price !== null);
    expect(paid.length).toBeGreaterThan(0);

    const offers = softwareApplicationJsonLd().offers as {
      price: string;
      availability: string;
    }[];

    for (const tier of paid) {
      const offer = offers.find((candidate) => candidate.price === tier.price);
      expect(offer, `${tier.name} at $${tier.price} has no matching Offer`).toBeDefined();
      expect(offer!.availability).toBe(
        tier.available ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      );
    }
  });

  it("states no free-tier limit the product does not enforce", () => {
    // Nothing counts stored rows against a limit until checkout exists, so
    // while the Pass cannot be bought the account tier must say there is no
    // limit — and must not list a count as though one applied.
    const pass = PRICING_TIERS.find((tier) => tier.price === PASS.price)!;
    const account = PRICING_TIERS.find((tier) => tier.name === "With an account");
    expect(account, "the account tier was renamed; update this test").toBeDefined();

    if (!pass.available) {
      expect(account!.features.some((feature) => /\bno limit\b/i.test(feature))).toBe(true);
      for (const feature of account!.features) {
        expect(feature, feature).not.toMatch(/^(one|two|three|\d+)\s+(stored|saved)\b/i);
      }
    }
  });

  it("prices the Pass in one place", () => {
    const pass = PRICING_TIERS.find((tier) => tier.price === PASS.price);
    expect(pass, "no tier uses the Pass constant").toBeDefined();
    // "once, for 12 months" and never "per year": the second implies a
    // renewal, which is the exact thing the tier is defined by not doing.
    expect(pass!.priceNote).toBe(PASS.period);
    expect(pass!.priceNote).not.toMatch(/per\s+(year|month)|\/(yr|mo)/i);
  });

  it("says what it refuses in whole sentences", () => {
    expect(PRICING_REFUSALS.length).toBeGreaterThanOrEqual(4);
    for (const claim of PRICING_REFUSALS) {
      expect(claim.endsWith("."), claim).toBe(true);
      expect(claim.split(/\s+/).length, claim).toBeGreaterThan(5);
    }
  });

  it("makes no outcome claim (D14)", () => {
    for (const line of allCopy()) {
      for (const sentence of line.split(/(?<=[.!?])\s+/)) {
        if (REFUSAL.test(sentence)) continue;
        expect(OUTCOME_CLAIM.exec(sentence)?.[0] ?? null, `in: ${sentence}`).toBeNull();
      }
    }
  });
});
