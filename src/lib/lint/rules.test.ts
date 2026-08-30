/**
 * M0-T11 acceptance: every rule has a unit test with a passing and a failing
 * fixture, and non-generic "why this matters" text.
 */

import { describe, expect, it } from "vitest";
import { RULES } from "./rules";
import { lint } from "./engine";
import { createEmptyResume } from "@/lib/resume/factory";
import { fresherResume, midCareerResume } from "@/test/fixtures/resumes";
import type { ResumeDocument, Section } from "@/lib/resume/schema";

/** Applies an edit to the experience section of a base fixture. */
function withExperience(
  base: ResumeDocument,
  edit: (section: Extract<Section, { type: "experience" }>) => Section,
): ResumeDocument {
  return {
    ...base,
    sections: base.sections.map((s) => (s.type === "experience" ? edit(s) : s)),
  };
}

/** Replaces the first role's bullets, keeping everything else intact. */
function withBullets(base: ResumeDocument, bullets: string[]): ResumeDocument {
  return withExperience(base, (section) => ({
    ...section,
    entries: section.entries.map((entry, i) => (i === 0 ? { ...entry, bullets } : entry)),
  }));
}

function ruleIds(doc: ResumeDocument): string[] {
  return lint(doc).findings.map((f) => f.ruleId);
}

function findingsFor(doc: ResumeDocument, ruleId: string) {
  return lint(doc).findings.filter((f) => f.ruleId === ruleId);
}

/* -------------------------------------------------------------------------- */
/* Rule quality — the part that makes the engine worth having                  */
/* -------------------------------------------------------------------------- */

describe("rule metadata", () => {
  it("gives every rule a stable, namespaced id", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+\/[a-z-]+$/);
  });

  it("explains why every rule matters, in specific terms", () => {
    for (const rule of RULES) {
      expect(rule.why.length, rule.id).toBeGreaterThan(40);
      // The failure mode this guards: filler that restates the rule name.
      expect(rule.why, rule.id).not.toMatch(
        /^(this is important|best practice|recommended|it is better|improves quality)/i,
      );
      expect(rule.why, rule.id).toMatch(/[.!]$/);
    }
  });

  it("never promises that following a rule guarantees anything (D14)", () => {
    for (const rule of RULES) {
      expect(rule.why, rule.id).not.toMatch(/guarantee|will pass|beat the bot|ensures you/i);
      expect(rule.title, rule.id).not.toMatch(/guarantee|will pass/i);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Contact                                                                     */
/* -------------------------------------------------------------------------- */

describe("contact/name", () => {
  it("passes when a name is present", () => {
    expect(ruleIds(midCareerResume)).not.toContain("contact/name");
  });

  it("fails when the name is blank", () => {
    const doc = { ...midCareerResume, contact: { ...midCareerResume.contact, fullName: "  " } };
    expect(ruleIds(doc)).toContain("contact/name");
  });
});

describe("contact/reachable", () => {
  it("passes with an email", () => {
    expect(ruleIds(midCareerResume)).not.toContain("contact/reachable");
  });

  it("passes with only a phone number", () => {
    const doc = { ...midCareerResume, contact: { ...midCareerResume.contact, email: "" } };
    expect(ruleIds(doc)).not.toContain("contact/reachable");
  });

  it("fails with neither", () => {
    const doc = {
      ...midCareerResume,
      contact: { ...midCareerResume.contact, email: "", phone: "" },
    };
    expect(ruleIds(doc)).toContain("contact/reachable");
  });
});

describe("contact/email-format", () => {
  it("passes for a valid address", () => {
    expect(ruleIds(midCareerResume)).not.toContain("contact/email-format");
  });

  it("stays quiet while the field is still empty", () => {
    const doc = { ...midCareerResume, contact: { ...midCareerResume.contact, email: "" } };
    expect(ruleIds(doc)).not.toContain("contact/email-format");
  });

  it("fails for a malformed address", () => {
    const doc = { ...midCareerResume, contact: { ...midCareerResume.contact, email: "jo@" } };
    expect(ruleIds(doc)).toContain("contact/email-format");
  });
});

describe("contact/location", () => {
  it("passes when a location is given", () => {
    expect(ruleIds(midCareerResume)).not.toContain("contact/location");
  });

  it("fails when it is missing", () => {
    const doc = { ...midCareerResume, contact: { ...midCareerResume.contact, location: "" } };
    expect(ruleIds(doc)).toContain("contact/location");
  });
});

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

describe("dates/end-before-start", () => {
  it("passes for well-ordered ranges", () => {
    expect(ruleIds(midCareerResume)).not.toContain("dates/end-before-start");
  });

  it("fails when the end precedes the start", () => {
    const doc = withExperience(midCareerResume, (section) => ({
      ...section,
      entries: section.entries.map((entry, i) =>
        i === 0
          ? {
              ...entry,
              dates: {
                start: { year: 2022, month: 6 },
                end: { year: 2020, month: 1 },
                current: false,
              },
            }
          : entry,
      ),
    }));
    expect(ruleIds(doc)).toContain("dates/end-before-start");
  });
});

describe("dates/inconsistent-precision", () => {
  it("passes when every date gives a month", () => {
    expect(ruleIds(midCareerResume)).not.toContain("dates/inconsistent-precision");
  });

  it("fails when some dates give a month and others do not", () => {
    const doc = withExperience(midCareerResume, (section) => ({
      ...section,
      entries: section.entries.map((entry, i) =>
        i === 0
          ? { ...entry, dates: { ...entry.dates, start: { year: 2022, month: null } } }
          : entry,
      ),
    }));
    expect(ruleIds(doc)).toContain("dates/inconsistent-precision");
  });
});

/* -------------------------------------------------------------------------- */
/* Bullets                                                                     */
/* -------------------------------------------------------------------------- */

describe("bullets/too-long", () => {
  it("passes for a normal bullet", () => {
    expect(ruleIds(midCareerResume)).not.toContain("bullets/too-long");
  });

  it("fails for a bullet that has become a paragraph", () => {
    const doc = withBullets(midCareerResume, [
      `Delivered ${"work ".repeat(45)}across the company.`,
    ]);
    expect(ruleIds(doc)).toContain("bullets/too-long");
  });
});

describe("bullets/duty-phrasing", () => {
  it("passes for a bullet that leads with a result", () => {
    expect(ruleIds(midCareerResume)).not.toContain("bullets/duty-phrasing");
  });

  it.each([
    "Responsible for the payments platform.",
    "Duties included running the release process.",
    "Helped with migrating the database.",
  ])("fails for %s", (bullet) => {
    expect(ruleIds(withBullets(midCareerResume, [bullet]))).toContain("bullets/duty-phrasing");
  });

  it("names the offending phrase, so the fix is obvious", () => {
    const doc = withBullets(midCareerResume, ["Responsible for the payments platform."]);
    expect(findingsFor(doc, "bullets/duty-phrasing")[0]?.message).toContain("responsible for");
  });
});

describe("bullets/first-person", () => {
  it("passes for verb-led bullets", () => {
    expect(ruleIds(midCareerResume)).not.toContain("bullets/first-person");
  });

  it("fails for a bullet using I or my", () => {
    expect(ruleIds(withBullets(midCareerResume, ["I rebuilt the pipeline."]))).toContain(
      "bullets/first-person",
    );
    expect(ruleIds(withBullets(midCareerResume, ["Rebuilt my team's pipeline."]))).toContain(
      "bullets/first-person",
    );
  });

  it("does not fire on words that merely contain a pronoun", () => {
    // "Improved" contains "I"; "customer" contains "us"; "mine" is a word.
    const doc = withBullets(midCareerResume, [
      "Improved customer onboarding for 400 accounts in Q3.",
    ]);
    expect(ruleIds(doc)).not.toContain("bullets/first-person");
  });
});

describe("bullets/weak-verb", () => {
  it("passes for a strong opening verb", () => {
    const doc = withBullets(midCareerResume, [
      "Rebuilt the settlement pipeline, cutting latency 4x.",
    ]);
    expect(ruleIds(doc)).not.toContain("bullets/weak-verb");
  });

  it.each([
    "Worked on the billing service.",
    "Helped the team ship faster.",
    "Was part of the migration.",
  ])("fails for %s", (bullet) => {
    expect(ruleIds(withBullets(midCareerResume, [bullet]))).toContain("bullets/weak-verb");
  });

  it("fails for a bullet that does not start with a verb at all", () => {
    expect(ruleIds(withBullets(midCareerResume, ["The migration went well."]))).toContain(
      "bullets/weak-verb",
    );
  });
});

describe("experience/no-quantified-outcome", () => {
  it("passes when a role has a number in it", () => {
    expect(ruleIds(midCareerResume)).not.toContain("experience/no-quantified-outcome");
  });

  it("fails when no bullet under a role gives a measurable result", () => {
    const doc = withBullets(midCareerResume, ["Rebuilt the settlement pipeline end to end."]);
    expect(ruleIds(doc)).toContain("experience/no-quantified-outcome");
  });

  it("accepts a magnitude word as a quantity", () => {
    const doc = withBullets(midCareerResume, ["Doubled throughput on the settlement pipeline."]);
    expect(findingsFor(doc, "experience/no-quantified-outcome")).toHaveLength(0);
  });

  it("stays quiet for a role with no bullets yet", () => {
    const doc = withBullets(midCareerResume, []);
    const forFirstRole = findingsFor(doc, "experience/no-quantified-outcome").filter(
      (f) => f.location.entryId === "exp-1",
    );
    expect(forFirstRole).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Document-level                                                              */
/* -------------------------------------------------------------------------- */

describe("document/word-count", () => {
  it("stays quiet on a completely empty document, which other rules already cover", () => {
    expect(ruleIds(createEmptyResume())).not.toContain("document/word-count");
  });

  it("fails for a very thin document", () => {
    expect(ruleIds(fresherResume)).toContain("document/word-count");
  });

  it("fails for a very long one", () => {
    const doc = withBullets(
      midCareerResume,
      Array.from(
        { length: 60 },
        (_, i) => `Delivered improvement ${i} ${"with detail ".repeat(10)}.`,
      ),
    );
    expect(ruleIds(doc)).toContain("document/word-count");
  });
});

describe("document/empty-section", () => {
  it("fails for a visible section with nothing in it", () => {
    expect(ruleIds(fresherResume)).toContain("document/empty-section");
  });

  it("passes once the section is hidden rather than left empty", () => {
    const doc: ResumeDocument = {
      ...fresherResume,
      sections: fresherResume.sections.map((s) =>
        s.type === "certifications" || s.type === "experience" || s.type === "summary"
          ? { ...s, visible: false }
          : s,
      ),
    };
    expect(ruleIds(doc)).not.toContain("document/empty-section");
  });
});

describe("document/no-evidence", () => {
  it("fails for a blank resume", () => {
    expect(ruleIds(createEmptyResume())).toContain("document/no-evidence");
  });

  it("passes for a fresher with projects but no jobs", () => {
    // The point of the rule: projects are evidence, not a consolation prize.
    expect(ruleIds(fresherResume)).not.toContain("document/no-evidence");
  });
});

/* -------------------------------------------------------------------------- */
/* Engine behaviour                                                            */
/* -------------------------------------------------------------------------- */

describe("lint engine", () => {
  it("orders findings by severity, errors first", () => {
    const result = lint(createEmptyResume());
    const order = result.findings.map((f) => f.severity);
    const rank = { error: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < order.length; i += 1) {
      expect(rank[order[i]!]).toBeGreaterThanOrEqual(rank[order[i - 1]!]);
    }
  });

  it("counts only errors and warnings as outstanding, per D12", () => {
    const result = lint(createEmptyResume());
    expect(result.outstanding).toBe(result.counts.error + result.counts.warning);
    expect(result.counts.info).toBeGreaterThan(0);
  });

  it("gives every finding a stable key across runs", () => {
    const first = lint(midCareerResume).findings.map((f) => f.key);
    const second = lint(midCareerResume).findings.map((f) => f.key);
    expect(first).toEqual(second);
  });

  it("distinguishes findings of the same rule on different bullets", () => {
    const doc = withBullets(midCareerResume, ["I did a thing.", "I did another thing."]);
    const keys = findingsFor(doc, "bullets/first-person").map((f) => f.key);
    expect(new Set(keys).size).toBe(2);
  });

  it("removes a dismissed finding and leaves the rest", () => {
    const doc = withBullets(midCareerResume, ["I rebuilt the pipeline."]);
    const target = findingsFor(doc, "bullets/first-person")[0];
    expect(target).toBeDefined();

    const after = lint(doc, [
      { key: target!.key, reason: "Deliberate, this is a personal statement.", dismissedAt: 0 },
    ]);
    expect(after.findings.map((f) => f.key)).not.toContain(target!.key);
    expect(after.findings.length).toBeGreaterThan(0);
  });

  it("carries every rule's why text onto its findings", () => {
    for (const finding of lint(createEmptyResume()).findings) {
      const rule = RULES.find((r) => r.id === finding.ruleId);
      expect(finding.why).toBe(rule?.why);
    }
  });

  it("reports a well-built resume as having no outstanding issues", () => {
    // The engine has to be satisfiable, or "issues left" never reaches zero
    // and people stop reading it.
    const polished = withBullets(midCareerResume, [
      "Rebuilt the settlement pipeline, cutting median latency from 400ms to 90ms across 12 markets.",
      "Led a four-person team through a zero-downtime migration of 2.3 billion ledger rows.",
    ]);
    expect(lint(polished).outstanding).toBe(0);
  });
});
