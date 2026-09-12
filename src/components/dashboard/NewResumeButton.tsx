"use client";

/**
 * "New resume" (P24).
 *
 * `createResume` has existed since M2-T4 with correct ownership scoping;
 * this is the first thing in the UI that calls it. Before this, a
 * signed-in visitor had exactly one way into the builder from the
 * dashboard — "Open the builder", which edits whatever the guest draft
 * happens to hold — and no way to start a second, independent resume.
 *
 * The dialog asks for a name up front rather than creating a resume and
 * asking afterward, because the alternative — an unavoidable "Untitled
 * resume" every time — is exactly the silent-default naming the rest of
 * this feature (renaming, duplicating) exists to let people avoid.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui/control";
import { Dialog } from "@/components/ui/dialog";
import { PlusIcon } from "@/components/ui/icons";
import { createResumeAction } from "@/app/dashboard/actions";

export function NewResumeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setTitle("");
    setError(null);
  };

  const create = () => {
    setError(null);
    startTransition(async () => {
      const result = await createResumeAction(title.trim() || undefined);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.push(`/builder?resume=${encodeURIComponent(result.value.id)}`);
    });
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} icon={<PlusIcon className="h-4 w-4" />}>
        New resume
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Name your new resume"
        description="You can rename it later. Leave this blank and it will be named from what you write."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <Field label="Title" error={error ?? undefined}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              value={title}
              aria-describedby={describedBy}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
              placeholder="For Anthropic — Backend Engineer"
              maxLength={120}
              autoFocus
            />
          )}
        </Field>
      </Dialog>
    </>
  );
}
