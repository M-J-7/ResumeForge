"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { BulletEditor } from "@/components/builder/BulletEditor";
import { OptionalDateRangeFields } from "@/components/builder/DateRangeFields";
import { EntryCard, FieldGrid } from "@/components/builder/EntryCard";
import { EmptyStatePanel, emptyStateFor } from "@/components/builder/empty-states";
import { useExperienceLevel } from "@/components/builder/useExperienceLevel";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById } from "@/components/builder/useSection";
import { createCustomEntry, createId } from "@/lib/resume/factory";
import { SECTION_PRESETS, buildPresetSection } from "@/lib/resume/section-presets";
import { moveItem, useResumeStore } from "@/store/resume";
import type { CustomSection } from "@/lib/resume/schema";

export function CustomStep() {
  const level = useExperienceLevel();
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
      {sections.length === 0 ? <EmptyStatePanel state={emptyStateFor("custom", level)} /> : null}

      {sections.map((section) => (
        <div
          key={section.id}
          className="border-line bg-surface-1/50 flex flex-col gap-4 rounded-lg border p-4"
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

      {/*
        Presets (P33-C4). The machinery was already here — a custom section is
        a first-class part of the schema and `addCustomSection` has always
        existed — so what was missing was only the list. Without it the user
        had to know "Publications" was a section they could have, and then
        type the word.

        Presets already on the document are hidden rather than disabled: a
        row of dead buttons is worse than a shorter row.
      */}
      <section className="flex flex-col gap-2">
        <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
          Common sections
        </h3>
        <ul className="flex flex-col gap-2">
          {SECTION_PRESETS.filter(
            (preset) =>
              !sections.some(
                (section) => section.label.trim().toLowerCase() === preset.label.toLowerCase(),
              ),
          ).map((preset) => (
            <li key={preset.id} className="flex items-start gap-3">
              <Button
                className="shrink-0"
                onClick={() => addCustomSection(buildPresetSection(preset))}
              >
                {preset.label}
              </Button>
              <p className="text-muted pt-2 text-xs">{preset.hint}</p>
            </li>
          ))}
        </ul>
      </section>

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
