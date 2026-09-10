"use client";

/**
 * The primary call to action.
 *
 * Three things separate it from a coloured rectangle, and all three are
 * pointer-driven rather than ambient — nothing here moves on its own.
 *
 * **It leans toward the cursor.** A few pixels, on a spring, from a hit area
 * slightly larger than the control. The effect is well under the threshold
 * where it would move the target out from under a click; what it buys is the
 * sense that the button noticed.
 *
 * **It catches the light** — one sweep of `.sheen`, the only place in the app
 * that uses white as an effect rather than as paper.
 *
 * **It presses.** `.lift` settles on the spring in `--ease-press`.
 *
 * The translation lives on a wrapper rather than on the anchor because the
 * anchor is a `next/link`, and wrapping keeps client-side navigation, prefetch
 * and the focus ring exactly as they were. Motion values drive it, so a mouse
 * crossing the button never causes a React render.
 */

import Link from "next/link";
import { m, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SETTLE } from "./motion-tokens";

/** Pixels of lean at the far corner of the hit area. */
const PULL = 5;

export interface CtaLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** `lg` for the hero and the closing band, `md` inside a section. */
  size?: "md" | "lg";
}

export function CtaLink({ href, children, className, size = "lg" }: CtaLinkProps) {
  const reduced = useReducedMotion();
  // The raw pair is what the pointer writes to; the springs read from them.
  // Setting a source-tracking spring directly is a no-op — it is overwritten
  // by its source on the next frame.
  const pullX = useMotionValue(0);
  const pullY = useMotionValue(0);
  const x = useSpring(pullX, SETTLE);
  const y = useSpring(pullY, SETTLE);

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    pullX.set(((event.clientX - box.left) / box.width - 0.5) * 2 * PULL);
    pullY.set(((event.clientY - box.top) / box.height - 0.5) * 2 * PULL);
  };

  const rest = () => {
    pullX.set(0);
    pullY.set(0);
  };

  return (
    // The padding is the magnet's reach: it puts the pointer inside the
    // wrapper a little before it is over the button. Pulled back out with a
    // negative margin so it costs the layout nothing.
    <m.span
      style={{ x, y }}
      onPointerMove={onPointerMove}
      onPointerLeave={rest}
      className="-m-2 inline-flex p-2"
    >
      <Link
        href={href}
        /* Tokens rather than `bg-sky-700 … dark:bg-sky-600`: white on sky-600
           is about 3.9:1, under the AA floor for 14px text. `--on-accent` is
           white in light and near-black in dark, so the pair passes in both
           themes rather than only the one anyone looked at. */
        className={cn(
          "bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent focus-visible:ring-offset-surface-1 sheen lift",
          "inline-flex items-center justify-center rounded-md font-medium shadow-[var(--shadow-accent)]",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          size === "lg" ? "px-7 py-3.5 text-[0.95rem]" : "px-5 py-2.5 text-sm",
          className,
        )}
      >
        {children}
      </Link>
    </m.span>
  );
}
