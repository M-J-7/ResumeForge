/**
 * Saved job descriptions (P27-H1).
 *
 * A pasted posting that vanishes on reload is worth analysing exactly once.
 * Keeping it is what makes the match view a place you return to — and it is
 * the input the cover-letter composer reads in P28.
 *
 * ## The same ownership discipline as `server/resumes.ts`
 *
 * Every function takes `userId` first and every statement filters on it,
 * writes included. `updateMany({ where: { id, userId } })` rather than
 * `update({ where: { id } })`: the wrong owner touches zero rows and the
 * caller sees "not found", instead of the row being located, modified, and
 * only then checked. There is no path that loads a job target by id alone.
 *
 * ## Guests do not appear here
 *
 * Per D6 a guest's job targets live in IndexedDB and never reach the server.
 * `src/store/job-targets.ts` holds that half; both sides implement the same
 * `JobTargetStore` interface so the Match tab does not branch on who is
 * signed in.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";
import {
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_JOB_TARGET_TITLE_LENGTH,
  normalizeJobTargetTitle,
  type JobTargetDraft,
} from "@/lib/match/job-target";

export {
  DEFAULT_JOB_TARGET_TITLE,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_JOB_TARGET_TITLE_LENGTH,
  normalizeJobTargetTitle,
  suggestJobTargetTitle,
} from "@/lib/match/job-target";

/** What the picker lists, without pulling every posting's full text. */
export interface JobTargetSummary {
  id: string;
  title: string;
  company: string | null;
  roleTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadedJobTarget extends JobTargetSummary {
  /** The posting, exactly as pasted. */
  description: string;
}

const SUMMARY_SELECT = {
  id: true,
  title: true,
  company: true,
  roleTitle: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Empty string and absent are the same thing to a nullable column. */
function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_JOB_TARGET_TITLE_LENGTH) : null;
}

async function db(client?: PrismaClient): Promise<PrismaClient> {
  return client ?? (await getPrisma());
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function listJobTargets(
  userId: string,
  client?: PrismaClient,
): Promise<JobTargetSummary[]> {
  const prisma = await db(client);
  return prisma.jobTarget.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

/** Null both when it does not exist and when it is someone else's. */
export async function loadJobTarget(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<LoadedJobTarget | null> {
  const prisma = await db(client);
  return prisma.jobTarget.findFirst({
    where: { id, userId },
    select: { ...SUMMARY_SELECT, description: true },
  });
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/** The write shape, shared with the IndexedDB backend. */
export type JobTargetInput = JobTargetDraft;

export async function createJobTarget(
  userId: string,
  input: JobTargetInput,
  client?: PrismaClient,
): Promise<LoadedJobTarget> {
  const prisma = await db(client);
  return prisma.jobTarget.create({
    data: {
      userId,
      title: normalizeJobTargetTitle(input.title),
      company: optional(input.company),
      roleTitle: optional(input.roleTitle),
      description: input.description.slice(0, MAX_JOB_DESCRIPTION_LENGTH),
    },
    select: { ...SUMMARY_SELECT, description: true },
  });
}

export async function saveJobTarget(
  userId: string,
  id: string,
  input: JobTargetInput,
  client?: PrismaClient,
): Promise<LoadedJobTarget | null> {
  const prisma = await db(client);
  const { count } = await prisma.jobTarget.updateMany({
    where: { id, userId },
    data: {
      title: normalizeJobTargetTitle(input.title),
      company: optional(input.company),
      roleTitle: optional(input.roleTitle),
      description: input.description.slice(0, MAX_JOB_DESCRIPTION_LENGTH),
    },
  });
  if (count === 0) return null;
  return prisma.jobTarget.findUniqueOrThrow({
    where: { id },
    select: { ...SUMMARY_SELECT, description: true },
  });
}

export async function renameJobTarget(
  userId: string,
  id: string,
  title: string,
  client?: PrismaClient,
): Promise<JobTargetSummary | null> {
  const prisma = await db(client);
  const { count } = await prisma.jobTarget.updateMany({
    where: { id, userId },
    data: { title: normalizeJobTargetTitle(title) },
  });
  if (count === 0) return null;
  return prisma.jobTarget.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT });
}

/**
 * Hard delete, like everything else here.
 *
 * Cover letters written against this target survive it: `jobTargetId` is
 * `SetNull`, not `Cascade`. The letter already holds its own complete text,
 * and deleting the posting you were applying against is not a request to
 * destroy the letter you wrote.
 */
export async function deleteJobTarget(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<boolean> {
  const prisma = await db(client);
  const { count } = await prisma.jobTarget.deleteMany({ where: { id, userId } });
  return count > 0;
}
