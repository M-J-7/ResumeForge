/**
 * The public bullet checker agrees with the builder, and says each thing once.
 */

import { describe, expect, it } from "vitest";
import { MAX_BULLETS, checkBullets, splitBullets } from "./check-bullets";

describe("splitBullets", () => {
  it("takes one bullet per line and strips the markers people paste", () => {
    expect(
      splitBullets(
        "• Cut costs\n- Shipped it\n* Led a team\n1. Wrote docs\n(a) Ran tests\n\n  – Fixed bugs  ",
      ),
    ).toEqual(["Cut costs", "Shipped it", "Led a team", "Wrote docs", "Ran tests", "Fixed bugs"]);
  });

  it("keeps a leading word that merely looks like a marker", () => {
    // "A/B testing" must survive: the marker pattern needs a space after it.
    expect(splitBullets("A/B tested the checkout page")).toEqual(["A/B tested the checkout page"]);
  });

  it("stops at a whole resume's worth of bullets", () => {
    const many = Array.from({ length: MAX_BULLETS + 10 }, (_, i) => `Shipped release ${i}`).join(
      "\n",
    );
    expect(splitBullets(many)).toHaveLength(MAX_BULLETS);
  });
});

describe("checkBullets", () => {
  it("returns nothing for nothing", () => {
    expect(checkBullets("   \n\n")).toEqual([]);
  });

  it("stays quiet about a bullet with all four parts", () => {
    const [result] = checkBullets(
      "Cut invoice processing from 5 days to 1 by automating matching with a rules engine",
    );
    expect(result!.present).toEqual({ action: true, what: true, how: true, outcome: true });
    expect(result!.notes).toEqual([]);
    expect(result!.findings).toEqual([]);
  });

  it("asks the coach's question once, rather than also repeating the checker's", () => {
    const [result] = checkBullets("Responsible for managing the support inbox");
    expect(result!.notes.some((note) => note.part === "action")).toBe(true);
    // The lint engine flags duty phrasing too; the coach already asked.
    expect(result!.findings.map((finding) => finding.ruleId)).not.toContain(
      "bullets/duty-phrasing",
    );
  });

  it("passes through what only the lint engine knows", () => {
    const paragraph = `Shipped ${"a very long description of the work ".repeat(8)}by 40%`;
    const [result] = checkBullets(paragraph);
    expect(result!.findings.map((finding) => finding.ruleId)).toContain("bullets/too-long");
  });

  it("checks each bullet on its own", () => {
    const results = checkBullets(
      "Helped with onboarding\nReduced churn from 9% to 4% by rebuilding onboarding emails",
    );
    expect(results).toHaveLength(2);
    expect(results[0]!.notes.length).toBeGreaterThan(0);
    expect(results[1]!.present.outcome).toBe(true);
  });

  it("never supplies a sentence the reader could paste (D8)", () => {
    // Inherited from the coach, asserted here at the surface a stranger sees:
    // questions end in a question mark and nothing carries a number of its own.
    for (const result of checkBullets("Worked on reports\nUsed Excel\nI helped the team")) {
      for (const note of result.notes) {
        expect(note.question.endsWith("?")).toBe(true);
        expect(`${note.gap}${note.question}${note.hint}`).not.toMatch(/\d/);
      }
    }
  });
});
