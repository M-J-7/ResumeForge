/**
 * The "there is nothing here yet" panel.
 *
 * Generalised from `builder/empty-states.tsx`, which keeps its own copy —
 * that copy is asserted verbatim by `BuilderShell.test.tsx` (the hackathon
 * and campus-placement lines among them), and it is genuinely good copy that
 * answers "what counts as experience?" rather than saying "No items".
 *
 * The shape here is the useful part of that pattern: a headline, a sentence
 * of orientation, and an action. An empty state with no action is a dead end
 * dressed up as a feature.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  /** Decorative. The heading carries the meaning. */
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-line bg-surface-1 flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <span className="text-faint">{icon}</span> : null}
      <div className="flex flex-col gap-1">
        <p className="text-text text-sm font-semibold">{title}</p>
        <p className="text-muted mx-auto max-w-prose text-sm">{body}</p>
      </div>
      {action}
    </div>
  );
}
