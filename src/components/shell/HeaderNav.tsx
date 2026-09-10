"use client";

/**
 * The header's navigation, and the fix for a real bug.
 *
 * `AppHeader` used to set `overflow-hidden` on the nav to protect the height
 * contract it has with `BuilderShell` — the bar is `h-14` and must never grow,
 * because the preview pane's scroll region is computed from what is left below
 * it. That protected the contract by *clipping the links*: at 390px, Builder,
 * Templates, Examples and Check were present in the DOM, invisible, and
 * unreachable. There was no mobile menu to fall back to.
 *
 * This collapses them into a disclosure instead. The contract is kept the way
 * it should have been in the first place: the panel is absolutely positioned
 * below the bar, so opening it cannot add a pixel to the header's height.
 *
 * ## One set of links
 *
 * The obvious implementation renders the links twice — once for the desktop
 * row, once for the mobile panel — and that is what makes headers drift. Here
 * `LINKS` is walked once, into one `<ul>`, and only its *presentation* changes
 * at the breakpoint. It is also what keeps the accessible name count honest:
 * `auth.spec.ts` assumes there is exactly one control named "Sign out" on the
 * page, and a duplicated nav is how that assumption quietly stops being true.
 *
 * The panel stays mounted and animates on `opacity`/`transform` so it has a
 * real exit without `AnimatePresence`. That is deliberate: this component
 * renders on `/builder`, and Motion has no business in that bundle for
 * something CSS does exactly as well.
 *
 * ## Why the closed panel is hidden with `visibility`, and not with `inert`
 *
 * It used to carry `inert={!open}`, which reads correctly and was wrong in
 * the one case that matters. `open` is the *disclosure's* state, and above
 * `md` there is no disclosure — the links are an ordinary row that the menu
 * button never touches, so `open` sits at `false` forever. `inert` is a DOM
 * attribute and knows nothing about the breakpoint that reveals them, so
 * every desktop visitor got a navigation bar whose links rendered, hovered,
 * and did nothing at all when clicked.
 *
 * `visibility` is the fix because it is the one part of this that *is*
 * responsive: the closed panel is `invisible`, which already takes it out of
 * the tab order and out of the accessibility tree, and `md:visible` brings it
 * back on the breakpoint that makes it a row. One mechanism, driven by the
 * same media query as the layout, so the two cannot disagree again.
 *
 * It has to be named in the transition list for the exit to survive. CSS
 * gives `visibility` a special interpolation rule — when either end of the
 * transition is `visible`, the visible value holds for the whole duration —
 * so opening shows the panel immediately and closing keeps it painted until
 * the fade finishes. `transition` alone does not cover it, which is how a
 * `visibility` swap turns a 200ms exit into a disappearance.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "@/components/ui/icons";

export interface HeaderLinkSpec {
  href: string;
  label: string;
}

export function HeaderNav({ links }: { links: readonly HeaderLinkSpec[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  /*
   * Route changes close the menu. Without this it stays open over the page it
   * just navigated to, which reads as the navigation having failed.
   *
   * Adjusted during render rather than in an effect. The effect version is
   * the obvious one and `react-hooks/set-state-in-effect` rejects it, rightly:
   * it renders the new route with the menu still open, then immediately
   * re-renders to close it. This is React's documented pattern for resetting
   * state when an input changes, and it closes the menu in the same pass that
   * the new path arrives.
   */
  const [pathAtRender, setPathAtRender] = useState(pathname);
  if (pathAtRender !== pathname) {
    setPathAtRender(pathname);
    setOpen(false);
  }

  // Escape closes it, matching every other dismissible surface in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-accent",
          "-ml-1 shrink-0 rounded-md p-2 transition md:hidden",
          "focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <nav
        aria-label="Main"
        className="min-w-0 flex-1 md:flex md:items-center"
        data-open={open ? "" : undefined}
      >
        <ul
          id={panelId}
          className={cn(
            // Mobile: a panel hung off the bottom edge of the bar. Absolute,
            // so the header's h-14 is untouched whether it is open or not.
            "border-line bg-surface-0 absolute inset-x-0 top-full flex flex-col gap-0.5 border-b p-3",
            "shadow-[var(--shadow-pop)] duration-200 ease-[var(--ease)]",
            // `visibility` is named explicitly: it is what hides the closed
            // panel from the pointer and the tab order, and leaving it out of
            // the transition would cut the exit animation off at frame one.
            "transition-[opacity,transform,visibility]",
            open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
            // Desktop: an ordinary row, and none of the above applies.
            "md:visible md:static md:translate-y-0 md:flex-row md:gap-1 md:border-0 md:p-0",
            "md:opacity-100 md:shadow-none",
          )}
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-accent relative block rounded-md px-3 py-2 text-sm font-medium",
                    "transition-colors duration-[var(--dur-fast)] whitespace-nowrap",
                    "focus-visible:ring-2 focus-visible:outline-none",
                    "md:px-2.5 md:py-1.5",
                    active
                      ? "text-text bg-surface-2 md:bg-transparent"
                      : "text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  {link.label}
                  {/*
                    The active marker, desktop only. It sits on the header's
                    bottom hairline rather than under the label, so the row of
                    links reads as tabs against the page below it.
                  */}
                  {active ? (
                    <span
                      aria-hidden
                      className="bg-accent absolute -bottom-[19px] left-2.5 right-2.5 hidden h-0.5 rounded-full md:block"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
