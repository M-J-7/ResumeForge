/**
 * Construction helpers for the example resumes (P36).
 *
 * The examples are the largest body of hand-written content in the
 * repository, and written out longhand each one would be two hundred lines
 * of `id`, `location`, `current: false` — which is how a set of eight
 * quietly becomes inconsistent. These helpers make an example about its
 * *content*, so a reviewer reads the resume rather than the scaffolding.
 *
 * Ids are literal and derived from the slug. `createId()` is
 * nondeterministic, and an example page is rendered on every request: a
 * fresh id per render would be a needless difference in a document that is
 * supposed to be the same every time anybody looks at it. The fixtures make
 * the same choice for the same reason.
 */

import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from "@/lib/resume/schema";
import type {
  Contact,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeDocument,
  Section,
  Settings,
  SkillGroup,
} from "@/lib/resume/schema";
import type { PartialDate } from "@/lib/resume/dates";

/** `"2019-06"` or `"2019"`. Written as a string because a table of examples
 *  reads far better than a table of `{ year, month }` objects. */
export function on(value: string): PartialDate {
  const [year, month] = value.split("-");
  return { year: Number(year), month: month ? Number(month) : null };
}

export function role(input: {
  id: string;
  title: string;
  organization: string;
  location: string;
  from: string;
  to?: string;
  bullets: string[];
}): ExperienceEntry {
  return {
    id: input.id,
    title: input.title,
    organization: input.organization,
    location: input.location,
    dates: input.to
      ? { start: on(input.from), end: on(input.to), current: false }
      : { start: on(input.from), end: null, current: true },
    bullets: input.bullets,
  };
}

export function study(input: {
  id: string;
  institution: string;
  credential: string;
  field?: string;
  location: string;
  from: string;
  to: string;
  result?: string;
}): EducationEntry {
  return {
    id: input.id,
    institution: input.institution,
    credential: input.credential,
    field: input.field ?? "",
    location: input.location,
    dates: { start: on(input.from), end: on(input.to), current: false },
    result: input.result ?? "",
    bullets: [],
  };
}

export function project(input: {
  id: string;
  name: string;
  role?: string;
  url?: string;
  from?: string;
  to?: string;
  bullets: string[];
}): ProjectEntry {
  return {
    id: input.id,
    name: input.name,
    role: input.role ?? "",
    url: input.url ?? "",
    dates:
      input.from && input.to ? { start: on(input.from), end: on(input.to), current: false } : null,
    bullets: input.bullets,
  };
}

export function skills(id: string, label: string, list: string[]): SkillGroup {
  return { id, label, skills: list };
}

/**
 * Assembles the document.
 *
 * Empty sections are dropped rather than rendered empty: `document/empty-section`
 * in the lint engine flags exactly that, and an example that our own checker
 * would complain about is not an example worth showing.
 */
export function exampleResume(input: {
  slug: string;
  contact: Contact;
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skillGroups: SkillGroup[];
  projects?: ProjectEntry[];
  settings?: Partial<Settings>;
}): ResumeDocument {
  const sections: Section[] = [
    { id: `${input.slug}-summary`, type: "summary", visible: true, content: input.summary },
    {
      id: `${input.slug}-experience`,
      type: "experience",
      visible: true,
      entries: input.experience,
    },
    { id: `${input.slug}-education`, type: "education", visible: true, entries: input.education },
    { id: `${input.slug}-skills`, type: "skills", visible: true, groups: input.skillGroups },
  ];

  if (input.projects && input.projects.length > 0) {
    sections.push({
      id: `${input.slug}-projects`,
      type: "projects",
      visible: true,
      entries: input.projects,
    });
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: input.contact,
    sections,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
  };
}

export function contact(input: {
  fullName: string;
  email: string;
  phone: string;
  location: string;
}): Contact {
  return { ...input, links: [] };
}
