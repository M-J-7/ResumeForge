/**
 * Where a pasted job description is kept (P27-H1).
 *
 * Two implementations of one interface:
 *
 *   - **Guests** — IndexedDB and nothing else, per D6. A guest's postings
 *     never reach the server, so there is no anonymous row holding text
 *     someone pasted from an employer, and nothing to erase on request
 *     because nothing was ever written.
 *   - **Signed in** — the `JobTarget` table, through Server Actions.
 *
 * The Match tab consumes `JobTargetStore` and never branches on which one it
 * has. That is the point of the seam: "does this leave the browser?" is
 * decided once, at construction, by the one component that knows whether
 * there is a session.
 *
 * The local half reuses `KeyValueBackend` from `./persistence.ts` rather than
 * calling `idb-keyval` directly, so tests drive it with the same memory
 * backend the draft store uses.
 */

import type { JobTargetDraft, JobTargetRecord } from "@/lib/match/job-target";
import { namespacedKey } from "./owner";
import { idbBackend, type KeyValueBackend } from "./persistence";

export type { JobTargetDraft, JobTargetRecord } from "@/lib/match/job-target";

/** Base key; namespaced per owner at every call site (`./owner.ts`). */
export const JOB_TARGETS_KEY = "job-targets";

/**
 * A guest's local list is capped.
 *
 * IndexedDB is not free, and the local list has no dashboard to prune it
 * from. Twenty postings is far more than anyone compares one resume
 * against; past that the oldest falls off, which is a better failure than a
 * quota error on the write that mattered.
 */
export const MAX_LOCAL_JOB_TARGETS = 20;

export interface JobTargetStore {
  list(): Promise<JobTargetRecord[]>;
  create(input: JobTargetDraft): Promise<JobTargetRecord>;
  save(id: string, input: JobTargetDraft): Promise<JobTargetRecord | null>;
  remove(id: string): Promise<boolean>;
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Parses whatever is in storage into records, discarding anything malformed.
 *
 * Permissive on purpose. This is not a resume — losing one saved posting to
 * a shape change is an inconvenience, and refusing to open the match view
 * because one stored record has a missing field is not.
 */
function parseRecords(raw: string | undefined): JobTargetRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is JobTargetRecord => {
      if (typeof item !== "object" || item === null) return false;
      const record = item as Partial<JobTargetRecord>;
      return typeof record.id === "string" && typeof record.description === "string";
    });
  } catch {
    return [];
  }
}

export function createLocalJobTargetStore(
  backend: KeyValueBackend = idbBackend,
  {
    key = namespacedKey(JOB_TARGETS_KEY),
    now = () => new Date(),
  }: { key?: string; now?: () => Date } = {},
): JobTargetStore {
  const read = async (): Promise<JobTargetRecord[]> => parseRecords(await backend.get(key));

  const write = async (records: JobTargetRecord[]): Promise<void> => {
    const sorted = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await backend.set(key, JSON.stringify(sorted.slice(0, MAX_LOCAL_JOB_TARGETS)));
  };

  return {
    list: read,

    async create(input) {
      const record: JobTargetRecord = {
        id: crypto.randomUUID(),
        title: input.title,
        company: nullable(input.company),
        roleTitle: nullable(input.roleTitle),
        description: input.description,
        updatedAt: now().toISOString(),
      };
      await write([record, ...(await read())]);
      return record;
    },

    async save(id, input) {
      const records = await read();
      const existing = records.find((r) => r.id === id);
      if (!existing) return null;

      const updated: JobTargetRecord = {
        ...existing,
        title: input.title,
        company: nullable(input.company),
        roleTitle: nullable(input.roleTitle),
        description: input.description,
        updatedAt: now().toISOString(),
      };
      await write(records.map((r) => (r.id === id ? updated : r)));
      return updated;
    },

    async remove(id) {
      const records = await read();
      if (!records.some((r) => r.id === id)) return false;
      await write(records.filter((r) => r.id !== id));
      return true;
    },
  };
}
