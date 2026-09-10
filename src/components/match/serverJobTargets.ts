"use client";

/**
 * The signed-in half of `JobTargetStore` (P27-H1).
 *
 * Kept in its own module, imported dynamically by `MatchPanel`, for the same
 * reason `builder/serverSync.ts` is: importing a Server Action pulls the
 * whole `next-auth` tree behind it, and a guest — who by D6 will never write
 * a job target to a server — has no use for any of it.
 *
 * `list()` returns records with an empty `description`, because
 * `listJobTargetsAction` does not select the column. Callers ask for
 * `load()` when a saved posting is actually opened. That asymmetry is why
 * `load` exists on `RemoteJobTargetStore` rather than being folded into
 * `list` — the interface itself lives in `./jobTargetStore.ts`, which this
 * module's server imports must not be reachable from.
 */

import {
  createJobTargetAction,
  deleteJobTargetAction,
  listJobTargetsAction,
  loadJobTargetAction,
  saveJobTargetAction,
} from "@/app/match/actions";
import type { RemoteJobTargetStore } from "./jobTargetStore";

export function createServerJobTargetStore(): RemoteJobTargetStore {
  return {
    async list() {
      const result = await listJobTargetsAction();
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },

    async load(id) {
      const result = await loadJobTargetAction(id);
      return result.ok ? result.value : null;
    },

    async create(input) {
      const result = await createJobTargetAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },

    async save(id, input) {
      const result = await saveJobTargetAction(id, input);
      return result.ok ? result.value : null;
    },

    async remove(id) {
      const result = await deleteJobTargetAction(id);
      return result.ok;
    },
  };
}
