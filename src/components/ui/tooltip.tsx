"use client";

/**
 * A hint on hover or focus, in CSS.
 *
 * No positioning library. A tooltip that only ever appears directly above or
 * below its trigger does not need collision detection, and the whole class of
 * bugs where a floating element ends up behind a scroll container comes from
 * solving a problem this UI does not have.
 *
 * ## `aria-describedby`, not `aria-label`
 *
 * A tooltip supplements a control's name; it is not the name. Using a label
 * here would silently replace the accessible name of whatever it wraps —
 * which, given how many assertions in this repo match buttons by exact name,
 * would break tests as well as screen readers.
 *
 * Focus-visible as well as hover, because a tooltip a keyboard user cannot
 * reach is decoration.
 */

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: string;
  /** The trigger. Receives `aria-describedby` via a wrapper, so any element works. */
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();

  return (
    <span className={cn("group relative inline-flex", className)} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap",
          "bg-text text-surface-0 rounded-md px-2 py-1 text-xs font-medium shadow-md",
          "opacity-0 transition-opacity duration-[var(--dur-fast)]",
          "group-focus-within:opacity-100 group-hover:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
