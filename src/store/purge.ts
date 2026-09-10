/**
 * Taking the previous person's work off this device (§10.1).
 *
 * `./owner.ts` makes every slot belong to one identity. That stops B from
 * *reading* A's resume through the app, but it leaves A's resume sitting in
 * IndexedDB on a shared computer, one developer-tools panel away. This is the
 * other half: when the browser is acting as somebody, every slot belonging to
 * anybody else is deleted.
 *
 * ## What survives, and why
 *
 *   - **The current owner's slots.** Obviously.
 *   - **`guest`.** Deliberately, and this is the one judgement call in the
 *     file. It is what "Save it to my account" reads on the dashboard, so
 *     wiping it at sign-in would destroy the exact work the claim flow exists
 *     to rescue — build as a guest, sign in, adopt the draft. A guest slot is
 *     also not anyone's in particular; it is what this browser was doing
 *     before anybody identified themselves.
 *   - **Keys this app does not own.** Anything without one of our base
 *     prefixes is left alone. The default `keyval-store` is shared, and a
 *     purge that deleted by exclusion would eventually delete somebody's
 *     unrelated data.
 *
 * ## Unconditional, rather than on a recorded identity change
 *
 * The plan for this fix proposed recording the last owner seen on the device
 * and purging only when a different one appeared. This does the same job with
 * one fewer piece of state to keep true: enumerating and deleting foreign
 * slots is idempotent — after the first pass there is nothing foreign left,
 * so every later pass is one `keys()` call and no writes. A recorded marker
 * has a failure mode this does not: if the write of the marker fails, or it
 * is cleared while the slots are not, the foreign data survives indefinitely.
 *
 * ## Legacy slots
 *
 * Keys written before namespacing existed (`resume-draft` with no owner) are
 * adopted into the guest slot when it is empty, and deleted when it is not.
 * That is what keeps D6's promise — the work stays in your browser — across
 * the release that introduced the namespace, without leaving an unowned key
 * that no purge can reason about.
 */

import { COVER_LETTERS_KEY } from "./cover-letters";
import { JOB_TARGETS_KEY } from "./job-targets";
import { GUEST_OWNER, namespacedKey, ownerOf } from "./owner";
import { idbBackend, STORAGE_KEY, type KeyValueBackend } from "./persistence";
import { EXPERIENCE_LEVEL_STORAGE_KEY } from "@/lib/resume/experience-level";
import { purgeForeignThumbnails } from "@/lib/thumbnail/cache";

/**
 * Every base key this app namespaces inside the default `keyval-store`.
 *
 * Imported from the modules that own them rather than restated, so adding a
 * store and forgetting to purge it is a change in one place, not two.
 */
export const NAMESPACED_BASES: readonly string[] = [
  STORAGE_KEY,
  COVER_LETTERS_KEY,
  JOB_TARGETS_KEY,
];

/**
 * Whether the dashboard's "There is a resume saved in this browser" offer
 * has been declined, and for which draft.
 *
 * Declared here rather than in `ClaimDraftPrompt` for one dull reason: this
 * module lists every base that gets purged, and it must not import a React
 * component to learn one string.
 */
export const CLAIM_DRAFT_DISMISSED_KEY = "claim-draft-dismissed";

/** Base keys held in `localStorage` rather than IndexedDB. */
export const NAMESPACED_LOCAL_STORAGE_BASES: readonly string[] = [
  EXPERIENCE_LEVEL_STORAGE_KEY,
  CLAIM_DRAFT_DISMISSED_KEY,
];

/**
 * The keys in `held` that belong to somebody other than `owner`.
 *
 * Pure, and exported for the test: this is the whole security decision, and
 * it should be assertable without an IndexedDB.
 */
export function foreignSlots(
  held: readonly string[],
  owner: string,
  bases: readonly string[] = NAMESPACED_BASES,
): string[] {
  const foreign: string[] = [];
  for (const key of held) {
    for (const base of bases) {
      const slotOwner = ownerOf(base, key);
      if (slotOwner === null) continue;
      if (slotOwner !== owner && slotOwner !== GUEST_OWNER) foreign.push(key);
      break;
    }
  }
  return foreign;
}

/**
 * Moves an unnamespaced key into the guest slot, or drops it.
 *
 * Runs before the purge so the adopted value is in a slot the purge knows
 * how to keep.
 */
async function adoptLegacySlots(backend: KeyValueBackend, bases: readonly string[]): Promise<void> {
  for (const base of bases) {
    const legacy = await backend.get(base);
    if (legacy === undefined) continue;
    const guestSlot = namespacedKey(base, GUEST_OWNER);
    if ((await backend.get(guestSlot)) === undefined) await backend.set(guestSlot, legacy);
    await backend.del(base);
  }
}

/**
 * Deletes every foreign slot in the key-value store. Returns what it removed,
 * which is what the test asserts on.
 *
 * Never throws. Storage that is unavailable — private browsing, a quota
 * error, a browser with IndexedDB disabled — must not be able to fail the
 * page it was called from; the app still works, it simply has nothing local
 * to read, which is the same position a first-time visitor is in.
 */
export async function purgeForeignSlots(
  owner: string,
  backend: KeyValueBackend = idbBackend,
  bases: readonly string[] = NAMESPACED_BASES,
): Promise<string[]> {
  try {
    await adoptLegacySlots(backend, bases);
    const removed = foreignSlots(await backend.keys(), owner, bases);
    for (const key of removed) await backend.del(key);
    return removed;
  } catch {
    return [];
  }
}

/** The `localStorage` half. Same rule, same exclusions. */
export function purgeForeignLocalStorage(
  owner: string,
  bases: readonly string[] = NAMESPACED_LOCAL_STORAGE_BASES,
): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const held: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key !== null) held.push(key);
    }
    // Legacy unnamespaced values are dropped rather than adopted: the only
    // one is the experience band, which is a preference the user re-answers
    // in one click, not work of theirs that would be lost.
    for (const base of bases) localStorage.removeItem(base);

    const removed = foreignSlots(held, owner, bases);
    for (const key of removed) localStorage.removeItem(key);
    return removed;
  } catch {
    return [];
  }
}

/**
 * Everything above, for the one caller that should be doing this:
 * `<StorageOwner>`, which knows who the browser is acting as.
 */
export async function purgeForeignStorage(owner: string): Promise<void> {
  purgeForeignLocalStorage(owner);
  await Promise.all([purgeForeignSlots(owner), purgeForeignThumbnails(owner)]);
}
