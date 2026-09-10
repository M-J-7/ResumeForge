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
    <section className="border-line bg-surface-0 rounded-lg border p-4 shadow-[var(--shadow-card)]">
      <header className="mb-4 flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <h3 className="text-text truncate text-sm font-semibold">
            {title || <span className="text-faint italic">Untitled</span>}
          </h3>
          {subtitle ? <p className="text-muted truncate text-xs">{subtitle}</p> : null}
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
