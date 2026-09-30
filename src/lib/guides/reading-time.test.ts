/**
 * A guide's reading time is counted from its words.
 *
 * It was written by hand, and by 2026-09-30 every original guide claimed two
 * to four times what its text takes to read. A figure the reader uses to
 * decide whether to start has to be the true one.
 */

import { describe, expect, it } from "vitest";
import { GUIDES, readingMinutes, type GuideSection } from "./guides";

function sectionOf(words: number): GuideSection {
  return {
    heading: "Heading",
    blocks: [{ kind: "prose", text: Array.from({ length: words - 1 }, () => "word").join(" ") }],
  };
}

describe("readingMinutes", () => {
  it("counts headings, prose, list items and callouts at two hundred words a minute", () => {
    expect(readingMinutes([sectionOf(200)])).toBe(1);
    expect(readingMinutes([sectionOf(201)])).toBe(2);
    expect(
      readingMinutes([
        {
          heading: "One two",
          blocks: [
            { kind: "list", items: ["three four", "five"] },
            { kind: "callout", text: "six" },
          ],
        },
      ]),
    ).toBe(1);
  });

  it("never says zero, even for a page with nothing on it", () => {
    expect(readingMinutes([])).toBe(1);
  });

  it("is what every guide shows", () => {
    for (const guide of GUIDES) {
      expect(guide.minutes, guide.slug).toBe(readingMinutes(guide.sections));
    }
  });

  it("does not tell a reader a short guide is a long one", () => {
    // The words the page body carries, the same way `readingMinutes` counts
    // them — so a hand-edited figure could not slip back in unnoticed.
    for (const guide of GUIDES) {
      const words = guide.sections
        .flatMap((section) => [
          section.heading,
          ...section.blocks.map((block) =>
            block.kind === "list" ? block.items.join(" ") : block.text,
          ),
        ])
        .join(" ")
        .split(/\s+/).length;
      expect(guide.minutes * 200, guide.slug).toBeLessThan(words + 200);
    }
  });
});
