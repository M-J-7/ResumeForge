/**
 * The Six-Second View, measured on real PDFs rendered by the real emitter —
 * the same bytes the preview shows and the download delivers (D3).
 */

import { describe, expect, it } from "vitest";
import { renderPdf } from "@/lib/emit/pdf/render";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { readPages } from "@/lib/pdf/read";
import type { ResumeDocument } from "@/lib/resume/schema";
import { fresherResume, midCareerResume } from "@/test/fixtures/resumes";
import { CURRENT_ROLE_ZONE, scanDocument } from "./scan";

async function scan(doc: ResumeDocument) {
  const { bytes } = await renderPdf(doc, { resolveFont: nodeFontResolver });
  return scanDocument(doc, await readPages(bytes));
}

/**
 * The same resume with a summary long enough to push the experience down —
 * and opening with the current job title, as real summaries so often do. The
 * first version of the scan matched the title *there*, in the summary, and
 * reported the current role near the top of a page where it began halfway
 * down; this is what holds that fixed.
 */
function withLongSummary(doc: ResumeDocument): ResumeDocument {
  const long = Array.from(
    { length: 14 },
    () =>
      "Senior backend engineer with a long record of shipping reliable systems across payments, identity and data, and of mentoring the people who run them.",
  ).join(" ");
  return {
    ...doc,
    sections: doc.sections.map((section) =>
      section.type === "summary" ? { ...section, visible: true, content: long } : section,
    ),
  };
}

describe("scanDocument", () => {
  it("finds the name at the top and the current role high on page one", async () => {
    const result = await scan(midCareerResume);
    const name = result.targets.find((target) => target.id === "name")!;
    const current = result.targets.find((target) => target.id === "current-role")!;

    expect(name.status).toBe("ok");
    expect(name.depth!).toBeLessThan(0.1);
    expect(current.status).toBe("ok");
    expect(current.page).toBe(1);
    expect(current.depth!).toBeLessThan(CURRENT_ROLE_ZONE);
    expect(current.depth!).toBeGreaterThan(name.depth!);
  }, 60_000);

  it("flags a current role pushed down the page by a long summary", async () => {
    const plain = await scan(midCareerResume);
    const padded = await scan(withLongSummary(midCareerResume));
    const before = plain.targets.find((target) => target.id === "current-role")!;
    const after = padded.targets.find((target) => target.id === "current-role")!;

    expect(after.depth!).toBeGreaterThan(before.depth!);
    expect(after.status).toBe("low");
    expect(padded.issues).toBeGreaterThan(plain.issues);
  }, 60_000);

  it("holds somebody with no roles to their education and first project", async () => {
    const result = await scan(fresherResume);
    const ids = result.targets.map((target) => target.id);
    expect(ids).not.toContain("current-role");
    // With no roles, these two are the record, so both must be on page one.
    const education = result.targets.find((target) => target.id === "education")!;
    const project = result.targets.find((target) => target.id === "project")!;
    expect(education.flagged).toBe(true);
    expect(education.status).toBe("ok");
    expect(project.text).toBe("Campus Placement Portal");
    expect(project.status).toBe("ok");
  }, 60_000);

  it("reports a count of what is left, never a score (D12)", async () => {
    const result = await scan(midCareerResume);
    expect(Number.isInteger(result.issues)).toBe(true);
    for (const target of result.targets) expect(target.note).not.toMatch(/\bscore\b|\/100|grade/i);
  }, 60_000);
});
