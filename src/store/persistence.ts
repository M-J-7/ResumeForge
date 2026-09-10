/**
 * Local persistence for the builder (M0-T7).
 *
 * Per D6, guest drafts live in IndexedDB and nowhere else — no anonymous
 * rows on a server, so no anonymous PII, no garbage-collection policy, and
 * no GDPR erasure obligation to a person we cannot identify. The builder
 * also keeps working with the server down.
 *
 * IndexedDB rather than localStorage for two reasons that both matter here:
 * localStorage caps out around 5MB and, more importantly, it is synchronous,
 * so every autosave would block the main thread mid-keystroke.
 *
 * The key-value backend is injected rather than imported directly, matching
 * the `FontSourceResolver` seam in `lib/fonts/register.ts`. Tests drive a
 * memory backend; the browser gets `idb-keyval`.
 */

import { del, get, keys, set } from "idb-keyval";
import { namespacedKey } from "./owner";

/**
 * The *base* key for a draft. Never used on its own — every call site goes
 * through `namespacedKey(STORAGE_KEY, owner)` so a slot belongs to exactly
 * one identity. See `./owner.ts` for the failure that made that necessary.
 */
export const STORAGE_KEY = "resume-draft";

/** Debounce window for autosave, per M0-T7. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface KeyValueBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  /**
   * Every key currently held.
   *
   * Here rather than in the one component that needs it, because purging
   * another account's slots (`./purge.ts`) has to enumerate storage, and
   * reaching past this seam into `idb-keyval` from a component would mean
   * the memory backend the tests drive could not answer the same question.
   */
  keys(): Promise<string[]>;
}

export const idbBackend: KeyValueBackend = {
  get: (key) => get<string>(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
  // `idb-keyval` types keys as `IDBValidKey`; ours are all strings, and a
  // non-string one would belong to something else entirely, so it is
  // dropped rather than coerced into a key we might then delete.
  keys: async () => (await keys()).filter((key): key is string => typeof key === "string"),
};

export function createMemoryBackend(initial?: Record<string, string>): KeyValueBackend {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get: async (key) => store.get(key),
    set: async (key, value) => void store.set(key, value),
    del: async (key) => void store.delete(key),
    keys: async () => [...store.keys()],
  };
}

/**
 * Asks the browser to exempt this origin from storage eviction.
 *
 * D6 puts a guest's only copy of their resume in IndexedDB, which is
 * *best-effort* storage by default: Safari's ITP clears it after seven days
 * without interaction, and every browser evicts it under storage pressure.
 * For a product whose landing page promises the work stays in your browser,
 * a draft that silently vanished is the worst outcome available — worse than
 * never having offered to keep it, because the user stopped keeping their own
 * copy on the strength of the promise.
 *
 * Best-effort by design, and the caller must treat it that way:
 *
 *   - Unsupported in some browsers, so the API itself may be absent.
 *   - Granted silently in Chrome when the site scores well on its heuristics,
 *     denied silently when it does not; there is no prompt to wait for.
 *   - Firefox prompts, so this can resolve long after it was called.
 *
 * A `false` result is therefore not an error and not worth surfacing on its
 * own. What it argues for is making the existing download path easy to reach,
 * which the export controls already do.
 *
 * Never rejects. A storage API that throws must not be able to fail a save.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined") return false;
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return false;
    // Asking again once granted costs a round trip and can re-prompt in
    // browsers that prompt, so check first.
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

export interface PersistedDraft {
  /** The raw document, migrated on read rather than on write (D10). */
  document: unknown;
  savedAt: number;
  /**
   * The account resume this draft mirrors, when there is one (M2-T4). Null
   * or absent means a guest draft, which is still the default path.
   */
  remoteId?: string | null;
  /**
   * True while this browser holds edits the server has not confirmed.
   *
   * A flag rather than a timestamp comparison. Deciding "is local newer than
   * the server copy?" by comparing a browser clock to a server clock is
   * wrong whenever they disagree, and they disagree often enough that a
   * user with a fast clock would silently overwrite good server state. The
   * flag is set and cleared by the same device that owns both events.
   */
  pendingSync?: boolean;
}

export interface DraftStoreOptions {
  debounceMs?: number;
  key?: string;
  /** Injected the same way the backend is, so a test can observe the call. */
  requestPersistence?: () => Promise<boolean>;
}

export interface DraftStore {
  read(): Promise<PersistedDraft | null>;
  /** Queues a write, coalescing rapid calls into one. */
  save(draft: PersistedDraft): void;
  /** Writes any queued draft immediately. Safe to call when nothing is pending. */
  flush(): Promise<void>;
  /** Removes the draft outright — the "clear all data" control. */
  clear(): Promise<void>;
  /** True while a write is queued but not yet committed. */
  isPending(): boolean;
}

/**
 * Wraps a backend with debounced writes.
 *
 * Autosave fires on a 500ms debounce so a burst of keystrokes costs one
 * write rather than forty. That leaves a window where the newest edit is
 * only in memory, which is why `flush` exists and why the builder calls it
 * on blur and `visibilitychange` — the two moments a tab is most likely to
 * be closed or backgrounded before the timer fires.
 */
export function createDraftStore(
  backend: KeyValueBackend,
  {
    debounceMs = AUTOSAVE_DEBOUNCE_MS,
    // Resolved per call, not per module load: the owner is published after
    // this module is imported, and a default captured at import time would
    // pin every draft store to `guest` for the life of the tab.
    key = namespacedKey(STORAGE_KEY),
    requestPersistence = requestPersistentStorage,
  }: DraftStoreOptions = {},
): DraftStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queued: PersistedDraft | null = null;
  let inFlight: Promise<void> = Promise.resolve();
  let persistenceRequested = false;

  const write = async (draft: PersistedDraft): Promise<void> => {
    // On the first write only, and deliberately not awaited.
    //
    // The first save is the moment there is finally something worth keeping,
    // which is also the moment Chrome's heuristics are most likely to grant
    // it. Awaiting would be wrong twice over: Firefox shows a permission
    // prompt, so this can take as long as the user takes to read it, and the
    // draft would sit unsaved in memory the whole time. The request has no
    // bearing on whether this write succeeds.
    if (!persistenceRequested) {
      persistenceRequested = true;
      void requestPersistence().catch(() => false);
    }

    // Serialize writes so a flush racing the timer cannot interleave and
    // leave the older payload as the last one committed.
    inFlight = inFlight.then(() => backend.set(key, JSON.stringify(draft)));
    return inFlight;
  };

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    async read() {
      const raw = await backend.get(key);
      if (raw === undefined) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || !("document" in parsed)) return null;
        return parsed as PersistedDraft;
      } catch {
        // Corrupt storage must not brick the builder; a fresh document is a
        // better outcome than an unrecoverable error screen.
        return null;
      }
    },

    save(draft) {
      queued = draft;
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        const pending = queued;
        queued = null;
        if (pending) void write(pending);
      }, debounceMs);
    },

    async flush() {
      cancelTimer();
      const pending = queued;
      queued = null;
      if (pending) await write(pending);
      // Await whatever the timer may already have started, so callers can
      // treat a resolved flush as "everything is durable".
      await inFlight;
    },

    async clear() {
      cancelTimer();
      queued = null;
      inFlight = inFlight.then(() => backend.del(key));
      await inFlight;
    },

    isPending() {
      return queued !== null;
    },
  };
}
