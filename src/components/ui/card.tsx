/**
 * A raised surface.
 *
 * Deliberately thin — a card is a border, a radius and a background, and
 * every prop added here is one more decision taken away from the thirty
 * places that use it. Padding lives on `CardBody` rather than `Card` so a
 * card can hold something that must reach its edges, like the page thumbnail
 * on the dashboard.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line bg-surface-0 rounded-lg border shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line flex items-start justify-between gap-3 border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * No heading level of its own. The correct level depends on where the card
 * sits, and several e2e assertions match resume titles by role and level —
 * so the caller passes `as` rather than inheriting a guess.
 */
export function CardTitle({
  className,
  as: Tag = "h3",
  ...props
}: ComponentProps<"h3"> & { as?: "h2" | "h3" | "h4" }) {
  return <Tag className={cn("text-text text-sm font-semibold", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 py-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-line flex items-center gap-2 border-t px-4 py-2.5", className)}
      {...props}
    />
  );
}
