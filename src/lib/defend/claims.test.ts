/**
 * "Defend every number" (ROADMAP F9): what it finds, what it leaves alone,
 * and the D8 line it holds.
 */

import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { contact, exampleResume, role, skills } from "@/lib/examples/build";
import { QUESTIONS, claimsAsText, collectClaims, findClaims, type ClaimKind } from "./claims";

/** The spans in a sentence, as `kind:text`, for readable assertions. */
function spans(text: string, options?: { skill?: boolean }): string[] {
  return findClaims(text, options).map((span) => `${span.kind}:${span.text}`);
}

describe("the questions (D8)", () => {
  it("are questions, and cannot supply a figure", () => {
    // The coach's rule, held here for the same reason: a question with a
    // number in it is a number somebody could paste into their resume.
    for (const [kind, question] of Object.entries(QUESTIONS)) {
      expect(question.endsWith("?"), kind).toBe(true);
      expect(/\d/.test(question), kind).toBe(false);
    }
  });

  it("marks only the user's own words, exactly as written", () => {
    for (const example of ROLE_EXAMPLES) {
      for (const group of collectClaims(example.resume).groups) {
        for (const line of group.lines) {
          for (const span of line.spans) {
            expect(line.text.slice(span.start, span.end), example.slug).toBe(span.text);
          }
        }
      }
    }
  });
});

describe("figures", () => {
  it("reads a before-and-after as one claim when something changed", () => {
    expect(spans("Cut settlement processing from 40 minutes to 6 by replacing batches.")).toEqual([
      "change:from 40 minutes to 6",
    ]);
    expect(spans("Taking p99 latency from 1.4s to 210ms at triple the volume.")).toEqual([
      "change:from 1.4s to 210ms",
    ]);
    expect(spans("Reduced discharge delays from an average of 4.2 hours to 90 minutes.")).toEqual([
      "change:from an average of 4.2 hours to 90 minutes",
    ]);
    expect(spans("Moved the cohort from −0.2 to +0.4.")).toEqual(["change:from −0.2 to +0.4"]);
  });

  it("reads a range as two figures when nothing changed", () => {
    expect(spans("Led fieldwork on clients with revenues from €4m to €80m.")).toEqual([
      "money:€4m",
      "money:€80m",
    ]);
  });

  it("finds money in any currency the examples use", () => {
    expect(spans("Identified €340k of duplicate payments.")).toEqual(["money:€340k"]);
    expect(spans("Cleared a ₹4.2 lakh difference.")).toEqual(["money:₹4.2 lakh"]);
    expect(spans("Ran an A$4.2M site.")).toEqual(["money:A$4.2M"]);
    expect(spans("Saved Rs. 12 lakh a year.")).toEqual(["money:Rs. 12 lakh"]);
  });

  it("finds percentages, ranks, scores and multiples", () => {
    expect(spans("Closed 118% of a $2.4m quota in 2024.")).toEqual([
      "percent:118%",
      "money:$2.4m",
    ]);
    expect(spans("Raised margin 2.4 points.")).toEqual(["percent:2.4 points"]);
    expect(spans("Placed 12th of 340 teams.")).toEqual(["rank:12th of 340"]);
    expect(spans("Held CSAT at 4.7 out of 5.")).toEqual(["score:4.7 out of 5"]);
    expect(spans("Doubled monthly trial signups.")).toEqual(["multiple:Doubled"]);
  });

  it("reads people after a verb of leading as a team, and anything else as a count", () => {
    expect(spans("Trained 26 staff on the new roster.")).toEqual(["team:26 staff"]);
    expect(spans("Led a team of 6 through the migration.")).toEqual(["team:team of 6"]);
    expect(spans("Wrote 38 integration tests with Jest.")).toEqual(["count:38"]);
  });

  it("keeps a duration that is a claim, and drops tenure the dates already state", () => {
    expect(spans("No pressure injuries on the unit for 14 months.")).toEqual(["time:14 months"]);
    expect(spans("Backend developer with 5 years of experience in payments.")).toEqual([]);
    expect(spans("Rebuilt the first 90 days around a named buddy.")).toEqual([]);
  });

  it("leaves alone numbers that name rather than count", () => {
    expect(spans("Migrated services to Java 17 and Kubernetes 1.29.")).toEqual([]);
    expect(spans("Prepared the site for its ISO 9001 audit.")).toEqual([]);
    expect(spans("Moved students to grade 4 or above.")).toEqual([]);
    expect(spans("Filed every return before the 20th.")).toEqual([]);
    expect(spans("Result: 8.1 CGPA up to the 7th semester.")).toEqual(["count:8.1"]);
    expect(spans("Answered the on-call line 24/7 in Q3 using S3 and EC2.")).toEqual([]);
    expect(spans("Joined in 03/2024 and shipped in 2025.")).toEqual([]);
  });
});

describe("word claims", () => {
  it("finds a real first, and not the first of something", () => {
    expect(spans("Built the first attribution model in the company.")).toEqual([
      "superlative:the first",
    ]);
    expect(spans("Seventeen were accepted on the first submission.")).toEqual([]);
    expect(spans("Bundled slow lines with the two best sellers.")).toEqual([]);
  });

  it("treats 'advanced' as a level only in a skills list", () => {
    expect(spans("Holds Advanced Cardiac Life Support.")).toEqual([]);
    expect(spans("Advanced Excel", { skill: true })).toEqual(["proficiency:Advanced"]);
    expect(spans("Bilingual in English and Spanish.")).toEqual(["proficiency:Bilingual"]);
  });
});

describe("collectClaims", () => {
  const doc = exampleResume({
    slug: "claims-test",
    contact: contact({ fullName: "A. Tester", email: "a@example.com", phone: "", location: "" }),
    summary: "Support lead with a 94% quality score. Fluent in Hindi and English.",
    experience: [
      role({
        id: "r1",
        title: "Team Lead",
        organization: "Acme",
        location: "Pune",
        from: "2023-01",
        bullets: ["Led 9 agents through a merger.", "", "Wrote the escalation guide."],
      }),
    ],
    education: [],
    skillGroups: [skills("sk1", "Tools", ["Advanced Excel", "SQL"])],
  });

  it("groups by where each line sits, in page order, and skips what has nothing", () => {
    const report = collectClaims(doc);
    expect(report.groups.map((group) => group.title)).toEqual([
      "Summary",
      "Team Lead · Acme",
      "Skills",
    ]);
    const role = report.groups[1]!;
    expect(role.lines.map((line) => line.text)).toEqual(["Led 9 agents through a merger."]);
    expect(role.lines[0]!.id).toBe("r1:0");
    expect(report.figures).toBe(2);
    expect(report.claims).toBe(2);
  });

  it("asks one question for the figures and one for a word claim", () => {
    const summary = collectClaims(doc).groups[0]!;
    expect(summary.lines.map((line) => line.questions)).toEqual([
      [QUESTIONS.percent],
      [QUESTIONS.proficiency],
    ]);
  });

  it("leaves out a hidden section: it is not on the page", () => {
    const hidden = {
      ...doc,
      sections: doc.sections.map((section) =>
        section.type === "summary" ? { ...section, visible: false } : section,
      ),
    };
    expect(collectClaims(hidden).groups.map((group) => group.title)).not.toContain("Summary");
  });

  it("writes the checklist out as plain text", () => {
    const text = claimsAsText(collectClaims(doc));
    expect(text).toContain("Team Lead · Acme\n  [ ] Led 9 agents through a merger.\n");
    expect(text).toContain(QUESTIONS.team);
  });
});

describe("every example resume", () => {
  it.each(ROLE_EXAMPLES.map((example) => [example.slug, example] as const))(
    "%s: every line it lists has a figure or a claim, in order, without overlaps",
    (_slug, example) => {
      const report = collectClaims(example.resume);
      expect(report.figures).toBeGreaterThan(0);
      for (const group of report.groups) {
        for (const line of group.lines) {
          expect(line.spans.length).toBeGreaterThan(0);
          expect(line.questions.length).toBeGreaterThan(0);
          for (let i = 1; i < line.spans.length; i++) {
            expect(line.spans[i]!.start).toBeGreaterThanOrEqual(line.spans[i - 1]!.end);
          }
        }
      }
    },
  );

  it("finds exactly what the fresher's resume asks you to defend", () => {
    const fresher = ROLE_EXAMPLES.find((example) => example.slug === "software-engineer-fresher")!;
    const found = collectClaims(fresher.resume).groups.flatMap((group) =>
      group.lines.flatMap((line) => line.spans.map((span) => `${span.kind}:${span.text}`)),
    );
    expect(found).toEqual([
      "change:from 4.1% to 0.6%",
      "count:38",
      "count:1,200",
      "change:from 40 to 310",
      "count:18,000",
    ] satisfies `${ClaimKind}:${string}`[]);
  });
});
