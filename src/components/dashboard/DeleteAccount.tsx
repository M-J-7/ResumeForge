"use client";

/**
 * Deleting the account (M2-T6).
 *
 * Collapsed by default and confirmed by typing the account's own email
 * address. A typed confirmation rather than a second button, because this is
 * the one action in the product with nothing behind it — no trash, no grace
 * period, no backup we could restore from. A button can be clicked by muscle
 * memory on a dialog that was not read; an address has to be looked at.
 *
 * The copy states what goes rather than gesturing at it. "This cannot be
 * undone" is a warning about a mechanism; "every resume, and their history"
 * is a description of what the user loses.
 */

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui/control";
import { deleteAccountAction } from "@/app/dashboard/actions";

export function DeleteAccount({ email, resumeCount }: { email: string; resumeCount: number }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  if (!open) {
    return (
      <section className="border-line border-t pt-6">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger-weak px-4 py-3">
      <h2 className="text-sm font-semibold text-text">Delete your account</h2>
      <p className="text-sm text-muted">
        This removes your account,{" "}
        {resumeCount === 1 ? "the resume saved to it" : `all ${resumeCount} resumes saved to it`},
        and their version history. Nothing is kept, there is no trash, and we hold no backup we
        could restore it from. Download anything you still want first.
      </p>

      <form
        className="flex flex-col gap-2"
        action={() =>
          startTransition(async () => {
            const result = await deleteAccountAction(typed);
            if (!result.ok) setError(result.error);
            // On success the action signs out and redirects; there is
            // nothing to do here, and no component left to do it in.
          })
        }
      >
        <label className="text-sm text-muted">
          Type <strong className="font-medium">{email}</strong> to confirm.
          <Input
            className="mt-1"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            aria-label={`Type ${email} to confirm deletion`}
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="danger" disabled={!confirmed || pending}>
            {pending ? "Deleting…" : "Delete everything permanently"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setTyped("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
