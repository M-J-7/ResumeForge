/**
 * Shared chrome for a repeatable entry: drag handle, title, remove button.
 *
 * Removal is a two-step confirm rather than a modal. A modal for "are you
 * sure" interrupts a keyboard flow badly, and the undo history (M0-T7)
 * already makes a mistaken delete recoverable — the confirm exists to stop
 * the accidental click, not to guard an irreversible act.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/control";

export function EntryCard({
  title,
  subtitle,
  handle,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  handle?: ReactNode;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-4 flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title || <span className="text-zinc-400 italic">Untitled</span>}
          </h3>
          {subtitle ? (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          ) : null}
        </div>
        {confirming ? (
          <div className="flex shrink-0 gap-1">
            <Button variant="danger" onClick={onRemove}>
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" aria-label={removeLabel} onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Consistent two-column grid for entry fields, collapsing on small screens. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
