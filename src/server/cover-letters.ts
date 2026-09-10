/**
 * Server-side cover letter storage (P29-J1).
 *
 * ## Ownership, again, and for the same reason
 *
 * Every function takes `userId` first and every statement filters on it,
 * writes included — `updateMany({ where: { id, userId } })`, never
 * `update({ where: { id } })`. This is the third module in the codebase with
 * that shape (`resumes.ts`, `job-targets.ts`, this) and the repetition is
 * deliberate: a shared "checkOwnership then mutate" helper reintroduces the
 * gap between the check and the write that filtering in the statement closes.
 *
 * ## `SetNull`, and why it is different here
 *
 * `resumeId` and `jobTargetId` are `onDelete: SetNull`. Every other relation
 * in the schema cascades. The asymmetry is the point: deleting a resume must
 * not silently destroy the letters written from it. A letter's `content` is
 * already a complete, self-contained copy of its own text — the resume link
 * is provenance, not a dependency, and losing the provenance is survivable
 * where losing the letter is not.
 *
 * `userId` stays `Cascade`, so M2-T6's hard-delete guarantee is intact.
 * `accounts.test.ts` asserts this table empties with the user.
 *
 * ## Reads go through the migration chain (D10)
 *
 * `loadCoverLetter` runs `safeMigrateCoverLetter` for the same reason
 * `loadResume` runs `safeMigrate`: a document written by an older build must
 * never reach the UI unmigrated, and the server is not exempt.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";
import { safeMigrateCoverLetter } from "@/lib/cover-letter/migrate";
import {
  normalizeCoverLetterTitle,
  type CoverLetterDraft,
  type CoverLetterRecord,
  type CoverLetterSummaryRecord,
} from "@/lib/cover-letter/record";
import type { CoverLetterDocument } from "@/lib/cover-letter/schema";

export {
  DEFAULT_COVER_LETTER_TITLE,
  MAX_COVER_LETTER_TITLE_LENGTH,
  normalizeCoverLetterTitle,
  suggestCoverLetterTitle,
} from "@/lib/cover-letter/record";

/**
 * Company and role come from the linked job target rather than from columns
 * of their own.
 *
 * The alternative is denormalising them onto `CoverLetter`, which then has to
 * be kept in step with the posting every time the posting is edited. The join
 * is one indexed lookup on a table the same user owns; the duplication is a
 * permanent correctness liability.
 */
const SUMMARY_SELECT = {
  id: true,
  title: true,
  resumeId: true,
  jobTargetId: true,
  updatedAt: true,
  resume: { select: { title: true } },
  jobTarget: { select: { company: true, roleTitle: true } },
} as const;

type SummaryRow = {
  id: string;
  title: string;
  resumeId: string | null;
  jobTargetId: string | null;
  updatedAt: Date;
  resume: { title: string } | null;
  jobTarget: { company: string | null; roleTitle: string | null } | null;
};

function toSummary(row: SummaryRow): CoverLetterSummaryRecord {
  return {
    id: row.id,
    title: row.title,
    resumeId: row.resumeId,
    resumeTitle: row.resume?.title ?? null,
    jobTargetId: row.jobTargetId,
    company: row.jobTarget?.company ?? null,
    roleTitle: row.jobTarget?.roleTitle ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function db(client?: PrismaClient): Promise<PrismaClient> {
  return client ?? (await getPrisma());
}

/**
 * Links are validated as the caller's own before they are stored.
 *
 * Without this, a signed-in user could attach their letter to someone else's
 * resume id. Nothing would leak — no query ever reads the linked row without
 * its own `userId` filter — but the row would carry a false claim, and
 * `resumeTitle` would then render a stranger's resume name on their card.
 */
async function ownedOrNull(
  prisma: PrismaClient,
  userId: string,
  table: "resume" | "jobTarget",
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  const found =
    table === "resume"
      ? await prisma.resume.findFirst({ where: { id, userId }, select: { id: true } })
      : await prisma.jobTarget.findFirst({ where: { id, userId }, select: { id: true } });
  return found ? id : null;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function listCoverLetters(
  userId: string,
  client?: PrismaClient,
): Promise<CoverLetterSummaryRecord[]> {
  const prisma = await db(client);
  const rows = await prisma.coverLetter.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toSummary);
}

/** How many letters were written from one resume — the dashboard cross-link. */
export async function countCoverLettersByResume(
  userId: string,
  client?: PrismaClient,
): Promise<Map<string, number>> {
  const prisma = await db(client);
  const rows = await prisma.coverLetter.groupBy({
    by: ["resumeId"],
    where: { userId, resumeId: { not: null } },
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.resumeId) counts.set(row.resumeId, row._count._all);
  }
  return counts;
}

/**
 * Loads one letter, migrating the stored document on the way out.
 *
 * Returns `null` both when the row does not exist and when it belongs to
 * someone else — the caller cannot tell those apart, which is the point. A
 * document that fails to migrate throws rather than returning null: "your
 * letter is gone" and "this build cannot read your letter" call for very
 * different responses.
 */
export async function loadCoverLetter(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<{ record: CoverLetterRecord; document: CoverLetterDocument } | null> {
  const prisma = await db(client);
  const row = await prisma.coverLetter.findFirst({
    where: { id, userId },
    select: { ...SUMMARY_SELECT, content: true },
  });
  if (!row) return null;

  const { content, ...summary } = row;
  const parsed: unknown = JSON.parse(content);
  const result = safeMigrateCoverLetter(parsed);
  if (!result.ok) {
    throw new Error(`Stored cover letter ${id} could not be migrated: ${result.error.message}`);
  }

  return {
    record: { ...toSummary(summary), content },
    document: result.document,
  };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export async function createCoverLetter(
  userId: string,
  input: CoverLetterDraft,
  client?: PrismaClient,
): Promise<CoverLetterRecord> {
  const prisma = await db(client);
  const row = await prisma.coverLetter.create({
    data: {
      userId,
      title: normalizeCoverLetterTitle(input.title),
      content: input.content,
      resumeId: await ownedOrNull(prisma, userId, "resume", input.resumeId),
      jobTargetId: await ownedOrNull(prisma, userId, "jobTarget", input.jobTargetId),
    },
    select: { ...SUMMARY_SELECT, content: true },
  });
  const { content, ...summary } = row;
  return { ...toSummary(summary), content };
}

export async function saveCoverLetter(
  userId: string,
  id: string,
  input: CoverLetterDraft,
  client?: PrismaClient,
): Promise<CoverLetterRecord | null> {
  const prisma = await db(client);
  const { count } = await prisma.coverLetter.updateMany({
    where: { id, userId },
    data: {
      title: normalizeCoverLetterTitle(input.title),
      content: input.content,
      resumeId: await ownedOrNull(prisma, userId, "resume", input.resumeId),
      jobTargetId: await ownedOrNull(prisma, userId, "jobTarget", input.jobTargetId),
    },
  });
  if (count === 0) return null;

  const row = await prisma.coverLetter.findUniqueOrThrow({
    where: { id },
    select: { ...SUMMARY_SELECT, content: true },
  });
  const { content, ...summary } = row;
  return { ...toSummary(summary), content };
}

export async function renameCoverLetter(
  userId: string,
  id: string,
  title: string,
  client?: PrismaClient,
): Promise<CoverLetterSummaryRecord | null> {
  const prisma = await db(client);
  const { count } = await prisma.coverLetter.updateMany({
    where: { id, userId },
    data: { title: normalizeCoverLetterTitle(title) },
  });
  if (count === 0) return null;
  return toSummary(
    await prisma.coverLetter.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT }),
  );
}

export async function duplicateCoverLetter(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<CoverLetterSummaryRecord | null> {
  const prisma = await db(client);
  const row = await prisma.coverLetter.findFirst({
    where: { id, userId },
    select: {
      title: true,
      content: true,
      schemaVersion: true,
      resumeId: true,
      jobTargetId: true,
    },
  });
  if (!row) return null;

  const created = await prisma.coverLetter.create({
    data: {
      userId,
      title: normalizeCoverLetterTitle(`${row.title} (copy)`),
      content: row.content,
      schemaVersion: row.schemaVersion,
      resumeId: row.resumeId,
      jobTargetId: row.jobTargetId,
    },
    select: SUMMARY_SELECT,
  });
  return toSummary(created);
}

/** Hard delete, per M2-T4's rule for everything else. No trash, no undo. */
export async function deleteCoverLetter(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<boolean> {
  const prisma = await db(client);
  const { count } = await prisma.coverLetter.deleteMany({ where: { id, userId } });
  return count > 0;
}
