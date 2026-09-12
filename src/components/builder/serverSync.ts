"use client";

/**
 * The concrete push the sync queue performs (M2-T4).
 *
 * Kept apart from `store/sync.ts` so the queue — the part with the tricky
 * ordering and retry logic — stays a pure module with no server action, no
 * `next/*` import, and nothing to stub in a unit test.
 *
 * A rejected promise is how failure is reported: the queue treats any
 * rejection as "not landed, try again later", which is the correct response
 * to a network failure and to a server that said no alike. Turning a
 * `{ ok: false }` result into a resolved promise would have the queue mark
 * unsaved work as saved.
 */

import { saveResumeAction } from "@/app/builder/actions";
import { useResumeStore } from "@/store/resume";
import type { SyncTarget } from "@/store/sync";

export function createServerSyncTarget(): SyncTarget {
  return {
    async push(resumeId, document) {
      const result = await saveResumeAction(
        resumeId,
        JSON.stringify(document),
        // Read at push time rather than captured: the preview may have
        // measured a new page count since this document was queued.
        useResumeStore.getState().measuredPageCount,
      );
      if (!result.ok) throw new Error(result.error);
    },
  };
}
