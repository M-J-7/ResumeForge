/**
 * M0-T6 acceptance: ASCII-clean output that survives a textarea round-trip.
 */

import { describe, expect, it } from "vitest";
import { renderText } from "./render";
import { ALL_FIXTURES, midCareerResume, emptyResume } from "@/test/fixtures/resumes";
import { buildDocument } from "@/lib/layout/document";
import type { ResumeDocument } from "@/lib/resume/schema";

/** Every character the user actually typed, across the whole document. */
function userTypedCharacters(resume: ResumeDocument): Set<string> {
  const chars = new Set<string>();
  const add = (s: string) => {
    for (const c of s) chars.add(c);
  };
  add(resume.contact.fullName);
  add(resume.contact.email);
  add(resume.contact.phone);
  add(resume.contact.location);
  for (const link of resume.contact.links) {
    add(link.label);
    add(link.url);
  }
  for (const section of resume.sections) {
    if (section.type === "custom") add(section.label);
    if (section.type === "summary") add(section.content);
    if (section.type === "skills") {
      for (const g of section.groups) {
        add(g.label);
        for (const s of g.skills) add(s);
      }
    }
    if ("entries" in section) {
      for (const entry of section.entries) {
        for (const value of Object.values(entry)) {
          if (typeof value === "string") add(value);
          if (Array.isArray(value)) for (const v of value) if (typeof v === "string") add(v);
        }
      }
    }
  }
  return chars;
}

describe("renderText — the ASCII rule", () => {
  it.each(ALL_FIXTURES)(
    "$name emits no non-ASCII we did not receive from the user",
    ({ document }) => {
      const typed = userTypedCharacters(document);
      for (const char of renderText(document)) {
        if (char.charCodeAt(0) < 128) continue;
        expect(
          typed.has(char),
          `emitted non-ASCII ${JSON.stringify(char)} the user never typed`,
        ).toBe(true);
      }
    },
  );

  it("folds the en dash we inject into date ranges to a plain hyphen", () => {
    const text = renderText(midCareerResume);
    expect(text).toContain("Mar 2022 - Present");
    expect(text).not.toContain("–");
  });

  it("preserves accented characters the user did type", () => {
    const text = renderText(midCareerResume);
    expect(text).toContain("José Ángel Muñoz-Łukasiewicz");
    expect(text).toContain("Universitat Politècnica de Catalunya");
  });

  it("uses no box drawing or decorative rules", () => {
    for (const { document } of ALL_FIXTURES) {
      const text = renderText(document);
      expect(text).not.toMatch(/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝•]/);
      // A run of dashes or equals as a heading underline.
      expect(text).not.toMatch(/^\s*[-=_*]{3,}\s*$/m);
    }
  });
});

describe("renderText — textarea round-trip", () => {
  it.each(ALL_FIXTURES)("$name survives a round-trip unchanged", ({ document }) => {
    const text = renderText(document);
    // What a textarea does to text: normalizes line endings on submit.
    const roundTripped = text.replace(/\r\n/g, "\n");
    expect(roundTripped).toBe(text);
  });

  it("contains no tabs, carriage returns, or trailing whitespace", () => {
    for (const { document } of ALL_FIXTURES) {
      const text = renderText(document);
      expect(text).not.toContain("\t");
      expect(text).not.toContain("\r");
      for (const line of text.split("\n")) {
        expect(line).toBe(line.trimEnd());
      }
    }
  });

  it("never emits more than one blank line in a row", () => {
    for (const { document } of ALL_FIXTURES) {
      expect(renderText(document)).not.toContain("\n\n\n");
    }
  });

  it("ends with exactly one newline and starts with content", () => {
    for (const { document } of ALL_FIXTURES) {
      const text = renderText(document);
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      expect(text[0]).not.toBe("\n");
    }
  });
});

describe("renderText — structure", () => {
  it("puts section headings in caps on their own line", () => {
    const lines = renderText(midCareerResume).split("\n");
    for (const heading of [
      "SUMMARY",
      "EXPERIENCE",
      "EDUCATION",
      "SKILLS",
      "PROJECTS",
      "CERTIFICATIONS",
    ]) {
      expect(lines).toContain(heading);
    }
  });

  it("prefixes every bullet with '- '", () => {
    const text = renderText(midCareerResume);
    const bulletBlocks = buildDocument(midCareerResume).filter((b) => b.type === "bullet");
    for (const bullet of bulletBlocks) {
      expect(text).toContain(`- ${bullet.text}`);
    }
  });

  it("renders the name first and the contact line second", () => {
    const lines = renderText(midCareerResume).split("\n");
    expect(lines[0]).toBe("José Ángel Muñoz-Łukasiewicz");
    expect(lines[1]).toContain("jose.munoz@example.com");
  });

  it("separates entries with a blank line", () => {
    const text = renderText(midCareerResume);
    expect(text).toContain(
      "- Cut infrastructure spend 31% by replacing per-request container spin-up with a warm worker pool.\n\nBackend Engineer | Jun 2019 - Feb 2022",
    );
  });

  it("emits nothing but a trailing newline for a blank resume", () => {
    // Every section is empty, so buildDocument drops them all and the
    // contact block has no content either.
    expect(renderText(emptyResume())).toBe("\n");
  });
});
