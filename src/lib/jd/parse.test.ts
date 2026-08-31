/**
 * Job-description structure (M3-T3).
 *
 * The fixture sweep is the acceptance test: ten postings, ten structural
 * conventions, and for each one a set of marker phrases that must land in a
 * given kind. See `src/test/fixtures/job-descriptions.ts` for what those
 * fixtures are and — importantly — what they are not.
 *
 * The unit tests below guard the two decisions everything else rests on:
 * that a line is judged a heading by its *shape* before its words, and that
 * the pattern table is ordered specific-first.
 */

import { describe, expect, it } from "vitest";
import {
  SECTION_WEIGHTS,
  classifyHeading,
  looksLikeHeading,
  normalizeHeading,
  parseJobDescription,
  sectionSummary,
  weightedLines,
  type JdSectionKind,
  type ParsedJd,
} from "./parse";
import { JD_FIXTURES } from "@/test/fixtures/job-descriptions";

/** Every line the parser put under `kind`, joined for substring searching. */
function textOf(parsed: ParsedJd, kind: JdSectionKind): string {
  return parsed.sections
    .filter((section) => section.kind === kind)
    .flatMap((section) => section.lines)
    .filter((line) => (line.kindOverride ?? kind) === kind)
    .map((line) => line.text)
    .join("\n");
}

/** Lines the parser reclassified individually, whatever section they sat in. */
function overriddenText(parsed: ParsedJd, kind: JdSectionKind): string {
  return parsed.sections
    .flatMap((section) => section.lines)
    .filter((line) => line.kindOverride === kind)
    .map((line) => line.text)
    .join("\n");
}

describe("section split across ten conventions (M3-T3 acceptance)", () => {
  it.each(JD_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
    "splits the %s posting correctly",
    (_name, fixture) => {
      const parsed = parseJobDescription(fixture.text);

      if (fixture.expect.title !== undefined) {
        expect(parsed.title).toBe(fixture.expect.title);
      }

      for (const marker of fixture.expect.required ?? []) {
        const found = `${textOf(parsed, "required")}\n${overriddenText(parsed, "required")}`;
        expect(found, `"${marker}" should be a requirement`).toContain(marker);
      }

      for (const marker of fixture.expect.preferred ?? []) {
        const found = `${textOf(parsed, "preferred")}\n${overriddenText(parsed, "preferred")}`;
        expect(found, `"${marker}" should be a preference`).toContain(marker);
      }

      for (const marker of fixture.expect.responsibilities ?? []) {
        expect(
          textOf(parsed, "responsibilities"),
          `"${marker}" should be a responsibility`,
        ).toContain(marker);
      }

      // Boilerplate is not merely down-weighted — §6 says ignore it entirely,
      // so it must not appear among the lines a scorer would ever see.
      const scored = weightedLines(parsed)
        .map((line) => line.text)
        .join("\n");
      for (const marker of fixture.expect.ignored ?? []) {
        expect(scored, `"${marker}" is boilerplate and must not be scored`).not.toContain(marker);
      }
    },
  );

  it("never drops a posting's content on the floor", () => {
    // Every non-empty, non-heading line has to end up somewhere. A parser
    // that silently discards a requirements block is worse than one that
    // mis-labels it, because nothing downstream can notice.
    for (const fixture of JD_FIXTURES) {
      const parsed = parseJobDescription(fixture.text);
      const placed = parsed.sections.reduce((total, section) => total + section.lines.length, 0);
      const headings = parsed.sections.filter((section) => section.heading !== null).length;
      const contentLines = fixture.text.split("\n").filter((line) => line.trim().length > 0).length;

      // Content lines = placed lines + heading lines (+ the title line).
      const accounted = placed + headings + (parsed.title ? 1 : 0);
      expect(accounted, `${fixture.name} lost lines`).toBe(contentLines);
    }
  });

  it("finds a required and a preferred section in every posting that has both", () => {
    const withBoth = JD_FIXTURES.filter((fixture) => (fixture.expect.preferred?.length ?? 0) > 0);
    expect(withBoth.length).toBeGreaterThanOrEqual(8);

    for (const fixture of withBoth) {
      const summary = sectionSummary(parseJobDescription(fixture.text));
      const parsed = parseJobDescription(fixture.text);
      const preferredLines =
        summary.preferred + weightedLines(parsed).filter((l) => l.kind === "preferred").length;
      expect(preferredLines, `${fixture.name} found no preferences`).toBeGreaterThan(0);
      expect(summary.required, `${fixture.name} found no requirements`).toBeGreaterThan(0);
    }
  });
});

describe("weights", () => {
  it("counts a requirement three times a preference (§6)", () => {
    expect(SECTION_WEIGHTS.required).toBe(3 * SECTION_WEIGHTS.preferred);
  });

  it("puts responsibilities between the two", () => {
    // What the job is counts for more than what would be nice, and for less
    // than what is stated as a bar.
    expect(SECTION_WEIGHTS.responsibilities).toBeGreaterThan(SECTION_WEIGHTS.preferred);
    expect(SECTION_WEIGHTS.responsibilities).toBeLessThan(SECTION_WEIGHTS.required);
  });

  it("gives boilerplate no weight at all", () => {
    for (const kind of ["about", "benefits", "legal", "process"] as const) {
      expect(SECTION_WEIGHTS[kind]).toBe(0);
    }
  });

  it("excludes zero-weight sections from the scored lines entirely", () => {
    const parsed = parseJobDescription(JD_FIXTURES[9]!.text);
    const kinds = new Set(weightedLines(parsed).map((line) => line.kind));
    expect(kinds.has("about")).toBe(false);
    expect(kinds.has("benefits")).toBe(false);
    expect(kinds.has("legal")).toBe(false);
  });
});

describe("looksLikeHeading", () => {
  it.each([
    "Requirements:",
    "## What you'll do",
    "RESPONSIBILITIES",
    "**The Role**",
    "Preferred Qualifications",
    "Nice to have",
  ])("accepts %s", (line) => {
    expect(looksLikeHeading(line)).toBe(true);
  });

  it.each([
    // The word appears mid-sentence; splitting here would cut a paragraph.
    "The final scope will vary depending on requirements",
    "- Requirements gathering with stakeholders",
    "We are looking for someone with strong requirements-analysis skills.",
    "",
    "   ",
  ])("rejects %s", (line) => {
    expect(looksLikeHeading(line)).toBe(false);
  });

  it("rejects a line that is long even if it has no punctuation", () => {
    expect(
      looksLikeHeading(
        "You will be joining a team of twelve engineers spread across three countries",
      ),
    ).toBe(false);
  });

  it("accepts a bullet-looking line only when it is not a bullet", () => {
    expect(looksLikeHeading("- Requirements")).toBe(false);
    expect(looksLikeHeading("Requirements")).toBe(true);
  });
});

describe("normalizeHeading", () => {
  it.each([
    ["## Requirements", "Requirements"],
    ["**Requirements**", "Requirements"],
    ["Requirements:", "Requirements"],
    ["  ### What you'll need  ", "What you'll need"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHeading(input)).toBe(expected);
  });
});

describe("classifyHeading", () => {
  it("reads preferred before required, which is the whole point", () => {
    // "Preferred Qualifications" contains "Qualifications". Test the general
    // pattern first and every posting that separates the two collapses into
    // one required block.
    expect(classifyHeading("Preferred Qualifications")).toBe("preferred");
    expect(classifyHeading("Minimum Qualifications")).toBe("required");
    expect(classifyHeading("Qualifications")).toBe("required");
  });

  it("reads boilerplate before anything that could claim it", () => {
    expect(classifyHeading("Perks & Benefits")).toBe("benefits");
    expect(classifyHeading("Equal Opportunity Employer")).toBe("legal");
    expect(classifyHeading("About the team")).toBe("about");
    expect(classifyHeading("How to apply")).toBe("process");
  });

  it.each([
    ["What you'll need", "required"],
    ["What you’ll need", "required"],
    ["Who you are", "required"],
    ["You should have", "required"],
    ["Essential Skills", "required"],
    ["Nice to have", "preferred"],
    ["Bonus points", "preferred"],
    ["Desirable", "preferred"],
    ["It'd be great if", "preferred"],
    ["What you'll do", "responsibilities"],
    ["What you’ll do", "responsibilities"],
    // Postings write the contraction and the full form about equally often.
    ["What you will do", "responsibilities"],
    ["What you will need", "required"],
    ["Day-to-day", "responsibilities"],
    ["The Role", "responsibilities"],
    ["Your impact", "responsibilities"],
  ] as const)("classifies %s as %s", (heading, kind) => {
    expect(classifyHeading(heading)).toBe(kind);
  });

  it("says unknown rather than guessing", () => {
    expect(classifyHeading("Location")).toBe("unknown");
    expect(classifyHeading("Reporting line")).toBe("unknown");
  });

  it("handles the smart apostrophe a pasted posting actually contains", () => {
    // Copying from a styled web page gives U+2019, not '. A pattern written
    // with only the ASCII form silently fails on the commonest heading there
    // is, and the section quietly becomes `unknown`.
    expect(classifyHeading("What you’ll be doing")).toBe("responsibilities");
  });
});

describe("inline qualifiers", () => {
  const parsed = parseJobDescription(
    [
      "Requirements",
      "- Strong Python (required).",
      "- Familiarity with Ray (nice to have).",
      "- Kubernetes experience is a plus.",
      "- Terraform.",
    ].join("\n"),
  );

  it("demotes an item marked optional inside a required list", () => {
    const preferred = weightedLines(parsed).filter((line) => line.kind === "preferred");
    expect(preferred.map((line) => line.text).join("\n")).toContain("Ray");
  });

  it("leaves unmarked items at the section's own weight", () => {
    const terraform = weightedLines(parsed).find((line) => line.text.startsWith("Terraform"));
    expect(terraform?.kind).toBe("required");
    expect(terraform?.weight).toBe(SECTION_WEIGHTS.required);
  });
});

describe("bullets and titles", () => {
  it("strips every bullet style a posting uses", () => {
    const parsed = parseJobDescription(
      ["Requirements", "- dash", "* star", "• bullet", "1. numbered", "2) parenthesised"].join(
        "\n",
      ),
    );
    const lines = parsed.sections[0]!.lines;
    expect(lines.map((line) => line.text)).toEqual([
      "dash",
      "star",
      "bullet",
      "numbered",
      "parenthesised",
    ]);
    expect(lines.every((line) => line.bullet)).toBe(true);
  });

  it("does not mistake a first-line section heading for a job title", () => {
    const parsed = parseJobDescription("Responsibilities\n- Ship things.");
    expect(parsed.title).toBeNull();
    expect(parsed.sections[0]?.kind).toBe("responsibilities");
  });

  it("keeps line numbers so a finding can point back at the posting", () => {
    const parsed = parseJobDescription("Engineer\n\nRequirements\n- Go.\n");
    const line = parsed.sections[0]!.lines[0]!;
    expect(line.sourceLine).toBe(3);
  });

  it("drops a heading that has nothing under it", () => {
    // A misread heading with no content would otherwise show up in
    // "found under X" as an empty category.
    const parsed = parseJobDescription("Requirements:\n\nBenefits:\n- Holiday.\n");
    expect(parsed.sections.map((section) => section.kind)).toEqual(["benefits"]);
  });
});

describe("robustness", () => {
  it("handles an empty posting", () => {
    const parsed = parseJobDescription("");
    expect(parsed.title).toBeNull();
    expect(parsed.sections).toEqual([]);
    expect(weightedLines(parsed)).toEqual([]);
  });

  it("handles CRLF line endings, which pasted text usually has", () => {
    const parsed = parseJobDescription("Engineer\r\n\r\nRequirements:\r\n- Go.\r\n");
    expect(parsed.sections[0]?.kind).toBe("required");
    expect(parsed.sections[0]?.lines[0]?.text).toBe("Go.");
  });

  it("keeps unheaded opening text rather than discarding it", () => {
    // Plenty of postings state the real requirement in the first paragraph
    // and never repeat it under a heading.
    const parsed = parseJobDescription(
      "We need someone with five years of Rust experience to lead this team.",
    );
    expect(
      weightedLines(parsed)
        .map((line) => line.text)
        .join(),
    ).toContain("Rust");
  });
});
