"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { BulletEditor } from "@/components/builder/BulletEditor";
import { OptionalDateRangeFields } from "@/components/builder/DateRangeFields";
import { EntryCard, FieldGrid } from "@/components/builder/EntryCard";
import { EMPTY_STATES, EmptyStatePanel } from "@/components/builder/empty-states";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById } from "@/components/builder/useSection";
import { createCustomEntry, createId } from "@/lib/resume/factory";
import { moveItem, useResumeStore } from "@/store/resume";
import type { CustomSection } from "@/lib/resume/schema";

export function CustomStep() {
  // Select the stable array and filter during render. Filtering *inside* the
  // selector returns a new array on every call, which makes Zustand's
  // snapshot compare unequal every time and re-renders without end.
  const allSections = useResumeStore((s) => s.history.present.sections);
  const sections = allSections.filter((sec): sec is CustomSection => sec.type === "custom");
  const updateSection = useResumeStore((s) => s.updateSection);
  const addCustomSection = useResumeStore((s) => s.addCustomSection);
  const removeSection = useResumeStore((s) => s.removeSection);

  const update = (next: CustomSection, coalesceKey?: string) =>
    updateSection(next.id, () => next, coalesceKey ? { coalesceKey } : undefined);

  return (
    <div className="flex flex-col gap-6">
      {sections.length === 0 ? <EmptyStatePanel state={EMPTY_STATES.custom!} /> : null}

      {sections.map((section) => (
        <div
          key={section.id}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
        >
          <div className="flex items-end gap-2">
            <Field
              className="flex-1"
              label="Section heading"
              hint="Keep it short and conventional so a parser recognises it."
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={section.label}
                  placeholder="Languages"
                  onChange={(e) =>
                    update({ ...section, label: e.target.value }, `custom.label.${section.id}`)
                  }
                />
              )}
            </Field>
            <Button
              variant="danger"
              onClick={() => removeSection(section.id)}
              aria-label={`Remove the ${section.label || "custom"} section`}
            >
              Remove section
            </Button>
          </div>

          <SortableList
            ids={section.entries.map((e) => e.id)}
            onReorder={(from, to) =>
              update({ ...section, entries: moveItem(section.entries, from, to) })
            }
          >
            <div className="flex flex-col gap-4">
              {section.entries.map((entry) => (
                <SortableItem
                  key={entry.id}
                  id={entry.id}
                  label={`Reorder ${entry.title || "entry"}`}
                >
                  {(handle) => (
                    <EntryCard
                      handle={handle}
                      title={entry.title}
                      subtitle={entry.subtitle}
                      removeLabel={`Remove ${entry.title || "this entry"}`}
                      onRemove={() =>
                        update({
                          ...section,
                          entries: section.entries.filter((e) => e.id !== entry.id),
                        })
                      }
                    >
                      <FieldGrid>
                        <Field label="Title">
                          {({ id }) => (
                            <Input
                              id={id}
                              value={entry.title}
                              onChange={(e) =>
                                update(
                                  {
                                    ...section,
                                    entries: replaceById(section.entries, {
                                      ...entry,
                                      title: e.target.value,
                                    }),
                                  },
                                  `custom.title.${entry.id}`,
                                )
                              }
                            />
                          )}
                        </Field>
                        <Field label="Subtitle">
                          {({ id }) => (
                            <Input
                              id={id}
                              value={entry.subtitle}
                              onChange={(e) =>
                                update(
                                  {
                                    ...section,
                                    entries: replaceById(section.entries, {
                                      ...entry,
                                      subtitle: e.target.value,
                                    }),
                                  },
                                  `custom.subtitle.${entry.id}`,
                                )
                              }
                            />
                          )}
                        </Field>
                      </FieldGrid>

                      <OptionalDateRangeFields
                        value={entry.dates}
                        onChange={(dates) =>
                          update({
                            ...section,
                            entries: replaceById(section.entries, { ...entry, dates }),
                          })
                        }
                      />

                      <BulletEditor
                        entryId={entry.id}
                        bullets={entry.bullets}
                        label="Detail"
                        onChange={(bullets, coalesceKey) =>
                          update(
                            {
                              ...section,
                              entries: replaceById(section.entries, { ...entry, bullets }),
                            },
                            coalesceKey,
                          )
                        }
                      />
                    </EntryCard>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableList>

          <Button
            className="self-start"
            onClick={() =>
              update({ ...section, entries: [...section.entries, createCustomEntry()] })
            }
          >
            Add an entry
          </Button>
        </div>
      ))}

      <Button
        variant="primary"
        className="self-start"
        onClick={() =>
          addCustomSection({
            id: createId(),
            type: "custom",
            visible: true,
            label: "",
            entries: [createCustomEntry()],
          })
        }
      >
        Add a custom section
      </Button>
    </div>
  );
}
