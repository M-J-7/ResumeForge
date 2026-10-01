/**
 * Which lines of the Interview checklist somebody has ticked as ready.
 *
 * A preference about preparation, not resume content — the same position as
 * `lib/resume/experience-level.ts`, for the same reasons: nothing about it
 * reaches the PDF, and putting it in the `ResumeDocument` would make it a
 * permanent schema field (D10). So it lives in `localStorage`, namespaced per
 * owner and listed in `store/purge.ts` so it is purged with everything else.
 *
 * ## Keyed by the words, not the position
 *
 * A tick means "I could answer the question about *this* sentence". Keyed by
 * a hash of the text, an edited bullet comes back unticked — the figure in it
 * may have changed, and the answer with it — while reordering bullets or
 * sections keeps every tick where it belongs.
 */

import { namespacedKey } from "@/store/owner";

export const INTERVIEW_READY_STORAGE_KEY = "ats-resume-builder:interview-ready";

/** Enough for several long resumes; the oldest ticks fall off first. */
const MAX_TICKS = 400;

const CHANGED_EVENT = "ats-resume-builder:interview-ready-changed";

/** FNV-1a, 32 bits, as hex: short, stable, and not a copy of the sentence. */
export function lineKey(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function storageKey(): string {
  return namespacedKey(INTERVIEW_READY_STORAGE_KEY);
}

/** The raw stored string — a stable snapshot for `useSyncExternalStore`. */
export function readReadyRaw(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

export function parseReady(raw: string | null): ReadonlySet<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [],
    );
  } catch {
    return new Set();
  }
}

/** Ticks or unticks one line, keeping the most recent `MAX_TICKS`. */
export function setReady(text: string, ready: boolean): void {
  if (typeof localStorage === "undefined") return;
  const key = lineKey(text);
  const next = [...parseReady(readReadyRaw())].filter((existing) => existing !== key);
  if (ready) next.push(key);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next.slice(-MAX_TICKS)));
  } catch {
    // Private browsing, or storage full. The tick lasts for this render only,
    // which is a small loss; failing the builder would not be.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function subscribeToReady(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The server has no `localStorage`: nothing is ticked there. */
export function serverReadyRaw(): string | null {
  return null;
}
