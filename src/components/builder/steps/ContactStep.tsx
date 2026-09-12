"use client";

import { Button, Field, Input } from "@/components/ui/control";
import { SortableItem, SortableList } from "@/components/builder/SortableList";
import { useResumeStore, moveItem } from "@/store/resume";
import { createContactLink } from "@/lib/resume/factory";
import { isValidEmail, isValidUrl } from "@/lib/resume/schema";

export function ContactStep() {
  const contact = useResumeStore((s) => s.history.present.contact);
  const setContact = useResumeStore((s) => s.setContact);

  const set = <K extends keyof typeof contact>(key: K, value: (typeof contact)[K]) => {
    setContact({ ...contact, [key]: value }, { coalesceKey: `contact.${String(key)}` });
  };

  // Format errors are advisory while typing: the schema stores the text
  // regardless so a refresh mid-word loses nothing, and the message tells
  // the user what is wrong where they can fix it.
  const emailError =
    contact.email.length > 0 && !isValidEmail(contact.email)
      ? "This does not look like an email address yet."
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          hint="Exactly as you want it read. One field, because names do not reliably split in two."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={contact.fullName}
              autoComplete="name"
              onChange={(e) => set("fullName", e.target.value)}
            />
          )}
        </Field>

        <Field label="Email" error={emailError}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-describedby={describedBy}
              aria-invalid={emailError ? true : undefined}
              value={contact.email}
              onChange={(e) => set("email", e.target.value)}
            />
          )}
        </Field>

        <Field label="Phone" hint="Include the country code if you are applying internationally.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-describedby={describedBy}
              value={contact.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Location"
          hint="City and region is enough. A full street address is a privacy risk, not a credential."
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={contact.location}
              onChange={(e) => set("location", e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-text text-sm font-medium">Links</h3>
          <p className="text-faint text-xs">
            LinkedIn, GitHub, a portfolio. Link only what you would be happy for a recruiter to open
            first.
          </p>
        </div>

        <SortableList
          ids={contact.links.map((l) => l.id)}
          onReorder={(from, to) =>
            setContact({ ...contact, links: moveItem(contact.links, from, to) })
          }
        >
          <div className="flex flex-col gap-2">
            {contact.links.map((link, index) => {
              const urlError =
                link.url.length > 0 && !isValidUrl(link.url)
                  ? "Include the full address, starting with https://"
                  : undefined;
              return (
                <SortableItem key={link.id} id={link.id} label={`Reorder ${link.label || "link"}`}>
                  {(handle) => (
                    <div className="border-line flex items-start gap-2 rounded-md border bg-white p-2">
                      {handle}
                      <Input
                        aria-label={`Link ${index + 1} label`}
                        placeholder="LinkedIn"
                        className="sm:w-40"
                        value={link.label}
                        onChange={(e) =>
                          setContact(
                            {
                              ...contact,
                              links: contact.links.map((l) =>
                                l.id === link.id ? { ...l, label: e.target.value } : l,
                              ),
                            },
                            { coalesceKey: `link.label.${link.id}` },
                          )
                        }
                      />
                      <div className="flex-1">
                        <Input
                          aria-label={`Link ${index + 1} URL`}
                          placeholder="https://linkedin.com/in/you"
                          inputMode="url"
                          aria-invalid={urlError ? true : undefined}
                          value={link.url}
                          onChange={(e) =>
                            setContact(
                              {
                                ...contact,
                                links: contact.links.map((l) =>
                                  l.id === link.id ? { ...l, url: e.target.value } : l,
                                ),
                              },
                              { coalesceKey: `link.url.${link.id}` },
                            )
                          }
                        />
                        {urlError ? (
                          <p role="alert" className="mt-1 text-xs text-danger">
                            {urlError}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        aria-label={`Remove link ${index + 1}`}
                        onClick={() =>
                          setContact({
                            ...contact,
                            links: contact.links.filter((l) => l.id !== link.id),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableList>

        <Button
          className="self-start"
          disabled={contact.links.length >= 8}
          onClick={() => setContact({ ...contact, links: [...contact.links, createContactLink()] })}
        >
          Add a link
        </Button>
      </div>
    </div>
  );
}
