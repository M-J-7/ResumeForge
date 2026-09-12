"use client";

/**
 * The store interface the Match tab and the letter editor both consume.
 *
 * Separate from `./serverJobTargets.ts` for a concrete reason, not tidiness:
 * that module imports Server Actions, and importing a Server Action pulls the
 * whole `next-auth` tree in with it — which a guest never needs and which the
 * jsdom component tests cannot resolve at all (`next-auth/lib/env.js` reaches
 * for `next/server` in a way Vite's resolver rejects). `BuilderShell.test.tsx`
 * renders `PreviewPane` → `MatchPanel`, so anything `MatchPanel` imports
 * statically is in that test's module graph.
 *
 * So the type and the local adapter live here, where nothing server-side can
 * follow them, and the server factory stays behind a dynamic `import()`.
 */

import type { JobTargetRecord } from "@/lib/match/job-target";
import type { JobTargetStore } from "@/store/job-targets";

/** Adds the one operation the local store gets for free by holding everything. */
export interface RemoteJobTargetStore extends JobTargetStore {
  load(id: string): Promise<JobTargetRecord | null>;
}

/** Local records are already complete, so `load` is a lookup in the list. */
export function withLocalLoad(store: JobTargetStore): RemoteJobTargetStore {
  return {
    ...store,
    async load(id) {
      return (await store.list()).find((record) => record.id === id) ?? null;
    },
  };
}
