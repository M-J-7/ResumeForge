"use client";

/**
 * How far through the page you are, as a hairline under the header.
 *
 * Marketing routes only. `AppHeader` is global and `BuilderShell` computes a
 * full-height layout beneath it — a fixed element hung off the header would
 * follow that layout onto `/builder`, where there is no page scroll to report
 * and two pixels of accent across the top of a working document is noise.
 *
 * `useScroll` hands back a motion value, so nothing here re-renders as the
 * page moves; the spring only smooths the jump a trackpad's momentum produces
 * at the end of a flick.
 */

import { m, useReducedMotion, useScroll, useSpring } from "motion/react";

export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, { bounce: 0, visualDuration: 0.2 });

  return (
    <m.div
      aria-hidden
      // Tied directly to the scrollbar rather than playing on its own, so it
      // stays under reduced motion — it is a position readout. What goes is
      // the spring, which is the only part that moves on its own.
      style={{ scaleX: reduced ? scrollYProgress : smoothed }}
      className="bg-accent fixed inset-x-0 top-14 z-30 h-0.5 origin-left"
    />
  );
}
