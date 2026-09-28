"use client";

/**
 * The bar's primary action, on the routes where it is one.
 *
 * The header had no call to action at all. The strongest-looking control in
 * it was "Sign in" — an outlined button for the thing the product explicitly
 * does not require — while the action the whole site argues for sat in the
 * nav row as the first of five identical grey links. That is the arrangement
 * every shipped product abandons early: a visitor who has read the landing
 * page and scrolled back up has nothing to press.
 *
 * Client-only because of `showsPrimaryCta`, which needs the current path.
 * `AppHeader` reads the session on the server and stays a server component;
 * this is the one leaf that has to know where it is.
 *
 * Styled by hand rather than reusing `CtaLink`. The marketing button is a
 * Motion component, and the header renders on `/builder` — pulling Motion
 * into that bundle to make a 36px button lean toward the pointer is not a
 * trade worth making. `.sheen` and `.lift` are CSS and come along for free,
 * so the press and the light sweep are the same as the landing page's.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA, showsPrimaryCta } from "@/lib/nav";

export function HeaderCta() {
  const pathname = usePathname();
  if (!showsPrimaryCta(pathname)) return null;

  return (
    <Link
      href={PRIMARY_CTA.href}
      className={cn(
        "bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent",
        // Shown from `sm` rather than at the disclosure breakpoint. A tablet
        // hides the nav row and so has room to spare; withholding the primary
        // action from 640px to 1024px would be giving that width back for
        // nothing. Below `sm` it moves into the menu panel, where the wordmark
        // has already gone `sr-only` to make room.
        "focus-visible:ring-offset-surface-0 sheen lift hidden items-center rounded-md",
        "px-3.5 py-1.5 text-sm font-medium shadow-[var(--shadow-accent)] sm:inline-flex",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      {PRIMARY_CTA.label}
    </Link>
  );
}
