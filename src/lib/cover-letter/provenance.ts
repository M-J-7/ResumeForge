/**
 * Turning a paragraph's `sources` into something a person can read (§10.2, 2.1).
 *
 * ## The gap this closes
 *
 * The product's whole claim is "every sentence came from your resume". The
 * only evidence of that a user could see was a chip reading "2 sources in
 * your resume" whose tooltip was a pair of UUIDs. The provenance was stored,
 * correctly, and then shown to nobody — which makes the strongest thing this
 * composer does invisible at exactly the moment somebody is deciding whether
 * to trust it.
 *
 * ## Degrading honestly
 *
 * An id that no longer resolves returns null and the caller falls back to the
 * count. That is not a rare case: the resume can be edited after the letter
 * was written, and an entry the letter quoted may simply be gone. Rendering a
 * stale label — or worse, guessing at one — would be a false statement about
 * where a sentence came from, in the one component whose job is to be
 * truthful about that.
 *
 * ## One traversal, so attribution and labels cannot disagree
 *
 * `compose.ts` has to answer the same question ("which entry is this id, and
 * what is it called?") in order to write "At Meridian Health, I …". If the
 * two walked the resume separately they would eventually differ, and the
 * letter would attribute a sentence to one entry while the chip beside it
 * named another. `organizationForEntry` is built on `findEntry` here.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

/** An entry a letter drew from, reduced to what a label needs. */
export interface SourceEntry {
  id: string;
  /** The section it lives in — decides how the label is phrased. */
  kind: "experience" | "projects" | "custom" | "education" | "certifications" | "skills";
  /** The specific thing: a job title, a project name, a custom entry's title. */
  name: string;
  /** Where it happened, when the entry has a separate field for it. */
  organization: string;
}

/**
 * The entry with this id, or null.
 *
 * Every section type that can carry an entry id is searched, not only the
 * ones the composer currently quotes from. A source id is an id; deciding
 * which sections are "allowed" to appear here would be a second policy that
 * has to be kept in step with `evidence.ts`, and it was exactly that kind of
 * partial traversal that dropped custom-section attribution.
 */
export function findEntry(resume: ResumeDocument, id: string): SourceEntry | null {
  if (!id) return null;

  for (const section of resume.sections) {
    switch (section.type) {
      case "experience": {
        const entry = section.entries.find((candidate) => candidate.id === id);
        if (entry) {
          return {
            id,
            kind: "experience",
            name: entry.title.trim(),
            organization: entry.organization.trim(),
          };
        }
        break;
      }
      case "projects": {
        const entry = section.entries.find((candidate) => candidate.id === id);
        // A project's name is the thing, and its role is the part played in
        // it — so the name is the label and the role is the qualifier.
        if (entry) {
          return { id, kind: "projects", name: entry.name.trim(), organization: "" };
        }
        break;
      }
      case "custom": {
        const entry = section.entries.find((candidate) => candidate.id === id);
        if (entry) {
          return {
            id,
            kind: "custom",
            name: entry.title.trim(),
            organization: entry.subtitle.trim(),
          };
        }
        break;
      }
      case "education": {
        const entry = section.entries.find((candidate) => candidate.id === id);
        if (entry) {
          return {
            id,
            kind: "education",
            name: entry.credential.trim(),
            organization: entry.institution.trim(),
          };
        }
        break;
      }
      case "certifications": {
        const entry = section.entries.find((candidate) => candidate.id === id);
        if (entry) {
          return {
            id,
            kind: "certifications",
            name: entry.name.trim(),
            organization: entry.issuer.trim(),
          };
        }
        break;
      }
      /*
       * Skills groups, since the alignment paragraph may cite one.
       *
       * `resumeFragments` tags a skills mention with the *group* id, and the
       * §12 gap fix lets a listed-only skill reach the letter — so a group id
       * is now a source a paragraph can record. Without this case it resolved
       * to null and rendered as a chip with no label, which is precisely the
       * partial-traversal failure the header above warns about, arriving from
       * a new direction.
       */
      case "skills": {
        const group = section.groups.find((candidate) => candidate.id === id);
        if (group) return { id, kind: "skills", name: group.label.trim(), organization: "" };
        break;
      }
    }
  }

  return null;
}

/** One entry as a phrase: "Platform Engineer at Meridian Health". */
export function describeEntry(entry: SourceEntry): string {
  /*
   * A skills group says what it is, because the distinction is the point.
   *
   * "Infrastructure" beside a sentence would read as a job or a project. The
   * whole reason a listed-only skill is allowed into the letter is that the
   * reader can see it came from a list rather than from the work, so the label
   * has to carry that — an unqualified group name would quietly undo it.
   */
  if (entry.kind === "skills") {
    return entry.name ? `${entry.name} (skills list)` : "your skills list";
  }
  if (entry.name && entry.organization) return `${entry.name} at ${entry.organization}`;
  // Either half alone is still the user's own text, and still identifies the
  // entry. An entry with neither is unnameable and is dropped by the caller.
  return entry.name || entry.organization;
}

/**
 * The ids a paragraph drew from, as phrases, in the order they were recorded.
 *
 * Ids that no longer resolve, and entries with nothing to name them by, are
 * dropped rather than rendered as a placeholder. Duplicates are collapsed:
 * two bullets from one job is one source to a reader, however many rows it is
 * in the document.
 */
export function describeSources(resume: ResumeDocument, ids: readonly string[]): string[] {
  const described: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const entry = findEntry(resume, id);
    if (!entry) continue;
    const label = describeEntry(entry);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    described.push(label);
  }

  return described;
}
