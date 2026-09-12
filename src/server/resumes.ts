/**
 * Server-side resume storage (M2-T3, M2-T4).
 *
 * ## Ownership is an argument, never an inference
 *
 * Every function here takes `userId` first and every query filters on it,
 * including the writes. `updateMany({ where: { id, userId } })` rather than
 * `update({ where: { id } })` is the whole point: the wrong owner updates
 * zero rows and the caller sees "not found", instead of the row being found,
 * modified, and only then checked. There is no code path that loads a resume
 * by id alone, so there is no code path an authorization check can be
 * forgotten on.
 *
 * ## The content column, and what is kept beside it
 *
 * `content` is a serialized `ResumeDocument`. On SQLite that is TEXT: not
 * queryable, not indexable, and not sortable. Anything the dashboard sorts
 * or displays without opening the document — `wordCount`, `pageCount`,
 * `lastScore`, `pageSize`, `schemaVersion` — is therefore denormalized into
 * a real column at write time (M2-T1).
 *
 * ## Reads go through the migration chain (D10)
 *
 * A document written by an older build must never reach the UI unmigrated,
 * and the server is not exempt from that. `loadResume` runs `safeMigrate`
 * for the same reason the browser store does.
 *
 * ## better-sqlite3 is synchronous
 *
 * Every query below blocks the event loop for the whole process. They are
 * all point lookups or index scans on `[userId, updatedAt]`; keep it that
 * way. `listResumes` deliberately does not select `content` — pulling every
 * document's full text to render a list of titles would scale the dashboard
 * with the size of the resumes on it.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/server/db";
import { documentWordCount } from "@/lib/lint/rules";
import { safeMigrate } from "@/lib/resume/migrate";
import { CURRENT_SCHEMA_VERSION, type ResumeDocument } from "@/lib/resume/schema";

/** What the dashboard lists, without opening a single document. */
export interface ResumeSummary {
  id: string;
  title: string;
  pageSize: string;
  schemaVersion: number;
  wordCount: number | null;
  pageCount: number | null;
  lastScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadedResume {
  summary: ResumeSummary;
  document: ResumeDocument;
}

const SUMMARY_SELECT = {
  id: true,
  title: true,
  pageSize: true,
  schemaVersion: true,
  wordCount: true,
  pageCount: true,
  lastScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Longest title the dashboard will store. Matches the builder's own ceiling. */
export const MAX_TITLE_LENGTH = 120;

export const DEFAULT_RESUME_TITLE = "Untitled resume";

/**
 * Names a resume from its own content.
 *
 * The most recent job title first, because someone with several resumes
 * almost always has them tailored per role — "Untitled resume (2)" tells
 * them nothing about which is which. Their own name is the fallback, and a
 * placeholder only when the document is genuinely empty.
 */
export function deriveResumeTitle(document: ResumeDocument): string {
  for (const section of document.sections) {
    if (section.type !== "experience") continue;
    for (const entry of section.entries) {
      const title = entry.title.trim();
      if (title) return title.slice(0, MAX_TITLE_LENGTH);
    }
  }
  const name = document.contact.fullName.trim();
  if (name) return `${name.slice(0, MAX_TITLE_LENGTH - 8)} resume`;
  return DEFAULT_RESUME_TITLE;
}

/** Trims and caps a user-supplied title, falling back rather than rejecting. */
export function normalizeTitle(title: string): string {
  return title.trim().slice(0, MAX_TITLE_LENGTH) || DEFAULT_RESUME_TITLE;
}

/**
 * Everything derivable from the document, ready to be written to columns.
 *
 * `pageCount` is absent on purpose: it is a property of the *rendered* PDF
 * (D3 — measured from the artifact, never predicted), and the server does
 * not render. The builder reports it once the preview has measured it.
 */
function derivedColumns(document: ResumeDocument) {
  return {
    content: JSON.stringify(document),
    schemaVersion: document.schemaVersion,
    pageSize: document.settings.pageSize,
    wordCount: documentWordCount(document),
  };
}

async function db(client?: PrismaClient): Promise<PrismaClient> {
  return client ?? (await getPrisma());
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function listResumes(userId: string, client?: PrismaClient): Promise<ResumeSummary[]> {
  const prisma = await db(client);
  return prisma.resume.findMany({
    where: { userId },
    select: SUMMARY_SELECT,
    orderBy: { updatedAt: "desc" },
  });
}

export async function countResumes(userId: string, client?: PrismaClient): Promise<number> {
  const prisma = await db(client);
  return prisma.resume.count({ where: { userId } });
}

/**
 * Loads one resume, migrating the stored document on the way out.
 *
 * Returns `null` both when the row does not exist and when it belongs to
 * someone else — the caller cannot tell those apart, which is the point. A
 * document that fails to migrate throws rather than returning null, because
 * "your resume is gone" and "this build cannot read your resume" call for
 * very different responses.
 */
export async function loadResume(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<LoadedResume | null> {
  const prisma = await db(client);
  const row = await prisma.resume.findFirst({
    where: { id, userId },
    select: { ...SUMMARY_SELECT, content: true },
  });
  if (!row) return null;

  const { content, ...summary } = row;
  const parsed: unknown = JSON.parse(content);
  const result = safeMigrate(parsed);
  if (!result.ok) {
    throw new Error(`Stored resume ${id} could not be migrated: ${result.error.message}`);
  }
  return { summary, document: result.document };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateResumeInput {
  document: ResumeDocument;
  /** Defaults to `deriveResumeTitle`. */
  title?: string;
  pageCount?: number | null;
}

export async function createResume(
  userId: string,
  input: CreateResumeInput,
  client?: PrismaClient,
): Promise<ResumeSummary> {
  const prisma = await db(client);
  return prisma.resume.create({
    data: {
      userId,
      title: input.title ? normalizeTitle(input.title) : deriveResumeTitle(input.document),
      pageCount: input.pageCount ?? null,
      ...derivedColumns(input.document),
    },
    select: SUMMARY_SELECT,
  });
}

export interface SaveResumeInput {
  document: ResumeDocument;
  /** Measured from the rendered PDF by the client, when it has one. */
  pageCount?: number | null;
}

/**
 * Overwrites a resume's content. Returns `null` if the caller does not own it.
 *
 * `updateMany` rather than `update`: it filters on `userId` in the same
 * statement, so an attempt against someone else's row changes nothing and
 * reports zero, rather than throwing a not-found error after the row has
 * already been located by id.
 */
export async function saveResume(
  userId: string,
  id: string,
  input: SaveResumeInput,
  client?: PrismaClient,
): Promise<ResumeSummary | null> {
  const prisma = await db(client);
  const { count } = await prisma.resume.updateMany({
    where: { id, userId },
    data: {
      ...derivedColumns(input.document),
      ...(input.pageCount === undefined ? {} : { pageCount: input.pageCount }),
    },
  });
  if (count === 0) return null;
  return prisma.resume.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT });
}

export async function renameResume(
  userId: string,
  id: string,
  title: string,
  client?: PrismaClient,
): Promise<ResumeSummary | null> {
  const prisma = await db(client);
  const { count } = await prisma.resume.updateMany({
    where: { id, userId },
    data: { title: normalizeTitle(title) },
  });
  if (count === 0) return null;
  return prisma.resume.findUniqueOrThrow({ where: { id }, select: SUMMARY_SELECT });
}

/**
 * Hard delete, per M2-T4 and M2-T6. Not a flag, not a tombstone.
 *
 * The cascades in the schema take the versions, score checks, and parse
 * checks with it — but only because `PRAGMA foreign_keys=ON` is applied on
 * every connection (`src/server/db.ts`). Without it this leaves the resume's
 * history behind after the user asked for it to be gone.
 */
export async function deleteResume(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<boolean> {
  const prisma = await db(client);
  const { count } = await prisma.resume.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Copies a resume, content and all. The copy is a new row with a new id. */
export async function duplicateResume(
  userId: string,
  id: string,
  client?: PrismaClient,
): Promise<ResumeSummary | null> {
  const prisma = await db(client);
  const row = await prisma.resume.findFirst({
    where: { id, userId },
    select: {
      title: true,
      content: true,
      schemaVersion: true,
      pageSize: true,
      wordCount: true,
      pageCount: true,
    },
  });
  if (!row) return null;

  return prisma.resume.create({
    data: {
      userId,
      title: normalizeTitle(`${row.title} (copy)`),
      content: row.content,
      schemaVersion: row.schemaVersion,
      pageSize: row.pageSize,
      wordCount: row.wordCount,
      pageCount: row.pageCount,
    },
    select: SUMMARY_SELECT,
  });
}

/* -------------------------------------------------------------------------- */
/* Draft claiming (M2-T3)                                                      */
/* -------------------------------------------------------------------------- */

export type ClaimOutcome =
  | { status: "claimed"; resume: ResumeSummary; hadExisting: boolean }
  | { status: "invalid"; reason: string };

/**
 * Moves a guest draft from the browser onto the account.
 *
 * **Always creates a new resume, never overwrites one.** M2-T3 names the
 * conflict case explicitly, and the asymmetry is the reason: a spurious
 * extra resume costs one click to delete, while an overwrite destroys work
 * that has no other copy. The caller only clears local storage after this
 * returns `claimed`, so an abandoned or failed claim leaves the draft
 * exactly where it was.
 *
 * The document arrives as unknown — it comes from IndexedDB, which may have
 * been written by an older build — so it goes through the migration chain
 * before anything is stored.
 */
export async function claimDraft(
  userId: string,
  rawDocument: unknown,
  client?: PrismaClient,
): Promise<ClaimOutcome> {
  const result = safeMigrate(rawDocument);
  if (!result.ok) return { status: "invalid", reason: result.error.message };

  const prisma = await db(client);
  const hadExisting = (await countResumes(userId, prisma)) > 0;
  const resume = await createResume(userId, { document: result.document }, prisma);
  return { status: "claimed", resume, hadExisting };
}

/** The version this build writes. Exported so tests can assert the columns agree. */
export const WRITTEN_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;
