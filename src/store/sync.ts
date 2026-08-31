/**
 * Pushing the open resume to the account (M2-T4).
 *
 * ## Local storage stays the source of truth
 *
 * The builder writes to IndexedDB first and always, exactly as it did before
 * accounts existed. This queue is a second, slower write that follows. That
 * ordering is what M2-T4 means by "local stays the write-through cache":
 * with the server unreachable — offline, signed out, down — nothing about
 * editing changes, and no edit is lost waiting for a network call.
 *
 * ## The newest document wins, even when responses arrive out of order
 *
 * Every queued document gets a revision number. A push that resolves after a
 * newer one has already been queued does not mark the resume as saved,
 * because it did not save what is now on screen. Without that check a slow
 * request completing late reports "saved" over unsent edits, and the user
 * closes the tab believing them safe.
 *
 * ## Failure is a normal state, not an error state
 *
 * A phone on a train is offline several times a minute. Failures retry with
 * a backoff that levels off rather than giving up, and the `online` event
 * short-circuits the wait. The status the user sees says where their work
 * is — "saved on this device" — rather than that something went wrong,
 * because nothing has.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

export type SyncStatus =
  /** No account resume is open; the draft is local-only. */
  | "idle"
  /** Local edits are waiting to go out. */
  | "pending"
  /** A push is in flight. */
  | "saving"
  /** Everything on screen is on the server. */
  | "synced"
  /** The last attempt did not land. Work is safe locally; we keep trying. */
  | "offline";

export interface SyncTarget {
  /** Resolves when the server has the document; rejects otherwise. */
  push(resumeId: string, document: ResumeDocument): Promise<void>;
}

/** Debounce before a push. Longer than the local autosave, which must not wait. */
export const SYNC_DEBOUNCE_MS = 2_000;

/**
 * Backoff between retries, in milliseconds, levelling off at the last entry.
 * Capped rather than unbounded: a tab left open overnight on a flaky
 * connection should still be retrying in the morning.
 */
export const RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 30_000] as const;

export interface RemoteSyncOptions {
  debounceMs?: number;
  retryDelaysMs?: readonly number[];
  /** Defaults to `navigator.onLine`, and to `true` where there is no navigator. */
  isOnline?: () => boolean;
  onStatusChange?: (status: SyncStatus) => void;
  /** Called after a push lands, so the caller can record what is durable. */
  onSynced?: (revision: number) => void;
}

export interface RemoteSync {
  /** Points the queue at an account resume, or at nothing. */
  setResumeId(id: string | null): void;
  resumeId(): string | null;
  /** Records a document to send. Coalesces with anything already waiting. */
  queue(document: ResumeDocument): void;
  /** Sends whatever is waiting now, and resolves when it has landed or failed. */
  flush(): Promise<void>;
  /** Retries immediately — what the `online` event calls. */
  retryNow(): void;
  status(): SyncStatus;
  /** Cancels timers and stops listening. */
  dispose(): void;
}

function defaultIsOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function createRemoteSync(target: SyncTarget, options: RemoteSyncOptions = {}): RemoteSync {
  const {
    debounceMs = SYNC_DEBOUNCE_MS,
    retryDelaysMs = RETRY_DELAYS_MS,
    isOnline = defaultIsOnline,
    onStatusChange,
    onSynced,
  } = options;

  let resumeId: string | null = null;
  let pending: ResumeDocument | null = null;
  let pendingRevision = 0;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let status: SyncStatus = "idle";

  const setStatus = (next: SyncStatus) => {
    if (status === next) return;
    status = next;
    onStatusChange?.(next);
  };

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delay: number) => {
    cancelTimer();
    timer = setTimeout(() => {
      timer = null;
      void send();
    }, delay);
  };

  const retryDelay = () => retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)] ?? 30_000;

  async function send(): Promise<void> {
    if (!resumeId || pending === null) return;

    if (!isOnline()) {
      setStatus("offline");
      // No timer: the `online` listener calls `retryNow`. Polling a radio
      // that is switched off costs battery and learns nothing.
      return;
    }

    // Claim the document being sent, but leave `pending` in place until the
    // push succeeds — a failure must not lose the only copy of the edit.
    const document = pending;
    const revision = pendingRevision;
    setStatus("saving");

    const work = target
      .push(resumeId, document)
      .then(() => {
        attempt = 0;
        onSynced?.(revision);
        if (pendingRevision === revision) {
          pending = null;
          setStatus("synced");
        } else {
          // Something was typed while this was in flight. It is not saved,
          // whatever this response says.
          setStatus("pending");
          schedule(debounceMs);
        }
      })
      .catch(() => {
        setStatus("offline");
        // Delay chosen before the counter moves, so the first retry uses the
        // first entry in the table rather than skipping it.
        const delay = retryDelay();
        attempt += 1;
        schedule(delay);
      })
      .finally(() => {
        inFlight = null;
      });

    inFlight = work;
    return work;
  }

  return {
    setResumeId(id) {
      if (id === resumeId) return;
      resumeId = id;
      cancelTimer();
      pending = null;
      attempt = 0;
      setStatus(id ? "synced" : "idle");
    },

    resumeId: () => resumeId,

    queue(document) {
      if (!resumeId) return;
      pending = document;
      pendingRevision += 1;
      setStatus("pending");
      schedule(debounceMs);
    },

    async flush() {
      cancelTimer();
      await send();
      await inFlight;
    },

    retryNow() {
      if (!resumeId || pending === null) return;
      attempt = 0;
      schedule(0);
    },

    status: () => status,

    dispose() {
      cancelTimer();
      pending = null;
      setStatus("idle");
    },
  };
}
