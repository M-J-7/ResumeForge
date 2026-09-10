"use client";

/**
 * The signed-in half of `CoverLetterStore` (P29-J1).
 *
 * Its own module, imported dynamically, for the same reason
 * `match/serverJobTargets.ts` is: importing a Server Action pulls the whole
 * `next-auth` tree behind it, and a guest — who by D6 never writes a letter
 * to a server — has no use for any of it.
 */

import {
  createCoverLetterAction,
  deleteCoverLetterAction,
  duplicateCoverLetterAction,
  listCoverLettersAction,
  loadCoverLetterAction,
  renameCoverLetterAction,
  saveCoverLetterAction,
} from "@/app/letters/actions";
import type { CoverLetterStore } from "@/store/cover-letters";

export function createServerCoverLetterStore(): CoverLetterStore {
  return {
    async list() {
      const result = await listCoverLettersAction();
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },

    async load(id) {
      const result = await loadCoverLetterAction(id);
      return result.ok ? result.value : null;
    },

    async create(input) {
      const result = await createCoverLetterAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },

    async save(id, input) {
      const result = await saveCoverLetterAction(id, input);
      // A rejected save must never look like a successful one — the caller
      // clears its unsaved-changes flag on a non-null result.
      if (!result.ok) throw new Error(result.error);
      return result.value;
    },

    async rename(id, title) {
      const result = await renameCoverLetterAction(id, title);
      return result.ok ? result.value : null;
    },

    async duplicate(id) {
      const result = await duplicateCoverLetterAction(id);
      return result.ok ? result.value : null;
    },

    async remove(id) {
      const result = await deleteCoverLetterAction(id);
      return result.ok;
    },
  };
}
