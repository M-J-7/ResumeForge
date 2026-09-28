/**
 * The application header's markup (P22-E1), shared by both ways of knowing
 * who is reading it.
 *
 * There was no shared header before this. The landing page inlined a footer,
 * the dashboard hand-rolled a heading row with a sign-out form in it, and the
 * builder had no way back to anything. Every page now has one bar with the
 * same four jobs: say where you are, get you somewhere else, ask for the one
 * thing the product is for, and hold the theme control.
 *
 * Who is signed in is supplied, not read: `AppHeader` reads the session on the
 * server for the application routes, and `SiteHeader` asks from the browser on
 * the prerendered content pages. See those two for why there are two.
 *
 * ## What the shipped version added
 *
 * **A primary action.** The bar's strongest-looking control used to be "Sign
 * in" — an outlined button for the one thing this product goes out of its way
 * not to require — while `/builder` sat in the nav row as the first of five
 * identical grey links. It is a button now, and it is not also a nav link:
 * five equal-weight links, one of which is the thing the whole site is asking
 * you to do, is how a page ends up with no call to action at all.
 *
 * It is shown to guests only. Once there is an account the bar carries "My
 * resumes" and the dashboard has its own "Open the builder", so a third route
 * to the same place would be spending the width for nothing — and the width
 * is genuinely spent: six links, the theme control and an account state is
 * what the row has to fit at 1024px.
 *
 * **`/guides` in the bar.** Four indexed pages that were reachable only from
 * the footer, which is to say reachable only by a visitor who had already
 * scrolled past everything they were meant to help with.
 *
 * **The account, said out loud.** A bare "Sign out" button gave no
 * confirmation of *which* account you were signed into — the one question a
 * person with a work address and a personal one actually has. The initial
 * carries it as an image with a label, so it stays a statement rather than a
 * second control competing with the button beside it.
 *
 * **A skip link.** The first focusable element on every page, jumping past a
 * navigation row that a keyboard user would otherwise tab through on every
 * single route. Every `<main>` in the app carries the matching `id`.
 *
 * ## Height is a contract
 *
 * `h-14` is fixed and the header never grows. `BuilderShell` computes a
 * full-height three-column layout beneath it, the preview's scroll region
 * depends on knowing how much vertical space it has, and `ScrollProgress`
 * hangs its hairline at `top-14`. A header that reflowed — wrapping nav items
 * onto a second line on a narrow viewport, say — would silently shrink the
 * preview canvas.
 *
 * That contract used to be enforced with `overflow-hidden`, which kept the
 * height correct by clipping the navigation off the screen entirely on a
 * phone. `HeaderNav` now holds it properly: below `lg` the links live in an
 * absolutely-positioned panel, which cannot affect the bar's height whether
 * it is open or closed. `relative` here is what that panel is positioned
 * against.
 *
 * ## No directive, and nothing server-only
 *
 * This module is rendered by a server component (`AppHeader`) and by client
 * boundaries (`error.tsx`, through `SiteHeader`), so it can hold neither a
 * session read nor `"use client"`. Everything that varies arrives as a slot.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FileTextIcon } from "@/components/ui/icons";
import { PRODUCT_NAME } from "@/lib/product";
import { MAIN_CONTENT_ID } from "@/lib/nav";

export interface HeaderChromeProps {
  /**
   * Rendered first inside `<header>`, before anything that could construct a
   * storage key: this is where `<StorageOwner>` goes. See that component for
   * why it must come first.
   */
  before?: ReactNode;
  /** The navigation row — a `HeaderNav` with the links for this identity. */
  nav: ReactNode;
  /** The account controls — `HeaderAccount` for this identity. */
  account: ReactNode;
}

export function HeaderChrome({ before, nav, account }: HeaderChromeProps) {
  return (
    /*
     * Glass, and an opaque enough tint to hold contrast on its own.
     *
     * It was `bg-surface-0/85`. 85% is the point where the effect is obvious
     * and the contrast stops being guaranteed: what scrolls under this bar on
     * `/builder` is a sheet of white paper, and 15% of that coming through a
     * dark `--surface-0` lifts the ground under `--text-faint` below the AA
     * floor. `.glass` is 92%, which `palette.test.ts` measures against every
     * ground this can sit on, the white page included.
     *
     * `.header-rule` deepens the hairline as the page scrolls, in CSS, with
     * no scroll listener and nothing added to the builder's bundle.
     */
    <header className="border-line glass header-rule sticky top-0 z-40 h-14 shrink-0 border-b">
      {before}

      {/*
        First in the DOM, so it is the first thing a keyboard reaches on any
        route. `sr-only` until focused rather than hidden: a skip link that
        cannot be focused is not a skip link, and one that is always visible
        is a piece of chrome nobody asked for.
      */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="focus:bg-surface-0 focus:text-text focus:ring-accent sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-[var(--shadow-pop)] focus:ring-2 focus:outline-none"
      >
        Skip to content
      </a>

      <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="text-text focus-visible:ring-accent group flex shrink-0 items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          {/* The mark reacts to the pointer on the whole link rather than
              only over the 20px glyph, which is what makes a wordmark feel
              like one object instead of an icon sitting next to some text. */}
          <FileTextIcon className="text-accent h-5 w-5 transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:-rotate-6" />
          {/* Read from `lib/product.ts`, never written out here — choosing a
              name has to stay the one-line change that file promises, and the
              way that stops being true is a component hardcoding the string.
              `trust-signals.test.ts` asserts no surface does.

              `sr-only` below `sm`, not hidden: the wordmark plus the menu
              button, the theme control and the sign-in link overflow 390px
              together, and the wordmark is the one of the four that a phone
              can spare — the mark still identifies the product and the h1
              says the name. Hiding it outright would leave the link with no
              accessible name at all, which is why it stays in the tree. */}
          <span className="sr-only sm:not-sr-only">{PRODUCT_NAME}</span>
        </Link>

        {nav}

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />

          {/* A hairline between the setting and the account, so the right end
              of the bar reads as two groups rather than one run of controls.
              Hidden with the theme control's neighbours on a phone, where
              there is nothing on either side of it to separate. */}
          <span aria-hidden className="bg-line mx-1 hidden h-5 w-px sm:block" />

          {account}
        </div>
      </div>
    </header>
  );
}
