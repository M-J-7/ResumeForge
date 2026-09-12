"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { EntryCard } from "@/components/builder/EntryCard";
import { EmptyStatePanel, emptyStateFor } from "@/components/builder/empty-states";
import { useExperienceLevel } from "@/components/builder/useExperienceLevel";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById, useSection } from "@/components/builder/useSection";
import { createSkillGroup } from "@/lib/resume/factory";
import { moveItem } from "@/store/resume";

/**
 * Skills are entered as comma-separated text rather than as tag chips.
 *
 * Everyone already has their skills in a comma-separated list somewhere, and
 * a chip input turns pasting that list into a fight. The value is split on
 * commas only when it reaches the document, so the raw text — including a
 * trailing comma the user is still typing past — survives a refresh.
 */
export function SkillsStep() {
  const level = useExperienceLevel();
  const { section, update } = useSection("skills");
  if (!section) return null;

  const { groups } = section;

  return (
    <div className="flex flex-col gap-4">
      {groups.length === 0 ? <EmptyStatePanel state={emptyStateFor("skills", level)} /> : null}

      <SortableList
        ids={groups.map((g) => g.id)}
        onReorder={(from, to) => update({ ...section, groups: moveItem(groups, from, to) })}
      >
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <SortableItem
              key={group.id}
              id={group.id}
              label={`Reorder ${group.label || "skill group"}`}
            >
              {(handle) => (
                <EntryCard
                  handle={handle}
                  title={group.label}
                  subtitle={`${group.skills.length} ${group.skills.length === 1 ? "skill" : "skills"}`}
                  removeLabel={`Remove ${group.label || "this group"}`}
                  onRemove={() =>
                    update({ ...section, groups: groups.filter((g) => g.id !== group.id) })
                  }
                >
                  <Field label="Group name" hint="Languages, Frameworks, Tools, Platforms…">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        value={group.label}
                        onChange={(e) =>
                          update(
                            {
                              ...section,
                              groups: replaceById(groups, { ...group, label: e.target.value }),
                            },
                            `skill.label.${group.id}`,
                          )
                        }
                      />
                    )}
                  </Field>

                  <Field label="Skills" hint="Separate with commas.">
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        value={group.skills.join(", ")}
                        placeholder="Go, TypeScript, PostgreSQL"
                        onChange={(e) =>
                          update(
                            {
                              ...section,
                              groups: replaceById(groups, {
                                ...group,
                                // Keep empty segments while typing so the caret
                                // can sit after a comma; the layout model drops
                                // blanks before anything is rendered.
                                skills: e.target.value.split(",").map((s) => s.trimStart()),
                              }),
                            },
                            `skill.items.${group.id}`,
                          )
                        }
                      />
                    )}
                  </Field>
                </EntryCard>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>

      <Button
        variant="primary"
        className="self-start"
        disabled={groups.length >= 12}
        onClick={() => update({ ...section, groups: [...groups, createSkillGroup()] })}
      >
        Add a skill group
      </Button>
    </div>
  );
}
