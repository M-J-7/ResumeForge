/**
 * The questions on `/check` are held to the same bar as the landing FAQ —
 * real queries, a paragraph each, no outcome claim (D14) — and the markup a
 * crawler reads says what the page says.
 */

import { describe, expect, it } from "vitest";
import { CHECK_FAQ, CHECK_READS } from "./check-page";
import { FAQ } from "./faq";
import { faqPageJsonLd } from "./structured-data";

/** The phrases D14 forbids — the same list `faq.test.ts` screens for. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

/** A sentence that refuses the claim it names — see `faq.test.ts`. */
const REFUSAL =
  /\b(will not|cannot|can't|nobody can|no one can|does not|do not|is not|are not|never|not on their own|rather than)\b/i;

function assertions(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !REFUSAL.test(sentence));
}

describe("the /check questions", () => {
  it("are questions, each answered in one paragraph", () => {
    expect(CHECK_FAQ.length).toBeGreaterThanOrEqual(5);
    for (const item of CHECK_FAQ) {
      expect(item.question.endsWith("?"), item.question).toBe(true);
      const words = item.answer.split(/\s+/).length;
      expect(words, item.question).toBeGreaterThan(45);
      expect(words, item.question).toBeLessThan(160);
    }
  });

  it("do not repeat a question the landing page already answers", () => {
    const landing = new Set(FAQ.map((item) => item.question.toLowerCase()));
    for (const item of CHECK_FAQ) expect(landing.has(item.question.toLowerCase())).toBe(false);
  });

  it("make no outcome claim (D14)", () => {
    const texts = [
      ...CHECK_FAQ.map((item) => `${item.question} ${item.answer}`),
      ...CHECK_READS.map((read) => `${read.name}. ${read.body}`),
    ];
    for (const text of texts) {
      for (const sentence of assertions(text)) {
        expect(OUTCOME_CLAIM.exec(sentence)?.[0] ?? null, `in: ${sentence}`).toBeNull();
      }
    }
  });

  it("never offer a score, which the check does not compute (D12)", () => {
    for (const read of CHECK_READS) expect(read.body).not.toMatch(/\bscore\b|\d+\s*%/i);
  });

  it("emit markup that matches the page", () => {
    const entities = faqPageJsonLd(CHECK_FAQ).mainEntity as {
      name: string;
      acceptedAnswer: { text: string };
    }[];
    expect(entities.map((entity) => entity.name)).toEqual(CHECK_FAQ.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(
      CHECK_FAQ.map((item) => item.answer),
    );
  });
});
