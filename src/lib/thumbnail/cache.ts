/**
 * A small, disposable cache for dashboard resume thumbnails (P22-E4).
 *
 * ## Why this exists at all
 *
 * A thumbnail is a rendered PDF's first page, rasterized to an image. Doing
 * that fresh for every card on every dashboard visit would mean loading react
 * -pdf's Yoga WASM module and running full layout for resumes nobody is
 * editing right now — exactly the cost D2 and §9 exist to avoid paying
 * needlessly. Caching the result keyed by `resumeId:updatedAt` means a
 * thumbnail is regenerated only when the resume actually changed, and never
 * again after that.
 *
 * ## Its own IndexedDB store, not the draft store
 *
 * `src/store/persistence.ts` owns one fixed key, `"resume-draft"`, for the
 * guest's local document. Thumbnails are a different kind of data — several
 * of them, evictable, non-authoritative — and giving them their own
 * `idb-keyval` store keeps a full cache clear from ever touching the one
 * piece of local storage that must never be dropped by accident.
 *
 * ## Never sent anywhere
 *
 * The image never leaves the browser. It is built from a signed-in user's own
 * resume content, which they already own the rendering of; nothing here talks
 * to the network beyond the existing server action that supplies the content
 * to render in the first place.
 */

import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";
import { GUEST_OWNER, ownerOf, scopedKey } from "@/store/owner";

let store: UseStore | null = null;

function thumbnailStore(): UseStore {
  store ??= createStore("resume-thumbnails", "thumbnails");
  return store;
}

/**
 * Base key for a *resume* thumbnail, namespaced per owner (§10.1).
 *
 * A thumbnail is a picture of somebody's resume — their name, their
 * employers, their dates, rendered and sitting in IndexedDB. It is exactly
 * the kind of thing that must not survive on a shared computer after they
 * sign out, so it carries an owner like every other local slot and
 * `purgeForeignThumbnails` clears the rest.
 *
 * Template thumbnails deliberately do not use this. They are renders of the
 * committed sample resume in `src/lib/resume/sample.ts` — the same picture
 * for every visitor, personal to nobody — so they keep their own
 * `template:` prefix, stay shared across identities, and survive the purge
 * rather than being re-rasterized through Yoga on every sign-in.
 */
export const RESUME_THUMBNAIL_BASE = "resume-thumbnail";

/** The cache key. Changing `updatedAt` is what invalidates a stale thumbnail. */
export function thumbnailKey(resumeId: string, updatedAt: string): string {
  return scopedKey(RESUME_THUMBNAIL_BASE, `${resumeId}:${updatedAt}`);
}

/**
 * Drops every resume thumbnail belonging to somebody other than `owner`.
 *
 * Called by `purgeForeignStorage`. Best-effort in the same way every other
 * read here is: a cache that cannot be enumerated is not a reason to fail
 * the page, and the namespaced key already stops the *app* from showing one
 * account's thumbnail to another.
 */
export async function purgeForeignThumbnails(owner: string): Promise<string[]> {
  try {
    const store = thumbnailStore();
    const held = await keys(store);
    const foreign = held.filter((key): key is string => {
      if (typeof key !== "string") return false;
      const slotOwner = ownerOf(RESUME_THUMBNAIL_BASE, key);
      return slotOwner !== null && slotOwner !== owner && slotOwner !== GUEST_OWNER;
    });
    for (const key of foreign) await del(key, store);
    return foreign;
  } catch {
    return [];
  }
}

export async function readCachedThumbnail(key: string): Promise<string | undefined> {
  try {
    return await get<string>(key, thumbnailStore());
  } catch {
    // A cache read failing (private browsing, storage pressure) is not a
    // reason to fail the thumbnail — it just means rendering it fresh.
    return undefined;
  }
}

export async function writeCachedThumbnail(key: string, dataUrl: string): Promise<void> {
  try {
    await set(key, dataUrl, thumbnailStore());
  } catch {
    // Best-effort. The thumbnail still rendered for this view; it simply
    // will not be cached for the next one.
  }
}
