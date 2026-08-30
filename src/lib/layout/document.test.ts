import { describe, expect, it } from "vitest";
import {
  buildDocument,
  STANDARD_SECTION_LABELS,
  type BulletBlock,
  type DocumentBlock,
} from "./document";
import { createEmptyResume } from "@/lib/resume/factory";
import {
  fresherResume,
  longCareerResume,
  midCareerResume,
  singleBulletRoleResume,
} from "@/test/fixtures/resumes";
import { DEFAULT_SETTINGS, type ResumeDocument, type Section } from "@/lib/resume/schema";

function experienceEntryBlocks(blocks: DocumentBlock[], entryId: string) {
  return blocks.filter(
    (b): b is DocumentBlock & { entryId: string } => "entryId" in b && b.entryId === entryId,
  );
}

function bulletsOf(blocks: DocumentBlock[], entryId: string): BulletBlock[] {
  return blocks.filter((b): b is BulletBlock => b.type === "bullet" && b.entryId === entryId);
}

describe("buildDocument — section headings", () => {
  it("emits every visible section as a keepWithNext heading with the exact ATS-standard string", () => {
    const blocks = buildDocument(midCareerResume);
    const headings = blocks.filter((b) => b.type === "sectionHeading");

    expect(headings.map((h) => h.label)).toEqual([
      "Summary",
      "Experience",
      "Education",
      "Skills",
      "Projects",
      "Certifications",
      "Languages", // custom section — user label, not a standard string
    ]);
    for (const h of headings) expect(h.keepWithNext).toBe(true);
  });

  it("matches STANDARD_SECTION_LABELS for every standard section type", () => {
    expect(STANDARD_SECTION_LABELS).toEqual({
      summary: "Summary",
      experience: "Experience",
      education: "Education",
      skills: "Skills",
      projects: "Projects",
      certifications: "Certifications",
    });
  });

  it("omits sections marked not visible", () => {
    const resume: ResumeDocument = {
      ...midCareerResume,
      sections: midCareerResume.sections.map((s) =>
        s.type === "projects" ? ({ ...s, visible: false } as Section) : s,
      ),
    };
    const blocks = buildDocument(resume);
    const headingLabels = blocks.filter((b) => b.type === "sectionHeading").map((b) => b.label);
    expect(headingLabels).not.toContain("Projects");
  });

  it("emits no heading for a visible section with no content", () => {
    // A bare heading is wrong on its own terms, and with nothing to be kept
    // with it can also end a page — violating rule 1. Reporting the empty
    // section is the lint engine's job (M0-T11), not the renderer's.
    const blocks = buildDocument(createEmptyResume());
    expect(blocks.filter((b) => b.type === "sectionHeading")).toEqual([]);
    expect(blocks.map((b) => b.type)).toEqual(["contact"]);
  });

  it("drops only the empty sections, keeping the populated ones", () => {
    const blocks = buildDocument(fresherResume);
    const headingLabels = blocks.filter((b) => b.type === "sectionHeading").map((b) => b.label);
    // The fresher fixture has an empty summary, experience, and certifications.
    expect(headingLabels).toEqual(["Education", "Skills", "Projects"]);
  });
});

describe("buildDocument — one role (rule 2, 3, 4)", () => {
  const blocks = buildDocument(midCareerResume);
  // exp-1 has 3 bullets: first embeds into the header, 2 remain separate.
  const entryId = "exp-1";

  it("fuses the header with the first bullet into one atomic block", () => {
    const [header] = experienceEntryBlocks(blocks, entryId);
    expect(header?.type).toBe("experienceEntry");
    if (header?.type !== "experienceEntry") throw new Error("expected experienceEntry");
    expect(header.firstBullet).toBe(
      "Redesigned the settlement pipeline, cutting median latency from 400ms to 90ms across 12 markets.",
    );
    expect(header.keepTogether).toBe(true);
  });

  it("emits the remaining bullets as separate keepTogether blocks, in order", () => {
    const bullets = bulletsOf(blocks, entryId);
    expect(bullets).toHaveLength(2);
    expect(bullets.every((b) => b.keepTogether)).toBe(true);
    expect(bullets[0]?.text).toContain("zero-downtime migration");
    expect(bullets[1]?.text).toContain("Cut infrastructure spend");
  });

  it("guards the second-to-last bullet so the true final bullet cannot orphan alone", () => {
    const bullets = bulletsOf(blocks, entryId);
    // 3 bullets total -> 2 remaining after the header embed -> penultimate
    // of the *remaining* pair (index 0) gets the guard, not the header.
    expect(bullets[0]?.minPresenceAhead).toBeGreaterThan(0);
    expect(bullets[1]?.minPresenceAhead).toBeUndefined();
  });

  it("never marks a role header keepWithNext — only section headings use that hint", () => {
    const [header] = experienceEntryBlocks(blocks, entryId);
    expect(header?.keepWithNext).toBeUndefined();
  });
});

describe("buildDocument — role with a single bullet (rule 2, 4 edge case)", () => {
  const blocks = buildDocument(singleBulletRoleResume);
  const entryId = "sb-exp-1";

  it("embeds the sole bullet into the header and emits no standalone bullet block", () => {
    const entryBlocks = experienceEntryBlocks(blocks, entryId);
    expect(entryBlocks).toHaveLength(1);
    const [header] = entryBlocks;
    if (header?.type !== "experienceEntry") throw new Error("expected experienceEntry");
    expect(header.firstBullet).toContain("Advised three Series A startups");
    expect(header.keepTogether).toBe(true);
  });

  it("needs no orphan guard, because there is nothing left in the entry to orphan", () => {
    const [header] = experienceEntryBlocks(blocks, entryId);
    expect(header?.minPresenceAhead).toBeUndefined();
  });
});

describe("buildDocument — five roles (M0-T3 scale case)", () => {
  const blocks = buildDocument(longCareerResume);
  const experienceSection = longCareerResume.sections.find((s) => s.type === "experience");
  if (experienceSection?.type !== "experience")
    throw new Error("fixture must have an experience section");
  const roleIds = experienceSection.entries.map((e) => e.id);

  it("produces exactly one header block per role, each keepTogether", () => {
    for (const id of roleIds) {
      const entryBlocks = experienceEntryBlocks(blocks, id).filter(
        (b) => b.type === "experienceEntry",
      );
      expect(entryBlocks).toHaveLength(1);
      expect(entryBlocks[0]?.keepTogether).toBe(true);
    }
  });

  it("applies the orphan guard independently per role, never leaking across role boundaries", () => {
    // lc-exp-3 is the single-bullet role among the five — same edge case as
    // the dedicated fixture above, but proven not to interfere with its
    // neighbours in a larger document.
    const single = experienceEntryBlocks(blocks, "lc-exp-3")[0];
    if (single?.type !== "experienceEntry") throw new Error("expected experienceEntry");
    expect(single.firstBullet).not.toBeNull();
    expect(bulletsOf(blocks, "lc-exp-3")).toHaveLength(0);
    expect(single.minPresenceAhead).toBeUndefined();

    // lc-exp-1 has 4 bullets -> 3 remaining -> guard sits on the middle one
    // (index 1 of the remaining pair), not on the role's own header.
    const bullets1 = bulletsOf(blocks, "lc-exp-1");
    expect(bullets1).toHaveLength(3);
    expect(bullets1[0]?.minPresenceAhead).toBeUndefined();
    expect(bullets1[1]?.minPresenceAhead).toBeGreaterThan(0);
    expect(bullets1[2]?.minPresenceAhead).toBeUndefined();
  });

  it("keeps every role's blocks contiguous and in resume order", () => {
    const entryBlockIndices = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => "entryId" in b && roleIds.includes(b.entryId))
      .map(({ b, i }) => ({ entryId: (b as { entryId: string }).entryId, i }));

    // The first occurrence of each role id, in the order roles appear in
    // the block list, must match the order roles appear in the resume.
    const firstSeenOrder: string[] = [];
    for (const { entryId } of entryBlockIndices) {
      if (!firstSeenOrder.includes(entryId)) firstSeenOrder.push(entryId);
    }
    expect(firstSeenOrder).toEqual(roleIds);
  });
});

describe("buildDocument — orphan guard scales with settings", () => {
  it("produces a larger minPresenceAhead for larger font size / line height", () => {
    const compact: ResumeDocument = {
      ...midCareerResume,
      settings: { ...DEFAULT_SETTINGS, fontSizePt: 9, lineHeight: 1 },
    };
    const roomy: ResumeDocument = {
      ...midCareerResume,
      settings: { ...DEFAULT_SETTINGS, fontSizePt: 12, lineHeight: 1.6 },
    };

    const compactGuard = bulletsOf(buildDocument(compact), "exp-1")[0]?.minPresenceAhead;
    const roomyGuard = bulletsOf(buildDocument(roomy), "exp-1")[0]?.minPresenceAhead;

    expect(compactGuard).toBeGreaterThan(0);
    expect(roomyGuard).toBeGreaterThan(compactGuard ?? 0);
  });
});

describe("buildDocument — blank content is not rendered", () => {
  it("drops empty bullets rather than emitting a bare bullet block", () => {
    const resume: ResumeDocument = {
      ...singleBulletRoleResume,
      sections: singleBulletRoleResume.sections.map((s) =>
        s.type === "experience"
          ? {
              ...s,
              entries: s.entries.map((e) => ({ ...e, bullets: ["", "  ", "Real content here."] })),
            }
          : s,
      ),
    };
    const blocks = buildDocument(resume);
    const header = experienceEntryBlocks(blocks, "sb-exp-1")[0];
    if (header?.type !== "experienceEntry") throw new Error("expected experienceEntry");
    expect(header.firstBullet).toBe("Real content here.");
    expect(bulletsOf(blocks, "sb-exp-1")).toHaveLength(0);
  });

  it("drops a skill group with no label and no skills", () => {
    const resume: ResumeDocument = {
      ...midCareerResume,
      sections: midCareerResume.sections.map((s) =>
        s.type === "skills"
          ? { ...s, groups: [...s.groups, { id: "empty-group", label: "  ", skills: ["", " "] }] }
          : s,
      ),
    };
    const blocks = buildDocument(resume);
    const skillBlocks = blocks.filter((b) => b.type === "skillGroup");
    expect(skillBlocks.find((b) => b.groupId === "empty-group")).toBeUndefined();
  });

  it("omits a summary section entirely — heading included — when its text is blank", () => {
    const resume: ResumeDocument = {
      ...midCareerResume,
      sections: midCareerResume.sections.map((s) =>
        s.type === "summary" ? { ...s, content: "   " } : s,
      ),
    };
    const blocks = buildDocument(resume);
    expect(blocks.some((b) => b.type === "summary")).toBe(false);
    expect(blocks.filter((b) => b.type === "sectionHeading").map((b) => b.label)).not.toContain(
      "Summary",
    );
  });
});

describe("buildDocument — contact", () => {
  it("is always the first block", () => {
    const blocks = buildDocument(midCareerResume);
    expect(blocks[0]?.type).toBe("contact");
  });
});
