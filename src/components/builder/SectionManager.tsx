/**
 * Section order and visibility.
 *
 * Hiding is not deleting: a hidden section keeps its content and simply
 * stops being rendered, so tailoring a resume for one application does not
 * destroy work needed for the next.
 */

"use client";

import { SortableItem, SortableList } from "./SortableList";
import { STANDARD_SECTION_LABELS } from "@/lib/layout/document";
import { useResumeStore } from "@/store/resume";
import { Toggle } from "@/components/ui/control";

export function SectionManager() {
  const sections = useResumeStore((s) => s.history.present.sections);
  const reorderSections = useResumeStore((s) => s.reorderSections);
  const setSectionVisible = useResumeStore((s) => s.setSectionVisible);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Order &amp; visibility
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Hidden sections keep their content — they just stop appearing in the document.
        </p>
      </div>

      <SortableList ids={sections.map((s) => s.id)} onReorder={reorderSections}>
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const label =
              section.type === "custom"
                ? section.label || "Untitled section"
                : STANDARD_SECTION_LABELS[section.type];
            return (
              <li key={section.id}>
                <SortableItem id={section.id} label={`Reorder ${label}`}>
                  {(handle) => (
                    <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      {handle}
                      <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                        {label}
                      </span>
                      <Toggle
                        checked={section.visible}
                        label=""
                        onChange={(visible) => setSectionVisible(section.id, visible)}
                      />
                      <span className="sr-only">Show {label}</span>
                    </div>
                  )}
                </SortableItem>
              </li>
            );
          })}
        </ul>
      </SortableList>
    </div>
  );
}
