/**
 * Experience level (P35, M4-T8).
 *
 * Their wizard opens with "how long have you been working" and adapts.
 * Ours had one flow — while `components/builder/empty-states.tsx` already
 * carried fresher-specific copy that nothing routed to. The copy was written
 * for a fresher and then shown to everyone, which is the worst of both: a
 * ten-year veteran reads "hackathon entries — including the ones that did
 * not win" and concludes the product is not for them.
 *
 * ## A UI preference, not resume content
 *
 * Stored in `localStorage`, deliberately **not** in the `ResumeDocument`.
 * Two reasons, and the second is the one that decides it:
 *
 * 1. It is not resume content. Nothing about it appears in the PDF, and a
 *    field in the document that never renders is a field that will confuse
 *    the next person to read the schema.
 * 2. Putting it in the document means a `schemaVersion` bump and a migration
 *    for a preference — and D10 makes every persisted field a permanent
 *    commitment. A preference does not earn that.
 *
 * It is also per-browser rather than per-resume on purpose: it describes the
 * person, and a person's career stage does not differ between two resumes
 * they are writing on the same afternoon.
 *
 * ## What it changes, and what it does not
 *
 * It reorders the step rail and swaps empty-state copy. It does **not**
 * hide a section, gate a step, or change what the document can contain: a
 * fresher who has an internship must still be able to put it under
 * Experience, and `StepNav` was already free-navigation so nothing about
 * the flow needed rebuilding.
 */

import { namespacedKey } from "@/store/owner";

export const EXPERIENCE_LEVELS = ["none", "under-2", "2-5", "5-10", "10-plus"] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface ExperienceLevelOption {
  readonly id: ExperienceLevel;
  readonly label: string;
  /** One line, so the choice is obvious without reading all five. */
  readonly detail: string;
}

export const EXPERIENCE_LEVEL_OPTIONS: readonly ExperienceLevelOption[] = [
  {
    id: "none",
    label: "No work experience yet",
    detail: "Student, or about to start. Projects and education lead.",
  },
  {
    id: "under-2",
    label: "Under 2 years",
    detail: "First job, an internship, or a recent switch into the field.",
  },
  { id: "2-5", label: "2–5 years", detail: "Established, with a track record to point at." },
  {
    id: "5-10",
    label: "5–10 years",
    detail: "Senior, often leading work rather than only doing it.",
  },
  {
    id: "10-plus",
    label: "10+ years",
    detail: "Long career. The problem is usually what to leave out.",
  },
];

/**
 * Base key for the stored band, namespaced per owner (§10.1).
 *
 * Renamed from `STORAGE_KEY` because it is no longer a key — it is the
 * prefix of one, and a call site that used it directly would write to a slot
 * the purge cannot attribute to anybody.
 */
export const EXPERIENCE_LEVEL_STORAGE_KEY = "ats-resume-builder:experience-level";

/** The slot this browser's current identity reads and writes. */
function storageKey(): string {
  return namespacedKey(EXPERIENCE_LEVEL_STORAGE_KEY);
}

/** The bands that lead with evidence rather than with employment history. */
const EVIDENCE_FIRST: ReadonlySet<ExperienceLevel> = new Set<ExperienceLevel>(["none", "under-2"]);

export function isEvidenceFirst(level: ExperienceLevel | null): boolean {
  return level !== null && EVIDENCE_FIRST.has(level);
}

function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return typeof value === "string" && (EXPERIENCE_LEVELS as readonly string[]).includes(value);
}

/** The stored preference, or null when it has never been answered. */
export function readExperienceLevel(): ExperienceLevel | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey());
    return isExperienceLevel(raw) ? raw : null;
  } catch {
    // Private browsing, or storage disabled. The question is asked again,
    // which is a small annoyance; failing the builder would not be.
    return null;
  }
}

/**
 * The event that tells every reader the stored value changed.
 *
 * `localStorage` fires `storage` only in *other* tabs, so a component in the
 * tab that made the change never hears about it. Without this the rail would
 * reorder and the empty states would not, until something else happened to
 * re-render them.
 */
const CHANGED_EVENT = "ats-resume-builder:experience-level-changed";

export function writeExperienceLevel(level: ExperienceLevel): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(), level);
  } catch {
    // Best-effort. The reorder still applies for this session.
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * `useSyncExternalStore` plumbing.
 *
 * The preference lives outside React, which is what this hook family is for
 * — and it is the reason there is no `useEffect` reading `localStorage` into
 * state anywhere here. That pattern renders once with the wrong answer, then
 * again with the right one, which for a *step order* means the rail visibly
 * rearranges under the cursor of someone who has already started reading it.
 */
export function subscribeToExperienceLevel(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(CHANGED_EVENT, onChange);
  // Another tab's change arrives as `storage`; this one's arrives above.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The server has no `localStorage`, so it has no answer — same as "not asked". */
export function serverExperienceLevel(): ExperienceLevel | null {
  return null;
}

/**
 * The step order for a band.
 *
 * Returns the ids in the order the rail should show them; the caller keeps
 * anything not named here in its existing position. Only the evidence-first
 * bands reorder — every other band gets the default, which is what
 * "restores the default order" means in the acceptance criteria.
 */
export function stepOrderFor(level: ExperienceLevel | null): readonly string[] | null {
  if (!isEvidenceFirst(level)) return null;
  return [
    "contact",
    "summary",
    "projects",
    "education",
    "skills",
    "experience",
    "certifications",
    "custom",
  ];
}
