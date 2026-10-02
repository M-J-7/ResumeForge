/**
 * The questions on the keyword scanner and the bullet point checker: real
 * queries, a paragraph each, no outcome claim (D14), not one the landing
 * page or `/check` already answers, and markup that says what the page says.
 */

import { describe, expect, it } from "vitest";
import { CHECK_FAQ } from "./check-page";
import { FAQ } from "./faq";
import { faqPageJsonLd } from "./structured-data";
import { BULLETS_FAQ, SCANNER_FAQ } from "./tool-faq";

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

describe.each([
  ["the keyword scanner", SCANNER_FAQ],
  ["the bullet point checker", BULLETS_FAQ],
] as const)("the questions on %s", (_name, items) => {
  it("are questions, each answered in one paragraph", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      expect(item.question.endsWith("?"), item.question).toBe(true);
      const words = item.answer.split(/\s+/).length;
      expect(words, item.question).toBeGreaterThan(45);
      expect(words, item.question).toBeLessThan(160);
    }
  });

  it("are not asked anywhere else on the site", () => {
    const elsewhere = new Set(
      [...FAQ, ...CHECK_FAQ, ...(items === SCANNER_FAQ ? BULLETS_FAQ : SCANNER_FAQ)].map((item) =>
        item.question.toLowerCase(),
      ),
    );
    for (const item of items) expect(elsewhere.has(item.question.toLowerCase())).toBe(false);
  });

  it("make no outcome claim (D14)", () => {
    for (const item of items) {
      for (const sentence of assertions(`${item.question} ${item.answer}`)) {
        expect(OUTCOME_CLAIM.exec(sentence)?.[0] ?? null, `in: ${sentence}`).toBeNull();
      }
    }
  });

  it("emit markup that matches the page", () => {
    const entities = faqPageJsonLd(items).mainEntity as {
      name: string;
      acceptedAnswer: { text: string };
    }[];
    expect(entities.map((entity) => entity.name)).toEqual(items.map((item) => item.question));
    expect(entities.map((entity) => entity.acceptedAnswer.text)).toEqual(
      items.map((item) => item.answer),
    );
  });
});

describe("the scanner's answers", () => {
  it("state the section weights the engine uses, not remembered ones", () => {
    const how = SCANNER_FAQ[0]!.answer;
    expect(how).toMatch(/Requirements counts \d+ times/);
    expect(how).not.toContain("undefined");
  });

  it("state a vocabulary size no larger than the vocabulary", () => {
    const size = /([\d,]+) terms/.exec(SCANNER_FAQ[1]!.answer)?.[1];
    expect(size).toBeDefined();
    expect(Number(size!.replace(/,/g, ""))).toBeGreaterThan(1000);
  });
});
