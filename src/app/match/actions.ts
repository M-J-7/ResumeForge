"use server";

/**
 * Job target mutations (P27-H1).
 *
 * Every one re-reads the session. A Server Action is an HTTP endpoint
 * reachable by direct POST, so the page having rendered for a signed-in user
 * proves nothing about who is calling this. The id then goes to
 * `server/job-targets.ts` as an argument, where it is part of the `where`
 * clause of every statement.
 *
 * These return `JobTargetRecord` — the same shape the local IndexedDB store
 * returns — rather than the Prisma row, so `MatchPanel` gets one type from
 * either backend. `Date` is serialized to an ISO string here for the same
 * reason: a `Date` crossing the Server Action boundary arrives as one thing
 * in one runtime and another elsewhere, and the local store has only ever
 * had a string.
 */

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/auth/session";
import {
  createJobTarget,
  deleteJobTarget,
  listJobTargets,
  loadJobTarget,
  saveJobTarget,
  type LoadedJobTarget,
} from "@/server/job-targets";
import type { ActionResult } from "@/app/dashboard/actions";
import type { JobTargetDraft, JobTargetRecord } from "@/lib/match/job-target";

const NOT_SIGNED_IN = "You are not signed in. Reload the page and try again.";
const NOT_FOUND = "That job description no longer exists.";

function toRecord(row: LoadedJobTarget): JobTargetRecord {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    roleTitle: row.roleTitle,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listJobTargetsAction(): Promise<ActionResult<JobTargetRecord[]>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  // Summaries only — the list does not need every posting's full text, and
  // pulling it would scale the match view's first paint with how many
  // postings the account has kept.
  const rows = await listJobTargets(user.id);
  return {
    ok: true,
    value: rows.map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      roleTitle: row.roleTitle,
      description: "",
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/** The one path that fetches a posting's full text, on the card being opened. */
export async function loadJobTargetAction(id: string): Promise<ActionResult<JobTargetRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const row = await loadJobTarget(user.id, id);
  if (!row) return { ok: false, error: NOT_FOUND };
  return { ok: true, value: toRecord(row) };
}

export async function createJobTargetAction(
  input: JobTargetDraft,
): Promise<ActionResult<JobTargetRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  if (!input.description.trim()) {
    return { ok: false, error: "Paste the job description first." };
  }

  const row = await createJobTarget(user.id, {
    title: input.title,
    company: input.company,
    roleTitle: input.roleTitle,
    description: input.description,
  });
  revalidatePath("/letters");
  return { ok: true, value: toRecord(row) };
}

export async function saveJobTargetAction(
  id: string,
  input: JobTargetDraft,
): Promise<ActionResult<JobTargetRecord>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const row = await saveJobTarget(user.id, id, {
    title: input.title,
    company: input.company,
    roleTitle: input.roleTitle,
    description: input.description,
  });
  if (!row) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  return { ok: true, value: toRecord(row) };
}

export async function deleteJobTargetAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const deleted = await deleteJobTarget(user.id, id);
  if (!deleted) return { ok: false, error: NOT_FOUND };
  revalidatePath("/letters");
  return { ok: true, value: null };
}
