/**
 * A loading placeholder.
 *
 * `aria-hidden` and paired with a real live region by the caller: a screen
 * reader user gains nothing from being told the shape of content that has not
 * arrived, and announcing the shimmer on every keystroke-triggered reload
 * would be actively hostile.
 *
 * The shimmer keyframe is in `globals.css` and is disabled wholesale under
 * `prefers-reduced-motion`, where it degrades to a flat block — which is the
 * correct fallback, not a broken one.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("anim-shimmer rounded-md", className)} {...props} />;
}
