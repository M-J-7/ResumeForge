"use client";

/**
 * The band every reading page opens with.
 *
 * Before this, `/templates`, `/check`, `/examples` and `/guides` all began
 * with a 30px sans heading on the flat app ground — the same opening the
 * landing page had before the redesign, and the reason clicking a nav link
 * felt like leaving the product for its documentation. One shared band fixes
 * that in one place: the workbench grid, a single soft light, display type,
 * and the same build-on-load the landing hero uses.
 *
 * It carries `MotionProvider` itself, so a page that wants nothing else from
 * Motion does not have to know Motion exists. Children are server-rendered
 * and passed through, so the copy stays in the page file where it belongs and
 * is still in the HTML a crawler reads.
 *
 * Wrap each line in `Built` to have it arrive; anything not wrapped is simply
 * present, which is the right default for a page with one line of intro.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "./AmbientBackground";
import { BuildGroup } from "./Build";
import { MotionProvider } from "./MotionProvider";

export interface PageHeaderProps {
  children: ReactNode;
  /** Width of the content column. Match the body below it. */
  containerClassName?: string;
  className?: string;
}

export function PageHeader({ children, containerClassName, className }: PageHeaderProps) {
  return (
    <section
      className={cn("border-line relative border-b px-6 pt-12 pb-10 sm:pt-16 sm:pb-14", className)}
    >
      <MotionProvider>
        {/* The page's whole ground, mounted once. It is fixed and sits behind
            everything, so it belongs to the page rather than to this band —
            this is simply the one component every reading page already
            renders exactly once. */}
        <AmbientBackground />
        <BuildGroup
          trigger="load"
          stagger={0.08}
          className={cn("mx-auto w-full max-w-5xl", containerClassName)}
        >
          {children}
        </BuildGroup>
      </MotionProvider>
    </section>
  );
}

/** The heading treatment the band exists for. Display face, fluid size. */
export const PAGE_TITLE_CLASS =
  "font-display text-text text-[clamp(2rem,4.4vw,3rem)] leading-[1.06] font-semibold tracking-tight text-balance";
