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
  createResume,
  deleteResume,
  duplicateResume,
  loadResume,
  renameResume,
  type ResumeSummary,
} from "@/server/resumes";
import { createEmptyResume } from "@/lib/resume/factory";
import { safeMigrate } from "@/lib/resume/migrate";
import type { ResumeDocument } from "@/lib/resume/schema";

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

/**
 * Starts a new resume on the account — blank, or seeded from a document
 * already open in the builder (P24).
 *
 * `createResume`, `renameResume` and `duplicateResume` have existed since
 * M2-T4 with correct ownership scoping; nothing before this called the first
 * one. A signed-in visitor could open the builder and edit the one local
 * guest draft, or open an existing account resume, but had no way to start a
 * second one — from either a blank page or a copy of what they were already
 * editing.
 *
 * Two callers, one action:
 *
 *   - The dashboard's "New resume" dialog omits `serializedDocument`, and
 *     gets `createEmptyResume()` — the blank-page case.
 *   - The builder's "Save as new resume" passes the currently open document,
 *     serialized the same way `saveResumeAction` receives it. This is what
 *     makes keeping a per-application copy natural: tailor a resume, save it
 *     as a new one, keep tailoring from there without touching the original.
 *
 * An empty or omitted title falls through to `deriveResumeTitle`.
 */
export async function createResumeAction(
  title?: string,
  serializedDocument?: string,
): Promise<ActionResult<ResumeSummary>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  let document: ResumeDocument;
  if (serializedDocument) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serializedDocument);
    } catch {
      return { ok: false, error: "That document could not be read." };
    }
    const migrated = safeMigrate(parsed);
    if (!migrated.ok) return { ok: false, error: migrated.error.message };
    document = migrated.document;
  } else {
    document = createEmptyResume();
  }

  const trimmed = title?.trim();
  const resume = await createResume(user.id, {
    document,
    title: trimmed ? trimmed : undefined,
  });

  revalidatePath("/dashboard");
  return { ok: true, value: resume };
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

/**
 * Supplies a resume's full content to a client that already knows the id —
 * the dashboard thumbnail, specifically.
 *
 * `listResumes` deliberately excludes `content` so the dashboard's initial
 * load stays cheap regardless of how many resumes exist or how large they
 * are. This is the one path that fetches a single resume's content on
 * demand, still scoped through `loadResume`'s ownership check, so the cost
 * is paid only for the card actually being rendered.
 */
export async function getResumeContentAction(
  id: string,
): Promise<ActionResult<ResumeDocument>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const loaded = await loadResume(user.id, id);
  if (!loaded) return { ok: false, error: NOT_FOUND };

  return { ok: true, value: loaded.document };
}
