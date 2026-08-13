/**
 * Constructors for new resume content.
 *
 * Everything the user can reorder or delete carries a stable id, generated
 * here. Ids exist for React keys, drag-and-drop, and undo/redo coalescing —
 * they are never shown to the user and never leave the document.
 */

import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  type CertificationEntry,
  type ContactLink,
  type CustomEntry,
  type EducationEntry,
  type ExperienceEntry,
  type ProjectEntry,
  type ResumeDocument,
  type Section,
  type SkillGroup,
} from "./schema";
import type { DateRange } from "./dates";

export function createId(): string {
  return crypto.randomUUID();
}

/** A range starting this year and still ongoing — the common case for a new role. */
function openDateRange(): DateRange {
  return { start: { year: new Date().getFullYear(), month: null }, end: null, current: true };
}

export function createExperienceEntry(): ExperienceEntry {
  return {
    id: createId(),
    title: "",
    organization: "",
    location: "",
    dates: openDateRange(),
    bullets: [""],
  };
}

export function createEducationEntry(): EducationEntry {
  return {
    id: createId(),
    institution: "",
    credential: "",
    field: "",
    location: "",
    dates: openDateRange(),
    result: "",
    bullets: [],
  };
}

export function createSkillGroup(label = ""): SkillGroup {
  return { id: createId(), label, skills: [] };
}

export function createProjectEntry(): ProjectEntry {
  return { id: createId(), name: "", role: "", url: "", dates: null, bullets: [""] };
}

export function createCertificationEntry(): CertificationEntry {
  return { id: createId(), name: "", issuer: "", issued: null, credentialId: "", url: "" };
}

export function createCustomEntry(): CustomEntry {
  return { id: createId(), title: "", subtitle: "", dates: null, bullets: [""] };
}

export function createContactLink(label = ""): ContactLink {
  return { id: createId(), label, url: "" };
}

/**
 * Default section order. Reverse-chronological experience first is the
 * universally expected structure; fresher mode (M4-T8) reorders this to lead
 * with projects and education for users with no work history.
 */
export function createDefaultSections(): Section[] {
  return [
    { id: createId(), type: "summary", visible: true, content: "" },
    { id: createId(), type: "experience", visible: true, entries: [] },
    { id: createId(), type: "education", visible: true, entries: [] },
    { id: createId(), type: "skills", visible: true, groups: [] },
    { id: createId(), type: "projects", visible: true, entries: [] },
    { id: createId(), type: "certifications", visible: true, entries: [] },
  ];
}

/**
 * A blank but structurally valid document. It parses cleanly because the
 * schema permits empty content — completeness is the lint engine's concern.
 */
export function createEmptyResume(): ResumeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: { fullName: "", email: "", phone: "", location: "", links: [] },
    sections: createDefaultSections(),
    settings: { ...DEFAULT_SETTINGS },
  };
}
