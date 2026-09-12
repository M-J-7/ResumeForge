/**
 * The diff shown in the enhancement review.
 *
 * The property worth testing hardest is not that the diff is minimal — it is
 * that it is **lossless**. A diff that quietly drops a word would show the
 * user a change that is not the change they are about to accept, in the one
 * screen whose entire job is letting them check exactly that.
 */

import { describe, expect, it } from "vitest";
import { diffWords, summarizeDiff, type DiffSegment } from "./word-diff";

const join = (segments: readonly DiffSegment[], kinds: readonly DiffSegment["kind"][]) =>
  segments
    .filter((segment) => kinds.includes(segment.kind))
    .map((segment) => segment.text)
    .join("");

const CASES: [name: string, before: string, after: string][] = [
  ["a single substitution", "I cut deploy time.", "I reduced deploy time."],
  [
    "a reordering",
    "I cut deploy time by moving 40 services.",
    "By moving 40 services, I cut deploy time.",
  ],
  ["an insertion at the very start", "moved 40 services.", "I moved 40 services."],
  ["an insertion at the very end", "I moved 40 services", "I moved 40 services onto a cluster"],
  ["a deletion", "I quickly moved 40 services.", "I moved 40 services."],
  ["a complete rewrite", "One sentence.", "Something else entirely here."],
  ["punctuation only", "I moved 40 services", "I moved 40 services."],
  ["double spacing the user typed", "I  moved   services.", "I moved services."],
];

describe("diffWords is lossless", () => {
  it.each(CASES)("reconstructs both sides for %s", (_name, before, after) => {
    const segments = diffWords(before, after);
    expect(join(segments, ["same", "removed"])).toBe(before);
    expect(join(segments, ["same", "added"])).toBe(after);
  });
});

describe("diffWords", () => {
  it("reports identical text as one unchanged segment", () => {
    expect(diffWords("Same text.", "Same text.")).toEqual([{ kind: "same", text: "Same text." }]);
  });

  it("returns nothing for two empty paragraphs", () => {
    expect(diffWords("", "")).toEqual([]);
  });

  it("marks only the word that changed", () => {
    const segments = diffWords("I cut deploy time.", "I reduced deploy time.");
    expect(segments.filter((segment) => segment.kind === "removed").map((s) => s.text)).toEqual([
      "cut",
    ]);
    expect(segments.filter((segment) => segment.kind === "added").map((s) => s.text)).toEqual([
      "reduced",
    ]);
  });

  it("does not shred a word into fragments", () => {
    // A character diff turns "deploy" → "deployment" into "deploy" + "ment",
    // which reads as noise. Words are the unit a person proofreads in.
    const segments = diffWords("median deploy time", "median deployment time");
    expect(segments.some((segment) => segment.text === "ment")).toBe(false);
    expect(
      segments.some((segment) => segment.kind === "added" && segment.text === "deployment"),
    ).toBe(true);
  });

  it("merges neighbouring segments of the same kind", () => {
    const segments = diffWords("a b c d", "a x y d");
    // Not one segment per token: "x y" is one insertion to a reader.
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]!.kind).not.toBe(segments[index - 1]!.kind);
    }
  });

  it("copes with a paragraph at the schema's maximum length", () => {
    // The quadratic table is sized by tokens, and 4,000 characters is the
    // cap a saved paragraph can reach. This is the worst case in production.
    const before = "I moved services onto a shared cluster. ".repeat(100);
    const after = before.replace(/moved/g, "migrated");
    const segments = diffWords(before, after);
    expect(join(segments, ["same", "removed"])).toBe(before);
    expect(join(segments, ["same", "added"])).toBe(after);
  });
});

describe("summarizeDiff", () => {
  it("counts words rather than segments, and ignores whitespace", () => {
    expect(summarizeDiff(diffWords("I cut deploy time.", "I reduced deploy time."))).toBe(
      "1 word removed, 1 word added.",
    );
  });

  it("says so plainly when nothing changed", () => {
    expect(summarizeDiff(diffWords("Same.", "Same."))).toBe("No wording changed.");
  });

  it("reports a pure insertion without inventing a removal", () => {
    expect(summarizeDiff(diffWords("I moved services.", "I moved 40 services."))).toBe(
      "1 word added.",
    );
  });
});
