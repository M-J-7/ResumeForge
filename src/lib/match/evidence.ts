/**
 * Where in a resume a skill is actually demonstrated (M3-T4).
 *
 * The scorer's central distinction is between a skill *listed* and a skill
 * *shown*. "Kubernetes" in a comma-separated Skills line is a claim;
 * "Cut deploy time from 38 minutes to 6 by moving 40 services onto
 * Kubernetes" is evidence. Weighting them the same is what lets a resume be
 * improved by typing words into a list, which is the behaviour M3-T4 exists
 * to make unprofitable.
 *
 * Every fragment carries enough identity to point at — section id, entry id,
 * and the literal text — because M3-T5's acceptance is that every number is
 * traceable to specific resume text. A score you cannot click through to is
 * indistinguishable from one that was invented.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

/**
 * Ranked by how much a mention there is worth.
 *
 * The ordering is the argument: an accomplishment bullet is the strongest
 * claim a resume makes, and a keyword list is the weakest. Education and
 * certifications sit in between — a certification names a real credential,
 * but it says nothing about having used the thing.
 */
export const EVIDENCE_WEIGHT = {
  experienceBullet: 1,
  projectBullet: 0.85,
  /** A role or project *title*, e.g. "Kubernetes Platform Engineer". */
  entryHeading: 0.7,
  certification: 0.6,
  educationBullet: 0.5,
  summary: 0.4,
  /** A comma-separated list. A claim, not a demonstration. */
  skillsList: 0.25,
} as const;

export type EvidenceKind = keyof typeof EVIDENCE_WEIGHT;

/** True where a mention counts as *demonstrated* rather than merely claimed. */
export function isDemonstration(kind: EvidenceKind): boolean {
  return kind !== "skillsList";
}

export interface ResumeFragment {
  kind: EvidenceKind;
  sectionId: string;
  /** The entry within the section, where the section has entries. */
  entryId?: string;
  /** The literal text, kept verbatim so the UI can quote it back. */
  text: string;
}

/**
 * Every piece of text in the resume, tagged with where it came from.
 *
 * Hidden sections are skipped. A hidden section is not in the document the
 * employer receives, so counting it would score a resume nobody will read —
 * and would let someone park a keyword list in a hidden section to lift a
 * number, which is the same exploit from a different direction.
 */
export function resumeFragments(resume: ResumeDocument): ResumeFragment[] {
  const fragments: ResumeFragment[] = [];
  const push = (kind: EvidenceKind, sectionId: string, text: string, entryId?: string): void => {
    const trimmed = text.trim();
    if (trimmed) fragments.push({ kind, sectionId, entryId, text: trimmed });
  };

  for (const section of resume.sections) {
    if (!section.visible) continue;

    switch (section.type) {
      case "summary":
        push("summary", section.id, section.content);
        break;

      case "experience":
        for (const entry of section.entries) {
          push("entryHeading", section.id, `${entry.title} ${entry.organization}`, entry.id);
          for (const bullet of entry.bullets) {
            push("experienceBullet", section.id, bullet, entry.id);
          }
        }
        break;

      case "projects":
        for (const entry of section.entries) {
          push("entryHeading", section.id, `${entry.name} ${entry.role}`, entry.id);
          for (const bullet of entry.bullets) {
            push("projectBullet", section.id, bullet, entry.id);
          }
        }
        break;

      case "education":
        for (const entry of section.entries) {
          push("entryHeading", section.id, `${entry.credential} ${entry.field}`, entry.id);
          for (const bullet of entry.bullets) {
            push("educationBullet", section.id, bullet, entry.id);
          }
        }
        break;

      case "certifications":
        for (const entry of section.entries) {
          push("certification", section.id, `${entry.name} ${entry.issuer}`, entry.id);
        }
        break;

      case "skills":
        for (const group of section.groups) {
          for (const skill of group.skills) {
            push("skillsList", section.id, skill, group.id);
          }
        }
        break;

      case "custom":
        for (const entry of section.entries) {
          push("entryHeading", section.id, `${entry.title} ${entry.subtitle}`, entry.id);
          for (const bullet of entry.bullets) {
            // Weighted as a project bullet: a custom section is where
            // volunteering, publications and open source land, and those are
            // demonstrations rather than lists.
            push("projectBullet", section.id, bullet, entry.id);
          }
        }
        break;
    }
  }

  return fragments;
}

/** Total words across the visible resume — the denominator for density. */
export function resumeWordCount(fragments: readonly ResumeFragment[]): number {
  let total = 0;
  for (const fragment of fragments) {
    total += fragment.text.split(/\s+/).filter(Boolean).length;
  }
  return total;
}
