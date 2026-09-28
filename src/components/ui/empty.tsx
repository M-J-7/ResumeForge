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
        "border-line bg-surface-1 flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {/* The icon in a lit disc rather than a grey glyph floating on a dashed
          rectangle. An empty state is the first thing a new account sees, and
          the difference between "unfinished" and "waiting for you" is almost
          entirely whether anything in it looks built. */}
      {icon ? (
        <span className="bg-surface-0 border-line text-faint elev-1 flex h-12 w-12 items-center justify-center rounded-full border">
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className="text-text text-title font-semibold">{title}</p>
        <p className="text-muted text-small max-w-measure mx-auto leading-relaxed">{body}</p>
      </div>
      {action}
    </div>
  );
}
