/**
 * A raised surface.
 *
 * Deliberately thin — a card is a border, a radius and a background, and
 * every prop added here is one more decision taken away from the thirty
 * places that use it. Padding lives on `CardBody` rather than `Card` so a
 * card can hold something that must reach its edges, like the page thumbnail
 * on the dashboard.
 *
 * ## Elevation is light, not shadow
 *
 * It carried `--shadow-card`, which is `none` — deliberately, because ten
 * identical cards each wearing the same grey blur is what the old landing page
 * was. `--elev-1` keeps that rule and gives the card back the one thing a flat
 * hairline rectangle lacks: a lit top edge. It is a 1px inset highlight, so on
 * the light theme it is very nearly nothing (correct: Paper & Ink's chrome is
 * flat and the document keeps the only real shadow) and on a dark ground it is
 * what separates one surface from the next, where a drop shadow has nothing to
 * be darker than.
 *
 * A utility, so a caller's own `shadow-*` still wins.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("border-line bg-surface-0 rounded-lg border shadow-[var(--elev-1)]", className)}
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
  return <Tag className={cn("text-text text-body font-semibold", className)} {...props} />;
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
