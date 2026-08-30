/**
 * The builder's steps.
 *
 * Order matches M0-T8. Steps are freely navigable rather than a forced
 * wizard: people build resumes by jumping to the section they have something
 * to say about, and gating step 4 behind step 3 just makes them fill step 3
 * with filler.
 */

import type { SectionType } from "@/lib/resume/schema";

export interface StepDefinition {
  id: string;
  label: string;
  /** Section this step edits; `custom` covers all custom sections at once. */
  sectionType: SectionType | "contact";
  /** One line under the step heading. */
  description: string;
}

export const STEPS: readonly StepDefinition[] = [
  {
    id: "contact",
    label: "Contact",
    sectionType: "contact",
    description:
      "How a recruiter reaches you. Keep it in the body of the document, never in a header.",
  },
  {
    id: "summary",
    label: "Summary",
    sectionType: "summary",
    description: "Optional. Two or three sentences, or nothing at all.",
  },
  {
    id: "experience",
    label: "Experience",
    sectionType: "experience",
    description: "Roles in reverse-chronological order — most recent first.",
  },
  {
    id: "education",
    label: "Education",
    sectionType: "education",
    description: "Degrees, diplomas, and programmes.",
  },
  {
    id: "skills",
    label: "Skills",
    sectionType: "skills",
    description: "Grouped so a reader can scan them in a few seconds.",
  },
  {
    id: "projects",
    label: "Projects",
    sectionType: "projects",
    description: "Evidence of what you can build, with or without a job title.",
  },
  {
    id: "certifications",
    label: "Certifications",
    sectionType: "certifications",
    description: "Credentials that act as a hiring filter for your roles.",
  },
  {
    id: "custom",
    label: "Custom",
    sectionType: "custom",
    description:
      "Languages, publications, patents, speaking — anything the standard sections miss.",
  },
];

export const DEFAULT_STEP_ID = STEPS[0]!.id;
