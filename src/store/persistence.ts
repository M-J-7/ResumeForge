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

import { del, get, set } from "idb-keyval";

export const STORAGE_KEY = "resume-draft";

/** Debounce window for autosave, per M0-T7. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

export interface KeyValueBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export const idbBackend: KeyValueBackend = {
  get: (key) => get<string>(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
};

export function createMemoryBackend(initial?: Record<string, string>): KeyValueBackend {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get: async (key) => store.get(key),
    set: async (key, value) => void store.set(key, value),
    del: async (key) => void store.delete(key),
  };
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
  { debounceMs = AUTOSAVE_DEBOUNCE_MS, key = STORAGE_KEY } = {},
): DraftStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queued: PersistedDraft | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const write = async (draft: PersistedDraft): Promise<void> => {
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
