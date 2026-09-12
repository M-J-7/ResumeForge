import { describe, expect, it } from "vitest";
import { completedCount, isReadyToDownload, stepProgress } from "./progress";
import { createEmptyResume } from "@/lib/resume/factory";
import { fresherResume, midCareerResume, singleBulletRoleResume } from "@/test/fixtures/resumes";
import type { ResumeDocument } from "@/lib/resume/schema";

function withContact(doc: ResumeDocument): ResumeDocument {
  return {
    ...doc,
    contact: { ...doc.contact, fullName: "Ada Lovelace", email: "ada@example.com" },
  };
}

describe("stepProgress", () => {
  it("reports everything empty for a blank resume", () => {
    const progress = stepProgress(createEmptyResume());
    for (const [id, value] of Object.entries(progress)) {
      expect(value.status, id).toBe("empty");
    }
  });

  it("marks a fully populated resume's core steps complete", () => {
    const progress = stepProgress(midCareerResume);
    for (const id of ["contact", "summary", "experience", "education", "skills", "projects"]) {
      expect(progress[id]?.status, id).toBe("complete");
    }
  });

  it("treats contact as complete only with a name and a way to reach you", () => {
    const blank = createEmptyResume();
    expect(stepProgress(blank).contact?.status).toBe("empty");

    const namedOnly = { ...blank, contact: { ...blank.contact, fullName: "Ada" } };
    expect(stepProgress(namedOnly).contact?.status).toBe("started");

    const reachable = { ...namedOnly, contact: { ...namedOnly.contact, phone: "+1 555 0100" } };
    expect(stepProgress(reachable).contact?.status).toBe("complete");
  });

  it("counts a role as started until it has a title, an employer, and a bullet", () => {
    const doc = createEmptyResume();
    const withRole: ResumeDocument = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.type === "experience"
          ? {
              ...s,
              entries: [
                {
                  id: "e1",
                  title: "Engineer",
                  organization: "",
                  location: "",
                  dates: { start: { year: 2020, month: null }, end: null, current: true },
                  bullets: [""],
                },
              ],
            }
          : s,
      ),
    };
    expect(stepProgress(withRole).experience?.status).toBe("started");
  });

  it("marks optional steps optional, so an empty one is not shown as unfinished work", () => {
    const progress = stepProgress(createEmptyResume());
    expect(progress.certifications?.optional).toBe(true);
    expect(progress.summary?.optional).toBe(true);
    expect(progress.projects?.optional).toBe(true);
    // Contact and skills are the two we do ask for.
    expect(progress.contact?.optional).toBe(false);
    expect(progress.skills?.optional).toBe(false);
  });
});

describe("isReadyToDownload", () => {
  it("is false for a blank resume", () => {
    expect(isReadyToDownload(createEmptyResume())).toBe(false);
  });

  it("is true for a fresher with projects and no jobs", () => {
    // The whole point: evidence can come from projects or education, not
    // only from employment.
    expect(isReadyToDownload(fresherResume)).toBe(true);
  });

  it("is true for a full mid-career resume", () => {
    expect(isReadyToDownload(midCareerResume)).toBe(true);
  });

  it("is false when there is contact information but no evidence of anything", () => {
    expect(isReadyToDownload(withContact(createEmptyResume()))).toBe(false);
  });

  it("is true for a single complete role — one job is enough", () => {
    expect(isReadyToDownload(singleBulletRoleResume)).toBe(true);
  });

  it("is false when the evidence exists but there is no way to make contact", () => {
    const unreachable: ResumeDocument = {
      ...singleBulletRoleResume,
      contact: { ...singleBulletRoleResume.contact, email: "", phone: "" },
    };
    expect(isReadyToDownload(unreachable)).toBe(false);
  });
});

describe("completedCount", () => {
  it("counts completed steps out of the total", () => {
    const blank = completedCount(createEmptyResume());
    expect(blank.done).toBe(0);
    expect(blank.total).toBeGreaterThan(0);

    const full = completedCount(midCareerResume);
    expect(full.done).toBeGreaterThan(blank.done);
    expect(full.total).toBe(blank.total);
  });
});
