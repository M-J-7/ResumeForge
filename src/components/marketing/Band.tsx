/**
 * The opening band, without the motion.
 *
 * `PageHeader` is this plus `MotionProvider`, the ambient field and a
 * `BuildGroup`, and for every reading page that is the right trade. For two
 * callers it is not:
 *
 * **`/not-found`.** Next renders the root `not-found.tsx` inside the root
 * layout, which means it is part of the client component graph of **every
 * route under that layout — `/builder` included**. Importing `PageHeader`
 * there put Motion's 156 kB chunk on the builder's critical path, which
 * `docs/REDESIGN.md` names as a hard gate: *Motion must not enter the builder
 * bundle.* It was found by diffing the chunks the two routes request, not by
 * reading the imports, because nothing about the import looks wrong.
 *
 * **Anything server-rendered that wants the band.** This is a server
 * component. No `"use client"`, no hooks, no bundle.
 *
 * So the chrome lives here and `PageHeader` composes it. The two cannot drift,
 * because there is only one of them.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BandProps {
  children: ReactNode;
  /** Width of the content column. Match the body below it. */
  containerClassName?: string;
  className?: string;
  /**
   * Make this band a dark stage over a light body.
   *
   * The deliberate exception in the redesign, and it is for `/examples` and
   * `/guides`: they are the pages a stranger reaches from a search, and
   * long-form reading on near-black is a real comprehension cost. A route that
   * should be dark *throughout* puts `data-stage="dark"` on its own `<main>`
   * instead, which the `:has()` half of the scope in `globals.css` carries
   * onto `<body>` and the sticky header.
   */
  stage?: boolean;
  /**
   * The voice the band's top-edge light is in.
   *
   * `machine` on the parser's own pages — `/check` is the machine's page, and
   * lighting it in the accent would be claiming the wrong voice for it.
   */
  lit?: "accent" | "machine";
}

export function Band({
  children,
  containerClassName,
  className,
  stage,
  lit = "accent",
}: BandProps) {
  return (
    <section
      data-stage={stage ? "dark" : undefined}
      className={cn(
        "border-line band-lit relative border-b px-6 pt-12 pb-10 sm:pt-16 sm:pb-14",
        className,
      )}
      style={lit === "machine" ? { ["--band-tint" as string]: "var(--machine)" } : undefined}
    >
      <div className={cn("mx-auto w-full max-w-5xl", containerClassName)}>{children}</div>
    </section>
  );
}

/** The heading treatment the band exists for. Display face, fluid size. */
export const PAGE_TITLE_CLASS = "font-display text-text text-display-2 text-balance";

/** The line under a page title. One measure, one size, everywhere. */
export const PAGE_LEAD_CLASS = "text-muted text-body-l max-w-measure";
