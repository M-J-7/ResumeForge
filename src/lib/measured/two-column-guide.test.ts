/**
 * The measured guide prints the measurement, and says what it is.
 *
 * Every number in its prose and its table is read from `columns.json` at
 * build time, so they cannot disagree with each other; this checks the page
 * actually carries them, and that the `Dataset` markup describes it.
 */

import { describe, expect, it } from "vitest";
import { getGuide } from "@/lib/guides/guides";
import { guideDatasetJsonLd } from "@/lib/structured-data";
import COLUMNS from "./columns.json";

const guide = getGuide("two-column-resume-ats");

describe("the two-column guide", () => {
  it("prints one table row per layout and reader, from the published results", () => {
    const table = guide?.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.kind === "table");
    expect(table?.kind).toBe("table");
    if (table?.kind !== "table") return;
    expect(table.rows).toHaveLength(COLUMNS.results.length);
    for (const [index, result] of COLUMNS.results.entries()) {
      expect(table.rows[index]).toContain(`${result.bulletsIntact} of ${result.bulletsTotal}`);
    }
  });

  it("says plainly that it measured reading strategies, not anybody's ATS", () => {
    const words = JSON.stringify(guide);
    expect(words).toMatch(/not any vendor's applicant tracking system/);
    expect(words).toContain(`${COLUMNS.resumes} resumes`);
  });

  it("is published as a Dataset with what was measured", () => {
    const data = guide ? guideDatasetJsonLd(guide) : null;
    expect(data?.["@type"]).toBe("Dataset");
    expect(String(data?.description).length).toBeGreaterThan(50);
    expect(data?.variableMeasured).toEqual([
      "Fields recovered",
      "Bullets in one piece",
      "Resumes fully intact",
    ]);
  });

  it("gives no other guide a Dataset it did not declare", () => {
    expect(guideDatasetJsonLd(getGuide("resume-file-format")!)).toBeNull();
  });
});
