"use client";

/**
 * One Motion feature bundle for the whole marketing page.
 *
 * `LazyMotion` + `m` is 4.6kb against the 34kb the full `motion` component
 * pulls in, and `domAnimation` — animations, variants, exit and the pointer
 * gestures — is everything these pages use. Layout animations and drag are
 * in `domMax` and are deliberately not loaded: nothing here animates layout,
 * because layout animation on a page this long is how a marketing site starts
 * dropping frames on a mid-range phone.
 *
 * `strict` is what keeps that true. It throws if a full `motion` component
 * renders underneath, which is the one mistake that silently undoes the
 * saving — a single `motion.div` imported by habit puts the whole bundle back.
 *
 * Children are server components. This wrapper renders around an
 * already-built tree, so the page's copy is still server-rendered and still
 * in the HTML a crawler receives.
 */

import { LazyMotion, domAnimation } from "motion/react";
import type { ReactNode } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
