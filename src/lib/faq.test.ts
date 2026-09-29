/**
 * The FAQ, held to the same rule as everything else on the site.
 *
 * A FAQ is where a marketing page's copy discipline goes to die: the format
 * invites a confident one-liner, and the confident one-liner for "does this
 * beat the ATS" is the exact claim D14 exists to forbid. So these answers get
 * the scan `examples.test.ts` runs over the guides, with the same escape hatch
 * for a sentence that names a claim in order to refuse it.
 *
 * The second thing checked here is structural: the `<details>` a reader opens
 * and the `FAQPage` markup a crawler reads come from one array, and Google's
 * structured-data policy requires the markup to describe what is on the page.
 * That holds by construction — this asserts it stays that way.
 */

import { describe, expect, it } from "vitest";
import { FAQ } from "./faq";
import { faqPageJsonLd } from "./structured-data";

/** The phrases D14 forbids — the same list `examples.test.ts` screens for. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

/**
 * Wording that marks a sentence as *refusing* the claim it contains.
 *
 * "Nobody can guarantee a resume passes" contains "guarantee" and is D14 being
 * stated rather than broken. A scan that cannot tell the two apart would force
 * the answers to stop naming the claims they exist to refuse.
 */
const REFUSAL =
  /\b(will not|cannot|can't|nobody can|no one can|does not|do not|is not|are not|never|not on their own|rather than)\b/i;

function assertions(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !REFUSAL.test(sentence));
}

describe("the landing FAQ", () => {
  it("asks questions people actually type", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(6);
    for (const item of FAQ) {
      expect(item.question.endsWith("?"), item.question).toBe(true);
      // Long enough to be a query rather than a heading with a hook on it.
      expect(item.question.split(/\s+/).length, item.question).toBeGreaterThan(4);
    }
  });

  it("answers each one in a paragraph, not a sentence", () => {
    for (const item of FAQ) {
      const words = item.answer.split(/\s+/).length;
      expect(words, item.question).toBeGreaterThan(45);
      // A FAQ entry that needs three paragraphs is a guide. `/guides` exists.
      expect(words, item.question).toBeLessThan(160);
    }
  });

  it("asks each question once", () => {
    const seen = new Set(FAQ.map((item) => item.question.toLowerCase()));
    expect(seen.size).toBe(FAQ.length);
  });

  it("makes no outcome claim (D14)", () => {
    for (const item of FAQ) {
      for (const sentence of assertions(`${item.question} ${item.answer}`)) {
        const match = OUTCOME_CLAIM.exec(sentence);
        expect(match?.[0] ?? null, `in: ${sentence}`).toBeNull();
      }
    }
  });

  it("emits markup that describes what the page actually says", () => {
    // The policy requirement, and the reason both halves read one array: an
    // `FAQPage` whose answers are not on the page is a manual action waiting
    // to happen, and the usual way it happens is two copies drifting.
    const markup = faqPageJsonLd(FAQ);
    expect(markup["@type"]).toBe("FAQPage");

    const entities = markup.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities).toHaveLength(FAQ.length);
    for (const [index, entity] of entities.entries()) {
      expect(entity.name).toBe(FAQ[index]!.question);
      expect(entity.acceptedAnswer.text).toBe(FAQ[index]!.answer);
    }
  });
});
