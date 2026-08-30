"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { BulletEditor } from "@/components/builder/BulletEditor";
import { OptionalDateRangeFields } from "@/components/builder/DateRangeFields";
import { EntryCard, FieldGrid } from "@/components/builder/EntryCard";
import { EMPTY_STATES, EmptyStatePanel } from "@/components/builder/empty-states";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById, useSection } from "@/components/builder/useSection";
import { createProjectEntry } from "@/lib/resume/factory";
import { isValidUrl } from "@/lib/resume/schema";
import { moveItem } from "@/store/resume";

export function ProjectsStep() {
  const { section, update } = useSection("projects");
  if (!section) return null;

  const { entries } = section;

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 ? <EmptyStatePanel state={EMPTY_STATES.projects!} /> : null}

      <SortableList
        ids={entries.map((e) => e.id)}
        onReorder={(from, to) => update({ ...section, entries: moveItem(entries, from, to) })}
      >
        <div className="flex flex-col gap-4">
          {entries.map((entry) => {
            const urlError =
              entry.url.length > 0 && !isValidUrl(entry.url)
                ? "Include the full address, starting with https://"
                : undefined;
            return (
              <SortableItem
                key={entry.id}
                id={entry.id}
                label={`Reorder ${entry.name || "project"}`}
              >
                {(handle) => (
                  <EntryCard
                    handle={handle}
                    title={entry.name}
                    subtitle={entry.role}
                    removeLabel={`Remove ${entry.name || "this project"}`}
                    onRemove={() =>
                      update({ ...section, entries: entries.filter((e) => e.id !== entry.id) })
                    }
                  >
                    <FieldGrid>
                      <Field label="Project name">
                        {({ id }) => (
                          <Input
                            id={id}
                            value={entry.name}
                            placeholder="Campus Placement Portal"
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, { ...entry, name: e.target.value }),
                                },
                                `proj.name.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                      <Field label="Your role" hint="Team Lead, Author, Contributor…">
                        {({ id, describedBy }) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            value={entry.role}
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, { ...entry, role: e.target.value }),
                                },
                                `proj.role.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                    </FieldGrid>

                    <Field
                      label="Link"
                      hint="Optional. A repository or live demo a reviewer can open."
                      error={urlError}
                    >
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          inputMode="url"
                          aria-describedby={describedBy}
                          aria-invalid={urlError ? true : undefined}
                          value={entry.url}
                          placeholder="https://github.com/you/project"
                          onChange={(e) =>
                            update(
                              {
                                ...section,
                                entries: replaceById(entries, { ...entry, url: e.target.value }),
                              },
                              `proj.url.${entry.id}`,
                            )
                          }
                        />
                      )}
                    </Field>

                    <OptionalDateRangeFields
                      value={entry.dates}
                      currentLabel="Still working on it"
                      onChange={(dates) =>
                        update({ ...section, entries: replaceById(entries, { ...entry, dates }) })
                      }
                    />

                    <BulletEditor
                      entryId={entry.id}
                      bullets={entry.bullets}
                      hint="What you built, who used it, and what it changed."
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
            );
          })}
        </div>
      </SortableList>

      <Button
        variant="primary"
        className="self-start"
        onClick={() => update({ ...section, entries: [...entries, createProjectEntry()] })}
      >
        Add a project
      </Button>
    </div>
  );
}
