"use server";

/**
 * Cover letter mutations (P29-J2).
 *
 * Every one re-reads the session, for the reason spelled out in
 * `dashboard/actions.ts`: a Server Action is an HTTP endpoint reachable by
 * direct POST, so the page having rendered proves nothing about who is
 * calling. The user id then goes into the `where` clause of every statement
 * in `server/cover-letters.ts`.
 *
 * The letter arrives serialized and untrusted. It goes through the migration
 * chain before anything is stored, which both upgrades an older shape and
 * rejects anything that is not a cover letter at all — a client cannot write
 * arbitrary text into the content column by calling this directly.
 */

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/auth/session";
import {
  createCoverLetter,
  deleteCoverLetter,
  duplicateCoverLetter,
  listCoverLetters,
  loadCoverLetter,
  renameCoverLetter,
  saveCoverLetter,
} from "@/server/cover-letters";
import { safeMigrateCoverLetter } from "@/lib/cover-letter/migrate";
import type { ActionResult } from "@/app/dashboard/actions";
import type {
  CoverLetterDraft,
  CoverLetterRecord,
  CoverLetterSummaryRecord,
} from "@/lib/cover-letter/record";

const NOT_SIGNED_IN = "You are not signed in. Reload the page and try again.";
const NOT_FOUND = "That cover letter no longer exists.";
const UNREADABLE = "That letter could not be read.";

/** Rejects anything that is not a valid cover letter before it reaches a column. */
function validated(content: string): { ok: true; content: string } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  const migrated = safeMigrateCoverLetter(parsed);
  if (!migrated.ok) return { ok: false, error: migrated.error.message };
  // Re-serialized from the *migrated* document, so what lands in the column
  // is always at the current version rather than whatever the client held.
  return { ok: true, content: JSON.stringify(migrated.document) };
}

export async function listCoverLettersAction(): Promise<
  ActionResult<CoverLetterSummaryRecord[]>
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  return { ok: true, value: await listCoverLetters(user.id) };
}

export async function loadCoverLetterAction(
  id: string,
): Promise<ActionResult<CoverLetterRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const loaded = await loadCoverLetter(user.id, id);
  if (!loaded) return { ok: false, error: NOT_FOUND };
  return { ok: true, value: loaded.record };
}

export async function createCoverLetterAction(
  input: CoverLetterDraft,
): Promise<ActionResult<CoverLetterRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const content = validated(input.content);
  if (!content.ok) return { ok: false, error: content.error };

  const record = await createCoverLetter(user.id, { ...input, content: content.content });
  revalidatePath("/letters");
  revalidatePath("/dashboard");
  return { ok: true, value: record };
}

export async function saveCoverLetterAction(
  id: string,
  input: CoverLetterDraft,
): Promise<ActionResult<CoverLetterRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const content = validated(input.content);
  if (!content.ok) return { ok: false, error: content.error };

  const record = await saveCoverLetter(user.id, id, { ...input, content: content.content });
  if (!record) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  return { ok: true, value: record };
}

export async function renameCoverLetterAction(
  id: string,
  title: string,
): Promise<ActionResult<CoverLetterSummaryRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const record = await renameCoverLetter(user.id, id, title);
  if (!record) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  return { ok: true, value: record };
}

export async function duplicateCoverLetterAction(
  id: string,
): Promise<ActionResult<CoverLetterSummaryRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const record = await duplicateCoverLetter(user.id, id);
  if (!record) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  return { ok: true, value: record };
}

/** Hard delete. There is no trash and no undo — the UI says so. */
export async function deleteCoverLetterAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const deleted = await deleteCoverLetter(user.id, id);
  if (!deleted) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  revalidatePath("/dashboard");
  return { ok: true, value: null };
}
