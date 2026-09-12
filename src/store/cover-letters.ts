/**
 * The guest half of cover letter storage (P29-J1, D6).
 *
 * Same seam as `./job-targets.ts`, same reasoning: a guest's letters live in
 * IndexedDB and never reach the server, so there is no anonymous row holding
 * someone's application text and nothing to erase on request. P29's
 * acceptance names this explicitly — *a guest can compose and download a
 * letter with no account and nothing hits the server.*
 *
 * The whole list lives under one key. Letters are a few kilobytes each and
 * capped, so reading them all to render a grid costs one `get`; the
 * alternative, a key per letter plus an index key, buys nothing and adds a
 * consistency problem between the index and the records.
 */

import type {
  CoverLetterDraft,
  CoverLetterRecord,
  CoverLetterSummaryRecord,
} from "@/lib/cover-letter/record";
import { namespacedKey } from "./owner";
import { idbBackend, type KeyValueBackend } from "./persistence";

export type {
  CoverLetterDraft,
  CoverLetterRecord,
  CoverLetterSummaryRecord,
} from "@/lib/cover-letter/record";

/** Base key; namespaced per owner at every call site (`./owner.ts`). */
export const COVER_LETTERS_KEY = "cover-letters";

/** Same reasoning as `MAX_LOCAL_JOB_TARGETS`: bounded, oldest first out. */
export const MAX_LOCAL_COVER_LETTERS = 20;

export interface CoverLetterStore {
  list(): Promise<CoverLetterSummaryRecord[]>;
  load(id: string): Promise<CoverLetterRecord | null>;
  create(input: CoverLetterDraft): Promise<CoverLetterRecord>;
  save(id: string, input: CoverLetterDraft): Promise<CoverLetterRecord | null>;
  rename(id: string, title: string): Promise<CoverLetterSummaryRecord | null>;
  duplicate(id: string): Promise<CoverLetterSummaryRecord | null>;
  remove(id: string): Promise<boolean>;
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseRecords(raw: string | undefined): CoverLetterRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CoverLetterRecord => {
      if (typeof item !== "object" || item === null) return false;
      const record = item as Partial<CoverLetterRecord>;
      return typeof record.id === "string" && typeof record.content === "string";
    });
  } catch {
    // Corrupt storage must not brick the letters page; an empty list is a
    // better outcome than an unrecoverable error screen.
    return [];
  }
}

function toSummary(record: CoverLetterRecord): CoverLetterSummaryRecord {
  return {
    id: record.id,
    title: record.title,
    resumeId: record.resumeId,
    resumeTitle: record.resumeTitle,
    jobTargetId: record.jobTargetId,
    company: record.company,
    roleTitle: record.roleTitle,
    updatedAt: record.updatedAt,
  };
}

export function createLocalCoverLetterStore(
  backend: KeyValueBackend = idbBackend,
  {
    key = namespacedKey(COVER_LETTERS_KEY),
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
  }: { key?: string; now?: () => Date; newId?: () => string } = {},
): CoverLetterStore {
  const read = async (): Promise<CoverLetterRecord[]> => parseRecords(await backend.get(key));

  const write = async (records: CoverLetterRecord[]): Promise<void> => {
    const sorted = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await backend.set(key, JSON.stringify(sorted.slice(0, MAX_LOCAL_COVER_LETTERS)));
  };

  const build = (input: CoverLetterDraft, id: string): CoverLetterRecord => ({
    id,
    title: input.title,
    content: input.content,
    resumeId: nullable(input.resumeId),
    // A guest has no server resumes to name, and the local draft has no
    // title of its own. Null rather than a placeholder, so the card shows
    // nothing rather than something untrue.
    resumeTitle: null,
    jobTargetId: nullable(input.jobTargetId),
    company: nullable(input.company),
    roleTitle: nullable(input.roleTitle),
    updatedAt: now().toISOString(),
  });

  return {
    async list() {
      return (await read()).map(toSummary);
    },

    async load(id) {
      return (await read()).find((record) => record.id === id) ?? null;
    },

    async create(input) {
      const record = build(input, newId());
      await write([record, ...(await read())]);
      return record;
    },

    async save(id, input) {
      const records = await read();
      if (!records.some((record) => record.id === id)) return null;
      const updated = build(input, id);
      await write(records.map((record) => (record.id === id ? updated : record)));
      return updated;
    },

    async rename(id, title) {
      const records = await read();
      const existing = records.find((record) => record.id === id);
      if (!existing) return null;
      const updated = { ...existing, title, updatedAt: now().toISOString() };
      await write(records.map((record) => (record.id === id ? updated : record)));
      return toSummary(updated);
    },

    async duplicate(id) {
      const records = await read();
      const existing = records.find((record) => record.id === id);
      if (!existing) return null;
      const copy: CoverLetterRecord = {
        ...existing,
        id: newId(),
        title: `${existing.title} (copy)`,
        updatedAt: now().toISOString(),
      };
      await write([copy, ...records]);
      return toSummary(copy);
    },

    async remove(id) {
      const records = await read();
      if (!records.some((record) => record.id === id)) return false;
      await write(records.filter((record) => record.id !== id));
      return true;
    },
  };
}
