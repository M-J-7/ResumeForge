/**
 * Store access for the step forms.
 *
 * Each step reads its own section and writes back through a narrow updater,
 * so a step never has to know the shape of the whole document.
 *
 * Edits carry a `coalesceKey` naming the field, which is what makes typing a
 * bullet one undo step rather than forty (see `store/history.ts`).
 */

"use client";

import { useCallback } from "react";
import { useResumeStore } from "@/store/resume";
import type { Section, SectionType } from "@/lib/resume/schema";

/** Narrows a section by its `type` discriminant. */
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export function useSection<T extends SectionType>(
  type: T,
): { section: SectionOf<T> | null; update: (next: SectionOf<T>, coalesceKey?: string) => void } {
  const section = useResumeStore(
    (s) =>
      (s.history.present.sections.find((sec) => sec.type === type) ?? null) as SectionOf<T> | null,
  );
  const updateSection = useResumeStore((s) => s.updateSection);

  const update = useCallback(
    (next: SectionOf<T>, coalesceKey?: string) => {
      updateSection(next.id, () => next, coalesceKey ? { coalesceKey } : undefined);
    },
    [updateSection],
  );

  return { section, update };
}

/** Sections addressed by id rather than type — custom sections, of which there may be several. */
export function useSectionById(sectionId: string) {
  const section = useResumeStore(
    (s) => s.history.present.sections.find((sec) => sec.id === sectionId) ?? null,
  );
  const updateSection = useResumeStore((s) => s.updateSection);

  const update = useCallback(
    (next: Section, coalesceKey?: string) => {
      updateSection(next.id, () => next, coalesceKey ? { coalesceKey } : undefined);
    },
    [updateSection],
  );

  return { section, update };
}

/**
 * Replaces one entry in a list by id, leaving the rest untouched.
 * Written as a helper because every step needs exactly this.
 */
export function replaceById<T extends { id: string }>(items: readonly T[], next: T): T[] {
  return items.map((item) => (item.id === next.id ? next : item));
}
