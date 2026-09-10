"use client";

/**
 * A rule that fills as you read past it.
 *
 * "How it works" is the one section on this page whose content genuinely is a
 * sequence — which is why it keeps its numbers, and why it gets the one piece
 * of scroll-linked motion on the page. The spine is the sequence, drawn: it
 * fills left to right as the three steps come up, so the section is showing
 * its own progress rather than describing it.
 *
 * `useScroll` returns a motion value and the fill is `scaleX`, so no part of
 * this touches layout or causes a render while the page moves. Under reduced
 * motion the rule is simply full, which is what it would have been anyway.
 */

import { m, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GLIDE } from "./motion-tokens";

export function ScrollSpine({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Starts filling as the steps clear the lower fifth of the viewport and is
  // full a little before the last one leaves the top — the fill tracks
  // reading, not the geometric centre of the element.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 65%"] });
  const fill = useSpring(scrollYProgress, GLIDE);

  return (
    <div ref={ref} className={className}>
      <div className="bg-line relative h-px w-full">
        <m.div
          aria-hidden
          style={{ scaleX: reduced ? 1 : fill }}
          className={cn("bg-accent absolute inset-0 h-px origin-left")}
        />
      </div>
      {children}
    </div>
  );
}
