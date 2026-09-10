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
import { createEducationEntry } from "@/lib/resume/factory";
import { moveItem } from "@/store/resume";

export function EducationStep() {
  const level = useExperienceLevel();
  const { section, update } = useSection("education");
  if (!section) return null;

  const { entries } = section;

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 ? <EmptyStatePanel state={emptyStateFor("education", level)} /> : null}

      <SortableList
        ids={entries.map((e) => e.id)}
        onReorder={(from, to) => update({ ...section, entries: moveItem(entries, from, to) })}
      >
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <SortableItem
              key={entry.id}
              id={entry.id}
              label={`Reorder ${entry.institution || "qualification"}`}
            >
              {(handle) => (
                <EntryCard
                  handle={handle}
                  title={[entry.credential, entry.field].filter(Boolean).join(", ")}
                  subtitle={[entry.institution, formatDateRange(entry.dates)]
                    .filter(Boolean)
                    .join(" · ")}
                  removeLabel={`Remove ${entry.institution || "this qualification"}`}
                  onRemove={() =>
                    update({ ...section, entries: entries.filter((e) => e.id !== entry.id) })
                  }
                >
                  <FieldGrid>
                    <Field label="Credential" hint="BSc, BTech, MBA, Diploma…">
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          value={entry.credential}
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, {
                                  ...entry,
                                  credential: e.target.value,
                                }),
                              },
                              `edu.cred.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field label="Field of study">
                      {({ id }) => (
                        <Input
                          id={id}
                          value={entry.field}
                          placeholder="Computer Science"
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, { ...entry, field: e.target.value }),
                              },
                              `edu.field.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field label="Institution">
                      {({ id }) => (
                        <Input
                          id={id}
                          value={entry.institution}
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, {
                                  ...entry,
                                  institution: e.target.value,
                                }),
                              },
                              `edu.inst.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field label="Location">
                      {({ id }) => (
                        <Input
                          id={id}
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
                              `edu.loc.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                    <Field
                      label="Result"
                      hint="Optional. Include a strong one; leave a weak one out rather than volunteering it."
                    >
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          value={entry.result}
                          placeholder="8.7 CGPA"
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, { ...entry, result: e.target.value }),
                              },
                              `edu.result.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>
                  </FieldGrid>

                  <DateRangeFields
                    value={entry.dates}
                    currentLabel="I am still studying here"
                    onChange={(dates) =>
                      update({ ...section, entries: replaceById(entries, { ...entry, dates }) })
                    }
                  />

                  <BulletEditor
                    entryId={entry.id}
                    bullets={entry.bullets}
                    label="Detail (optional)"
                    hint="Relevant coursework, thesis, or an award. Skip it once you have work experience."
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
        onClick={() => update({ ...section, entries: [...entries, createEducationEntry()] })}
      >
        Add a qualification
      </Button>
    </div>
  );
}
