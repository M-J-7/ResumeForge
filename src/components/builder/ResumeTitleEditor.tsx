"use client";

/**
 * The resume's title, editable from inside the builder (P24).
 *
 * Renaming lived only on the dashboard before this — correct for the
 * feature that shipped it, but it meant leaving the document you were
 * editing just to change what it's called. `renameResume` already existed
 * with the right ownership scoping; this is a second, more convenient
 * caller of the same action.
 *
 * Click-to-edit rather than an always-open input: a persistently editable
 * heading reads as the document's own name floating in the chrome, and it
 * would compete with the actual step heading right below it for attention
 * on every single render.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/control";
import { PencilIcon } from "@/components/ui/icons";
import { useResumeStore } from "@/store/resume";

export function ResumeTitleEditor({ resumeId, title }: { resumeId: string; title: string }) {
  // `renameResumeAction` is reached with a dynamic import, not a top-level
  // one, for the same reason `serverSync.ts` does the same thing: this
  // module is always part of a signed-in `BuilderShell`'s tree, but the
  // action pulls in `next-auth` and, through `getPrisma()`, the native
  // `better-sqlite3` binding — neither of which a guest session, or the
  // jsdom component test, can resolve. A static import here would put both
  // in the bundle regardless of whether this component ever renders.
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(title);
          setEditing(true);
        }}
        className="group text-muted hover:text-text focus-visible:ring-accent flex max-w-full items-center gap-1.5 rounded-md py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="truncate">{title}</span>
        <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
        <span className="sr-only">, rename this resume</span>
      </button>
    );
  }

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const { renameResumeAction } = await import("@/app/dashboard/actions");
      const result = await renameResumeAction(resumeId, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      // The dashboard's list is server-rendered; this keeps it correct for
      // whenever the user navigates back to it, without a page reload here.
      router.refresh();
    });
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        <span className="sr-only">Resume title</span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          maxLength={120}
          autoFocus
          disabled={pending}
          className="h-7 py-0.5 text-sm"
        />
      </label>
      {error ? (
        <span role="alert" className="text-danger text-xs">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/**
 * "Save as new resume", for a signed-in visitor editing anything — an
 * account resume, or the local guest draft.
 *
 * Creates a fresh row from the document open right now and moves the
 * builder to it. This is the flow that makes tailoring a copy per
 * application natural: adjust a resume for one posting, save it as a new
 * one, keep both.
 */
export function SaveAsNewResumeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            // Same reasoning as the rename action above: dynamic so a guest's
            // bundle and the jsdom test never resolve `next-auth`.
            const { createResumeAction } = await import("@/app/dashboard/actions");
            const document = useResumeStore.getState().document();
            const result = await createResumeAction(undefined, JSON.stringify(document));
            if (!result.ok) {
              // Surfaced rather than swallowed. This creates a row the user
              // believes exists; failing silently would leave them editing
              // the original under the impression it was a copy — and then
              // overwriting work they meant to keep.
              setError(result.error);
              return;
            }
            router.push(`/builder?resume=${encodeURIComponent(result.value.id)}`);
          });
        }}
      >
        {pending ? "Saving…" : "Save as new resume"}
      </Button>
      {error ? (
        <span role="alert" className="text-danger text-xs">
          {error}
        </span>
      ) : null}
    </span>
  );
}
