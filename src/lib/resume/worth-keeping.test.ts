/**
 * The threshold for suggesting a backup: a name, and a real piece of a
 * resume beneath it — never an empty form, which would train people to
 * dismiss the suggestion before it matters.
 */

import { describe, expect, it } from "vitest";
import { createEmptyResume, createExperienceEntry, createSkillGroup } from "./factory";
import type { ResumeDocument, Section } from "./schema";
import { worthKeeping } from "./worth-keeping";

function withName(name: string, change: (sections: Section[]) => void = () => {}): ResumeDocument {
  const document = createEmptyResume();
  document.contact.fullName = name;
  change(document.sections);
  return document;
}

describe("worthKeeping", () => {
  it("is false for an empty draft, and for a name on its own", () => {
    expect(worthKeeping(createEmptyResume())).toBe(false);
    expect(worthKeeping(withName("Asha Varma"))).toBe(false);
    expect(worthKeeping(withName("   "))).toBe(false);
  });

  it("is true once a named draft has an entry, a skill group or a written summary", () => {
    const entry = withName("Asha Varma", (sections) => {
      const experience = sections.find((section) => section.type === "experience");
      if (experience?.type === "experience") experience.entries.push(createExperienceEntry());
    });
    expect(worthKeeping(entry)).toBe(true);

    const skills = withName("Asha Varma", (sections) => {
      const group = sections.find((section) => section.type === "skills");
      if (group?.type === "skills") group.groups.push(createSkillGroup("Languages"));
    });
    expect(worthKeeping(skills)).toBe(true);

    const summary = withName("Asha Varma", (sections) => {
      const found = sections.find((section) => section.type === "summary");
      if (found?.type === "summary") {
        found.content = "Backend engineer who has spent four years on payments systems.";
      }
    });
    expect(worthKeeping(summary)).toBe(true);
  });

  it("does not count a few words typed to try the summary box", () => {
    const tried = withName("Asha Varma", (sections) => {
      const found = sections.find((section) => section.type === "summary");
      if (found?.type === "summary") found.content = "hello";
    });
    expect(worthKeeping(tried)).toBe(false);
  });

  it("needs the name: an unnamed draft is not yet somebody's resume", () => {
    const unnamed = withName("", (sections) => {
      const experience = sections.find((section) => section.type === "experience");
      if (experience?.type === "experience") experience.entries.push(createExperienceEntry());
    });
    expect(worthKeeping(unnamed)).toBe(false);
  });
});
