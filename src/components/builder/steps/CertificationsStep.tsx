"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { PartialDateField } from "@/components/builder/DateRangeFields";
import { EntryCard, FieldGrid } from "@/components/builder/EntryCard";
import { EMPTY_STATES, EmptyStatePanel } from "@/components/builder/empty-states";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { replaceById, useSection } from "@/components/builder/useSection";
import { createCertificationEntry } from "@/lib/resume/factory";
import { isValidUrl } from "@/lib/resume/schema";
import { moveItem } from "@/store/resume";

export function CertificationsStep() {
  const { section, update } = useSection("certifications");
  if (!section) return null;

  const { entries } = section;

  return (
    <div className="flex flex-col gap-4">
      {entries.length === 0 ? <EmptyStatePanel state={EMPTY_STATES.certifications!} /> : null}

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
                label={`Reorder ${entry.name || "certification"}`}
              >
                {(handle) => (
                  <EntryCard
                    handle={handle}
                    title={entry.name}
                    subtitle={entry.issuer}
                    removeLabel={`Remove ${entry.name || "this certification"}`}
                    onRemove={() =>
                      update({ ...section, entries: entries.filter((e) => e.id !== entry.id) })
                    }
                  >
                    <FieldGrid>
                      <Field label="Certification">
                        {({ id }) => (
                          <Input
                            id={id}
                            value={entry.name}
                            placeholder="Certified Kubernetes Administrator"
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, { ...entry, name: e.target.value }),
                                },
                                `cert.name.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                      <Field label="Issuer">
                        {({ id }) => (
                          <Input
                            id={id}
                            value={entry.issuer}
                            placeholder="Cloud Native Computing Foundation"
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, {
                                    ...entry,
                                    issuer: e.target.value,
                                  }),
                                },
                                `cert.issuer.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                      <Field
                        label="Credential ID"
                        hint="Optional. Only if a verifier would use it."
                      >
                        {({ id, describedBy }) => (
                          <Input
                            id={id}
                            aria-describedby={describedBy}
                            value={entry.credentialId}
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, {
                                    ...entry,
                                    credentialId: e.target.value,
                                  }),
                                },
                                `cert.id.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                      <Field label="Verification link" error={urlError}>
                        {({ id, describedBy }) => (
                          <Input
                            id={id}
                            inputMode="url"
                            aria-describedby={describedBy}
                            aria-invalid={urlError ? true : undefined}
                            value={entry.url}
                            onChange={(e) =>
                              update(
                                {
                                  ...section,
                                  entries: replaceById(entries, { ...entry, url: e.target.value }),
                                },
                                `cert.url.${entry.id}`,
                              )
                            }
                          />
                        )}
                      </Field>
                    </FieldGrid>

                    <PartialDateField
                      label="Issued"
                      value={entry.issued}
                      onChange={(issued) =>
                        update({ ...section, entries: replaceById(entries, { ...entry, issued }) })
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
        onClick={() => update({ ...section, entries: [...entries, createCertificationEntry()] })}
      >
        Add a certification
      </Button>
    </div>
  );
}
