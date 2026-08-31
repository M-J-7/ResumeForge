"use server";

/**
 * Dashboard mutations (M2-T3, M2-T4).
 *
 * Every one of these re-reads the session. A Server Action is an HTTP
 * endpoint reachable by direct POST, so the page having redirected an
 * anonymous visitor proves nothing about who is calling this. The user id
 * then goes to `server/resumes.ts` as an argument, where it is part of the
 * `where` clause of every statement — an unowned id updates zero rows rather
 * than being found first and checked second.
 */

import { revalidatePath } from "next/cache";
import { signOut } from "@/server/auth";
import { getSessionUser } from "@/server/auth/session";
import { confirmsDeletion, deleteAccount } from "@/server/accounts";
import {
  claimDraft,
  deleteResume,
  duplicateResume,
  renameResume,
  type ResumeSummary,
} from "@/server/resumes";

export type ActionResult<T = null> = { ok: true; value: T } | { ok: false; error: string };

const NOT_SIGNED_IN = "You are not signed in. Reload the page and try again.";
const NOT_FOUND = "That resume no longer exists.";

/**
 * Saves the browser's draft to the account (M2-T3).
 *
 * The document arrives as a JSON string because it came out of IndexedDB and
 * may have been written by an older build; `claimDraft` runs it through the
 * migration chain before storing anything. A document that cannot be
 * migrated is reported rather than dropped — the caller only clears local
 * storage on `ok`, so a failed claim leaves the draft exactly where it was.
 */
export async function claimDraftAction(
  serializedDocument: string,
): Promise<ActionResult<ResumeSummary>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedDocument);
  } catch {
    return { ok: false, error: "That draft could not be read." };
  }

  const outcome = await claimDraft(user.id, parsed);
  if (outcome.status === "invalid") {
    return {
      ok: false,
      error: "That draft is from a version we can no longer read, so it was left in your browser.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true, value: outcome.resume };
}

export async function renameResumeAction(
  id: string,
  title: string,
): Promise<ActionResult<ResumeSummary>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const resume = await renameResume(user.id, id, title);
  if (!resume) return { ok: false, error: NOT_FOUND };

  revalidatePath("/dashboard");
  return { ok: true, value: resume };
}

export async function duplicateResumeAction(id: string): Promise<ActionResult<ResumeSummary>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const resume = await duplicateResume(user.id, id);
  if (!resume) return { ok: false, error: NOT_FOUND };

  revalidatePath("/dashboard");
  return { ok: true, value: resume };
}

/** Hard delete, per M2-T4. There is no trash and no undo — the UI says so. */
export async function deleteResumeAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const deleted = await deleteResume(user.id, id);
  if (!deleted) return { ok: false, error: NOT_FOUND };

  revalidatePath("/dashboard");
  return { ok: true, value: null };
}

/**
 * Deletes the account and everything in it (M2-T6).
 *
 * The typed confirmation is checked here as well as in the form, because a
 * Server Action is reachable by direct POST — a client-side gate on the one
 * irreversible action in the product would be no gate at all.
 *
 * Sign-out happens after the delete rather than before: the session row is
 * already gone by then (it cascades), so this only clears the cookie and
 * sends the browser somewhere that still exists. Auth.js's sign-out logs the
 * resulting "no such session" as a `SignOutError` and carries on clearing
 * the cookie — checked, because the ordering would otherwise leave a signed
 * cookie pointing at a deleted account.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  if (!confirmsDeletion(confirmation, user.email)) {
    return { ok: false, error: "Type your email address exactly to confirm." };
  }

  await deleteAccount(user.id);
  await signOut({ redirectTo: "/" });
  return { ok: true, value: null };
}
