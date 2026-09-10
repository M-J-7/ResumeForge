/**
 * The shape a saved job description has, and how it gets named.
 *
 * Deliberately dependency-free. Both storage backends need these — the
 * Prisma one in `src/server/job-targets.ts` and the IndexedDB one in
 * `src/store/job-targets.ts` — and the Match tab needs the naming helpers in
 * the browser. Putting them in either backend would drag that backend's
 * imports along: `better-sqlite3` into the client bundle from one side, or
 * `idb-keyval` onto the server from the other.
 */

export interface JobTargetRecord {
  id: string;
  title: string;
  company: string | null;
  roleTitle: string | null;
  /** The posting, exactly as pasted. */
  description: string;
  /** ISO string. A string rather than a Date so it survives JSON both ways. */
  updatedAt: string;
}

export interface JobTargetDraft {
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  description: string;
}

export const MAX_JOB_TARGET_TITLE_LENGTH = 120;

/**
 * A posting longer than this is not a posting.
 *
 * Generous on purpose — real postings run long, and truncating one would
 * silently drop the requirements section that is the whole point. The cap
 * exists so a Server Action cannot be used to write megabytes into a TEXT
 * column, not to police formatting.
 */
export const MAX_JOB_DESCRIPTION_LENGTH = 60_000;

export const DEFAULT_JOB_TARGET_TITLE = "Untitled job";

/**
 * The *suggested* save name (P29-J4): suggested, never silently applied.
 *
 * `"{Company} — {Role}"` when both are known, because that is how a person
 * refers to an application. The caller shows this as a placeholder in an
 * editable field, so the name in the list is always one the user accepted.
 */
export function suggestJobTargetTitle(company: string, roleTitle: string): string {
  const c = company.trim();
  const r = roleTitle.trim();
  if (c && r) return `${c} — ${r}`.slice(0, MAX_JOB_TARGET_TITLE_LENGTH);
  return (c || r || DEFAULT_JOB_TARGET_TITLE).slice(0, MAX_JOB_TARGET_TITLE_LENGTH);
}

export function normalizeJobTargetTitle(title: string): string {
  return title.trim().slice(0, MAX_JOB_TARGET_TITLE_LENGTH) || DEFAULT_JOB_TARGET_TITLE;
}
