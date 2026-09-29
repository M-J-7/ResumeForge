/**
 * A small label above a thing, set in the machine's face.
 *
 * `design.md` §3.6 deleted the landing page's eyebrows and was right to: they
 * were tracked-out uppercase sans over every one of six identical bands, which
 * is decoration pretending to be structure. This is not that, and the
 * difference is the typeface.
 *
 * Monospace means one thing in this app — *a machine produced this* — and it
 * is never decorative. So an eyebrow here is only ever a **readout label**:
 * `recovered text`, `x-ray`, `extraction`. It names what a panel is showing,
 * in the voice of the thing that produced it. If a section head would say the
 * same words in sentence case, it does not need one of these.
 *
 * `aria-hidden` is deliberately *not* set. These carry real information — the
 * pane below is the parser's output and a screen reader should be told so —
 * which is the other half of the difference from an eyebrow that merely
 * repeats the heading under it.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-machine text-micro font-mono tracking-wider uppercase", className)}>
      {children}
    </span>
  );
}
