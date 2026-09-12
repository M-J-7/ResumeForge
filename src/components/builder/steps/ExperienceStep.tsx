"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { BulletEditor } from "@/components/builder/BulletEditor";
import { DateRangeFields } from "@/components/builder/DateRangeFields";
import { EntryCard, FieldGrid } from "@/components/builder/EntryCard";
import { EmptyStatePanel, emptyStateFor } from "@/components/builder/empty-states";
import { useExperienceLevel } from "@/components/builder/useExperienceLevel";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById, useSection } from "@/components/builder/useSection";
import { formatDateRange } from "@/lib/resume/dates";
import { createExperienceEntry } from "@/lib/resume/factory";
import { moveItem } from "@/store/resume";

export function ExperienceStep() {
  const level = useExperienceLevel();
  const { section, update } = useSection("experience");
  if (!section) return null;

  const { entries } = section;

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 ? <EmptyStatePanel state={emptyStateFor("experience", level)} /> : null}

      <SortableList
        ids={entries.map((e) => e.id)}
        onReorder={(from, to) => update({ ...section, entries: moveItem(entries, from, to) })}
      >
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <SortableItem key={entry.id} id={entry.id} label={`Reorder ${entry.title || "role"}`}>
              {(handle) => (
                <EntryCard
                  handle={handle}
                  title={entry.title}
                  subtitle={[entry.organization, formatDateRange(entry.dates)]
                    .filter(Boolean)
                    .join(" · ")}
                  removeLabel={`Remove ${entry.title || "this role"}`}
                  onRemove={() =>
                    update({ ...section, entries: entries.filter((e) => e.id !== entry.id) })
                  }
                >
                  <FieldGrid>
                    <Field label="Job title">
                      {({ id }) => (
                        <Input
                          id={id}
                          value={entry.title}
                          placeholder="Senior Backend Engineer"
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, { ...entry, title: e.target.value }),
                              },
                              `exp.title.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field label="Organization">
                      {({ id }) => (
                        <Input
                          id={id}
                          value={entry.organization}
                          placeholder="Contoso Payments"
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, {
                                  ...entry,
                                  organization: e.target.value,
                                }),
                              },
                              `exp.org.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field label="Location" hint="City and country, or “Remote”.">
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          value={entry.location}
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, {
                                  ...entry,
                                  location: e.target.value,
                                }),
                              },
                              `exp.loc.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                  </FieldGrid>

                  <DateRangeFields
                    value={entry.dates}
                    onChange={(dates) =>
                      update({ ...section, entries: replaceById(entries, { ...entry, dates }) })
                    }
                  />

                  <BulletEditor
                    entryId={entry.id}
                    bullets={entry.bullets}
                    jobTitle={entry.title}
                    hint="Start with a verb. Name the result, and the number if you have one."
                    onChange={(bullets, coalesceKey) =>
                      update(
                        { ...section, entries: replaceById(entries, { ...entry, bullets }) },
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
        variant="primary"
        className="self-start"
        onClick={() => update({ ...section, entries: [...entries, createExperienceEntry()] })}
      >
        Add a role
      </Button>
    </div>
  );
}
