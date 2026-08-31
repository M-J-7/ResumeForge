"use client";

/**
 * Where the open resume currently lives (M2-T4).
 *
 * The wording says where the work *is*, never that something failed. Being
 * offline is not an error — the edit is already durable in this browser, and
 * the queue keeps trying. A red "sync error" would tell a user on a train
 * that their work is at risk when it is not, and the reasonable reaction to
 * that is to stop typing.
 *
 * The guest case says the same thing the builder has always said, so signing
 * out does not look like something broke.
 */

import { useResumeStore } from "@/store/resume";
import type { SyncStatus as Status } from "@/store/sync";

const MESSAGES: Record<Status, string> = {
  idle: "Saved in this browser only. Nothing is uploaded.",
  pending: "Saved in this browser. Sending to your account…",
  saving: "Saving to your account…",
  synced: "Saved to your account.",
  offline: "Saved on this device. It will reach your account when you are back online.",
};

export function SyncStatus() {
  const status = useResumeStore((state) => state.syncStatus);

  return (
    <span
      // Polite rather than assertive: this changes on a debounce while
      // someone is typing, and an assertive region would interrupt them.
      aria-live="polite"
      data-sync-status={status}
      className="text-xs text-zinc-500 dark:text-zinc-400"
    >
      {MESSAGES[status]}
    </span>
  );
}
