/**
 * The shape a saved cover letter has, on either side of the seam.
 *
 * Dependency-free for the same reason `lib/match/job-target.ts` is: both
 * backends need it — Prisma on the server, IndexedDB in the browser — and
 * defining it in either would drag that backend's imports into the other's
 * bundle.
 */

export const MAX_COVER_LETTER_TITLE_LENGTH = 120;

export const DEFAULT_COVER_LETTER_TITLE = "Untitled letter";

/** What the `/letters` grid shows, without deserializing a single letter. */
export interface CoverLetterSummaryRecord {
  id: string;
  title: string;
  resumeId: string | null;
  /** The linked resume's name, when there is one and it still exists. */
  resumeTitle: string | null;
  jobTargetId: string | null;
  company: string | null;
  roleTitle: string | null;
  /** ISO string, so it survives JSON in both directions. */
  updatedAt: string;
}

export interface CoverLetterRecord extends CoverLetterSummaryRecord {
  /** A serialized `CoverLetterDocument`. */
  content: string;
}

export interface CoverLetterDraft {
  title: string;
  content: string;
  resumeId?: string | null;
  jobTargetId?: string | null;
  /** Only the local store keeps these; the server derives them from the join. */
  company?: string | null;
  roleTitle?: string | null;
}

/**
 * The *suggested* save name (P29-J4): suggested, never silently applied.
 *
 * `"{Company} — {Role}"`, the same shape a job target suggests, because a
 * letter and the posting it answers are the same thing to the user. The
 * caller shows this as a placeholder in an editable field.
 */
export function suggestCoverLetterTitle(company: string, roleTitle: string): string {
  const c = company.trim();
  const r = roleTitle.trim();
  if (c && r) return `${c} — ${r}`.slice(0, MAX_COVER_LETTER_TITLE_LENGTH);
  return (c || r || DEFAULT_COVER_LETTER_TITLE).slice(0, MAX_COVER_LETTER_TITLE_LENGTH);
}

export function normalizeCoverLetterTitle(title: string): string {
  return title.trim().slice(0, MAX_COVER_LETTER_TITLE_LENGTH) || DEFAULT_COVER_LETTER_TITLE;
}
