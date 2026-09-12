/**
 * M3-T2's acceptance: "'Kubernetes' outweighs 'team' by a wide margin."
 *
 * That is the whole point of the module. A naive TF-IDF over a single
 * pasted posting has no document frequency to work with, weighs every word
 * equally, and produces advice like "add the word team to your resume" —
 * which is both useless and the thing that makes keyword tools feel fake.
 */

import { describe, expect, it } from "vitest";
import { UNKNOWN_IDF, idf } from "./idf";
import { buildSkillIndex } from "./lookup";
import { COMMON_WORD_TIERS } from "./common-words";

const skills = buildSkillIndex();

describe("the acceptance criterion (M3-T2)", () => {
  it("weighs Kubernetes far above team", () => {
    const kubernetes = idf("Kubernetes", skills);
    const team = idf("team", skills);

    expect(kubernetes).toBeGreaterThan(3 * team);
  });

  it("weighs every technology above every piece of posting furniture", () => {
    const technologies = ["Kubernetes", "Terraform", "PostgreSQL", "GraphQL", "PyTorch"];
    const furniture = ["team", "experience", "ability", "responsible", "excellent", "work"];

    for (const tech of technologies) {
      for (const word of furniture) {
        expect(idf(tech, skills), `${tech} vs ${word}`).toBeGreaterThan(idf(word, skills));
      }
    }
  });
});

describe("tiers rank the way they are documented to", () => {
  it("orders ubiquitous below veryCommon below common below unknown", () => {
    expect(idf("the")).toBeLessThan(idf("team"));
    expect(idf("team")).toBeLessThan(idf("stakeholder"));
    expect(idf("stakeholder")).toBeLessThan(idf("kubernetes"));
  });

  it("gives an unknown word the unknown weight", () => {
    expect(idf("zzzunlikelyword")).toBeCloseTo(UNKNOWN_IDF, 10);
  });

  it("gives an empty or punctuation-only term no weight at all", () => {
    expect(idf("")).toBe(0);
    expect(idf("   ")).toBe(0);
    expect(idf(",")).toBe(0);
  });
});

describe("the known-skill floor", () => {
  /**
   * The floor only bites where the two vocabularies overlap, which today is
   * "agile" and "scrum" and nothing else. That narrowness is worth stating:
   * the rule is here for the invariant — a recognised skill is never weighed
   * as posting furniture — not because it currently rescues a long list of
   * terms. Both vocabularies grow independently, and the overlap grows with
   * them.
   */
  it("stops a skill that is also common posting vocabulary being weighed as furniture", () => {
    const withSkills = idf("Agile", skills);
    const withoutSkills = idf("Agile");

    expect(withSkills).toBeGreaterThan(withoutSkills);
  });

  it("applies through an alias too", () => {
    expect(idf("scrum", skills)).toBeGreaterThan(idf("scrum"));
  });

  it("does not raise a word that is not a skill", () => {
    expect(idf("team", skills)).toBeCloseTo(idf("team"), 10);
  });

  it("does not push a known skill above a genuinely rare one", () => {
    // The floor is a floor, not a promotion: a common-word skill still ranks
    // at or below a term nobody uses casually.
    expect(idf("Agile", skills)).toBeLessThanOrEqual(idf("Kubernetes", skills));
  });
});

describe("normalisation reaches the same answer as the lookup does", () => {
  it("is case-insensitive", () => {
    expect(idf("TEAM")).toBeCloseTo(idf("team"), 10);
  });

  it("resolves an alias to its skill before weighing it", () => {
    expect(idf("k8s", skills)).toBeCloseTo(idf("Kubernetes", skills), 10);
  });
});

describe("the word list itself", () => {
  it("puts the words that make matchers look silly in a low tier", () => {
    // Every one of these has been the "missing keyword" a naive tool told
    // somebody to add. None of them says anything about a candidate.
    for (const word of ["team", "experience", "ability", "responsible", "strong", "excellent"]) {
      expect(COMMON_WORD_TIERS.get(word), word).toBeDefined();
    }
  });

  it("does not accidentally list a technology as a common word", () => {
    for (const tech of ["kubernetes", "terraform", "postgresql", "graphql", "python", "react"]) {
      expect(COMMON_WORD_TIERS.get(tech), tech).toBeUndefined();
    }
  });
});
