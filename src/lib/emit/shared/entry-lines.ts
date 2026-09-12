/**
 * Shared textual composition for the DOCX and TXT emitters.
 *
 * M0-T5's acceptance criterion is that `mammoth` extraction of the DOCX
 * matches the TXT emitter's output modulo whitespace. Two emitters composing
 * the same fields independently will drift — someone reorders a field in one
 * and not the other, and the criterion turns into a maintenance tax that
 * gets suppressed rather than a guarantee that gets kept.
 *
 * So the composition lives here once, and both emitters render the same
 * three parts. Drift becomes impossible rather than merely detectable.
 *
 * The PDF emitter deliberately does *not* use this: it lays a role header out
 * as two columns (title left, date right) with a real tab stop, which is a
 * visual arrangement with no meaningful plain-text equivalent. What all three
 * share is `DocumentBlock[]` and the break rules — that is the contract that
 * matters.
 */

import type { DocumentBlock } from "@/lib/layout/document";

export interface EntryLines {
  /** The entry's primary line — job title, credential, project name. */
  heading: string;
  /** Rendered to the right of the heading; null when the entry is undated. */
  dateLabel: string | null;
  /** Supporting detail: organization, location, issuer, URL. May be empty. */
  meta: string;
  /** Fused onto the header block by rule 2; rendered as the entry's first bullet. */
  firstBullet: string | null;
}

export function joinNonEmpty(parts: ReadonlyArray<string | null | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim().length > 0)).join(sep);
}

/**
 * The composition for any entry-shaped block, or null for blocks that are
 * not entries (contact, headings, summary, skills, standalone bullets).
 */
export function entryLines(block: DocumentBlock): EntryLines | null {
  switch (block.type) {
    case "experienceEntry":
      return {
        heading: block.title,
        dateLabel: block.dateLabel,
        meta: joinNonEmpty([block.organization, block.location], ", "),
        firstBullet: block.firstBullet,
      };

    case "educationEntry":
      return {
        // Credential leads because it is what a reader scans for; the
        // institution follows on the meta line.
        heading: joinNonEmpty([block.credential, block.field], ", ") || block.institution,
        dateLabel: block.dateLabel,
        meta: joinNonEmpty([block.institution, block.location, block.result], ", "),
        firstBullet: block.firstBullet,
      };

    case "projectEntry":
      return {
        heading: block.name,
        dateLabel: block.dateLabel,
        meta: joinNonEmpty([block.role, block.url], " | "),
        firstBullet: block.firstBullet,
      };

    case "certificationEntry":
      return {
        heading: block.name,
        dateLabel: block.dateLabel,
        meta: joinNonEmpty(
          [
            block.issuer,
            block.credentialId ? `Credential ID: ${block.credentialId}` : null,
            block.url,
          ],
          " | ",
        ),
        firstBullet: null,
      };

    case "customEntry":
      return {
        heading: block.title,
        dateLabel: block.dateLabel,
        meta: block.subtitle,
        firstBullet: block.firstBullet,
      };

    default:
      return null;
  }
}

/** The single contact line both emitters render beneath the name. */
export function contactLine(block: Extract<DocumentBlock, { type: "contact" }>): string {
  const links = block.links
    .filter((l) => l.url)
    .map((l) => (l.label ? `${l.label}: ${l.url}` : l.url));
  return joinNonEmpty([block.email, block.phone, block.location, ...links], " | ");
}

/**
 * A skill group as its two parts. Split rather than pre-joined because DOCX
 * sets the label in a bold run of its own, while TXT has no such notion —
 * but both must produce the same characters, so the separator lives here.
 */
export function skillGroupParts(block: Extract<DocumentBlock, { type: "skillGroup" }>): {
  labelPrefix: string;
  skills: string;
} {
  return {
    labelPrefix: block.label ? `${block.label}: ` : "",
    skills: block.skills.join(", "),
  };
}

/** The single line a skill group renders as. */
export function skillGroupLine(block: Extract<DocumentBlock, { type: "skillGroup" }>): string {
  const { labelPrefix, skills } = skillGroupParts(block);
  return `${labelPrefix}${skills}`;
}
