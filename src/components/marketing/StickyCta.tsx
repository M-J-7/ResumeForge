"use client";

/**
 * The ask, brought back once the hero has gone.
 *
 * A visitor who reads the whole argument — the evidence, the promises, the
 * refusals — arrives at the bottom of a long page with the primary action
 * three thousand pixels behind them. The closing band answers that, and this
 * answers the middle: from the moment the hero leaves the viewport there is
 * always one thing to press.
 *
 * ## The four things that stop it being an annoyance
 *
 * **It is dismissible, and the dismissal sticks for the session.** A bar you
 * cannot close is an interstitial with better manners.
 *
 * **It does not trap focus.** It is a `<div>` with two controls in normal
 * document order at the end of the page, not a dialog. Tab reaches it after
 * the content, which is where something that appeared after the content
 * belongs.
 *
 * **It respects `showsPrimaryCta()`.** The same rule the header follows: never
 * offer a button that navigates to the page you are on.
 *
 * **It never covers the last line of the page.** The page that mounts it pads
 * below its footer — a bar pinned over the footer's legal links is the exact
 * failure that makes people hate these.
 *
 * ## Motion
 *
 * `y` and `clipPath`, never `opacity`: axe scans this route mid-flight in both
 * themes and text caught part-way through a fade measures as a contrast
 * failure. It carries `data-build`, so the reduced-motion rule in
 * `globals.css` and the `<noscript>` rule in `layout.tsx` both reach it.
 *
 * Under reduced motion it is simply present once the hero has gone, with no
 * arrival — which is the finished page rather than a fast version of the
 * animated one.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { XIcon } from "@/components/ui/icons";
import { PRIMARY_CTA, showsPrimaryCta } from "@/lib/nav";
import { EASE_SOFT } from "./motion-tokens";

export interface StickyCtaProps {
  /** The line beside the button. Short: this is a reminder, not a pitch. */
  children: ReactNode;
  /**
   * The element whose leaving the viewport reveals the bar. Given as an id so
   * the page keeps deciding what "past the hero" means.
   */
  after: string;
}

export function StickyCta({ children, after }: StickyCtaProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [past, setPast] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const anchor = document.getElementById(after);
    if (!anchor) return;
    // One observer on one element. `IntersectionObserver` rather than a
    // scroll listener: the browser does the work off the main thread and the
    // callback fires twice for the life of the page instead of every frame.
    const observer = new IntersectionObserver(([entry]) => setPast(!entry?.isIntersecting), {
      // Fires as the hero's last pixel passes under the sticky header rather
      // than when its box technically leaves the viewport.
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [after]);

  const shown = past && !dismissed && showsPrimaryCta(pathname);

  return (
    <AnimatePresence>
      {shown ? (
        <m.div
          data-build=""
          initial={reduced ? false : { y: 72, clipPath: "inset(100% 0% 0% 0%)" }}
          animate={{ y: 0, clipPath: "inset(0% 0% 0% 0%)" }}
          exit={reduced ? undefined : { y: 72, clipPath: "inset(100% 0% 0% 0%)" }}
          transition={{ duration: 0.4, ease: EASE_SOFT }}
          className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4"
        >
          <div className="glass border-line elev-1 mx-auto flex w-full max-w-3xl items-center gap-4 rounded-xl border px-4 py-3">
            <p className="text-text text-small min-w-0 flex-1 font-medium">{children}</p>

            <Link
              href={PRIMARY_CTA.href}
              className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent focus-visible:ring-offset-surface-0 sheen lift inline-flex shrink-0 items-center rounded-md px-4 py-2 text-sm font-medium shadow-[var(--shadow-accent)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {PRIMARY_CTA.label}
            </Link>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              /* A real name, not an icon with a tooltip. "Dismiss" alone is
                 ambiguous when a page has several dismissible things; naming
                 the thing is what makes the button usable out of context. */
              aria-label="Dismiss this reminder"
              className="text-faint hover:text-text hover:bg-surface-2 focus-visible:ring-accent -mr-1 inline-flex shrink-0 items-center justify-center rounded-md p-2 transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
            >
              <XIcon aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
