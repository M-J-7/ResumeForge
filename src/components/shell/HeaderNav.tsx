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
 * the array is walked once, into one `<ul>`, and only its *presentation*
 * changes at the breakpoint. It is also what keeps the accessible name count
 * honest: `auth.spec.ts` assumes there is exactly one control named "Sign
 * out" on the page, and a duplicated nav is how that assumption quietly stops
 * being true.
 *
 * The panel stays mounted and animates on `opacity`/`transform` so it has a
 * real exit without `AnimatePresence`. That is deliberate: this component
 * renders on `/builder`, and Motion has no business in that bundle for
 * something CSS does exactly as well. The call to action here is a plain
 * styled `Link` for the same reason, rather than the marketing `CtaLink`.
 *
 * ## The breakpoint moved from `md` to `lg`
 *
 * The bar now carries five links, the theme control, an account state and a
 * primary action. At 768px those fit only by having nothing between them, and
 * a nav row touching a button is the visual signature of a header nobody
 * looked at below a laptop. A tablet gets the disclosure, which is what every
 * shipped product of this shape does.
 *
 * ## Why the closed panel is hidden with `visibility`, and not with `inert`
 *
 * It used to carry `inert={!open}`, which reads correctly and was wrong in
 * the one case that matters. `open` is the *disclosure's* state, and above
 * the breakpoint there is no disclosure — the links are an ordinary row that
 * the menu button never touches, so `open` sits at `false` forever. `inert`
 * is a DOM attribute and knows nothing about the media query that reveals
 * them, so every desktop visitor got a navigation bar whose links rendered,
 * hovered, and did nothing at all when clicked.
 *
 * `visibility` is the fix because it is the one part of this that *is*
 * responsive: the closed panel is `invisible`, which already takes it out of
 * the tab order and out of the accessibility tree, and `lg:visible` brings it
 * back on the breakpoint that makes it a row. One mechanism, driven by the
 * same media query as the layout, so the two cannot disagree again.
 *
 * It has to be named in the transition list for the exit to survive. CSS
 * gives `visibility` a special interpolation rule — when either end of the
 * transition is `visible`, the visible value holds for the whole duration —
 * so opening shows the panel immediately and closing keeps it painted until
 * the fade finishes. `transition` alone does not cover it, which is how a
 * `visibility` swap turns a 200ms exit into a disappearance.
 *
 * ## The active marker sits on the header's own hairline
 *
 * It used to be a rule offset `-19px` from a link box whose height came from
 * `py-1.5` and a 14px line box — a number that landed five pixels below the
 * bottom of the header and would have moved again the next time anyone
 * touched the padding. The desktop links are full-height flex items now, so
 * `bottom-0` *is* the hairline and there is no arithmetic left to go stale.
 * The same span doubles as the hover affordance: inactive it is the hairline
 * colour at `scaleX(0)`, growing from the left on hover, which is the gesture
 * `.rule-grow` makes everywhere else in the app.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "@/components/ui/icons";
import { PRIMARY_CTA, showsPrimaryCta, type NavLink } from "@/lib/nav";

export type HeaderLinkSpec = NavLink;

export interface HeaderNavProps {
  links: readonly HeaderLinkSpec[];
  /**
   * Whether the panel closes with the primary action.
   *
   * Passed rather than derived, because the answer is the session and this is
   * a client component. `AppHeader` shows the bar's copy to guests only — the
   * signed-in bar already carries "My resumes" — and the panel has to agree
   * with it, or the same visitor gets the button on a phone and not on a
   * laptop for no reason they could name.
   */
  showCta?: boolean;
}

export function HeaderNav({ links, showCta = true }: HeaderNavProps) {
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
          "-ml-1 shrink-0 rounded-md p-2 transition lg:hidden",
          "focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <nav
        aria-label="Main"
        className="min-w-0 flex-1 lg:flex lg:h-full lg:items-stretch"
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
            // Desktop: a full-height row of tabs, and none of the above
            // applies. `items-stretch` is what lets a link fill the bar, so
            // its marker can land on the hairline with no magic number.
            "lg:visible lg:static lg:h-full lg:translate-y-0 lg:flex-row lg:items-stretch",
            "lg:gap-0.5 lg:border-0 lg:p-0 lg:opacity-100 lg:shadow-none",
          )}
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href} className="lg:flex lg:h-full">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group focus-visible:ring-accent relative block rounded-md px-3 py-2 text-sm font-medium",
                    "whitespace-nowrap transition-colors duration-[var(--dur-fast)]",
                    "focus-visible:ring-2 focus-visible:outline-none",
                    "lg:flex lg:h-full lg:items-center lg:rounded-none lg:px-3 lg:py-0",
                    active
                      ? "text-text bg-surface-2 lg:bg-transparent"
                      : "text-muted hover:bg-surface-2 hover:text-text lg:hover:bg-transparent",
                  )}
                >
                  {link.label}
                  {/*
                    The active marker, desktop only, sitting on the header's
                    bottom hairline so the row reads as tabs against the page
                    below it. Inactive it is the same rule at zero width, so a
                    hover previews where you are about to be — one element
                    doing both jobs, which is also why the two states cannot
                    drift apart.
                  */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 bottom-0 hidden h-[2px] origin-left rounded-full lg:block",
                      "transition-transform duration-[var(--dur)] ease-[var(--ease)]",
                      active
                        ? "bg-accent scale-x-100"
                        : "bg-line-strong scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100",
                    )}
                  />
                </Link>
              </li>
            );
          })}

          {/*
            The primary action, inside the panel. On the bar it lives in the
            actions group at the far right (see `AppHeader`); at this width
            there is no room for it beside the theme control and the account
            state, and a menu listing every destination except the one the
            product is asking for is the usual mobile-header mistake.

            `sm:hidden`, not `lg:hidden`: the bar's copy appears at `sm`, so
            below that breakpoint is exactly the range where this is the only
            copy there is. Hidden on the route it points at, for the same
            reason the bar copy is — a call to action for the page you are
            already on is noise.
          */}
          {showCta && showsPrimaryCta(pathname) ? (
            <li className="border-line mt-2 border-t pt-3 sm:hidden">
              <Link
                href={PRIMARY_CTA.href}
                className={cn(
                  "bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent",
                  "focus-visible:ring-offset-surface-0 sheen lift block rounded-md px-4 py-2.5",
                  "text-center text-sm font-medium shadow-[var(--shadow-accent)]",
                  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                )}
              >
                {PRIMARY_CTA.label}
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}
