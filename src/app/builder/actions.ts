"use server";

/**
 * Saving the open resume to the account (M2-T4).
 *
 * One action, called by the sync queue in `store/sync.ts` on a debounce. It
 * re-reads the session and passes the user id to `saveResume`, where it goes
 * into the `where` clause — so a request naming someone else's resume
 * changes zero rows and comes back as "not found", not as a successful save.
 *
 * The document arrives serialized and untrusted. It goes through the
 * migration chain, which both upgrades an older shape and rejects anything
 * that is not a resume at all; a client cannot write arbitrary text into the
 * content column by calling this directly.
 */

import { getSessionUser } from "@/server/auth/session";
import { saveResume } from "@/server/resumes";
import { safeMigrate } from "@/lib/resume/migrate";

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

export async function saveResumeAction(
  id: string,
  serializedDocument: string,
  pageCount: number | null = null,
): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedDocument);
  } catch {
    return { ok: false, error: "That document could not be read." };
  }

  const migrated = safeMigrate(parsed);
  if (!migrated.ok) return { ok: false, error: migrated.error.message };

  const summary = await saveResume(user.id, id, { document: migrated.document, pageCount });
  if (!summary) return { ok: false, error: "That resume no longer exists on this account." };

  return { ok: true, savedAt: summary.updatedAt.toISOString() };
}
