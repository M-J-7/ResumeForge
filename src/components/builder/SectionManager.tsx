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
import { cn } from "@/lib/utils";

export function SectionManager() {
  const sections = useResumeStore((s) => s.history.present.sections);
  const reorderSections = useResumeStore((s) => s.reorderSections);
  const setSectionVisible = useResumeStore((s) => s.setSectionVisible);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-faint text-xs font-semibold tracking-wide uppercase">
          Order &amp; visibility
        </h2>
        <p className="text-muted mt-1 text-xs leading-relaxed">
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
                    // A row with a real hover, so the drag handle reads as an
                    // affordance rather than as an icon that happens to be
                    // there. A border rather than a shadow: chrome gets
                    // hairlines, paper gets the shadow.
                    <div
                      className={cn(
                        "border-line/0 hover:border-line hover:bg-surface-0 flex items-center gap-2 rounded-md border px-1.5 py-1.5",
                        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                      )}
                    >
                      {handle}
                      <span className="text-text flex-1 truncate text-sm">{label}</span>
                      <Toggle
                        checked={section.visible}
                        // The name goes on the control, not beside it. A
                        // sibling span is not associated with the input, so
                        // this used to announce as an unnamed checkbox — six
                        // of them in a row, all identical.
                        label={`Show ${label}`}
                        labelHidden
                        onChange={(visible) => setSectionVisible(section.id, visible)}
                      />
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
