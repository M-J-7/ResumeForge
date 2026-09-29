/**
 * The button's classes, without the button — and without `"use client"`.
 *
 * This is a pure string function and it used to live in `control.tsx`, which
 * is a client module. That is fine for every caller inside the builder and
 * fails the moment a *server* component wants a link that looks like a
 * button: React refuses to call a function exported from a client module on
 * the server, and the route renders its error boundary instead. `/not-found`
 * did exactly that — the 404 page showed "Something went wrong", which is
 * about the worst possible way for this to fail.
 *
 * So the styling lives here, where both sides can reach it, and `control.tsx`
 * re-exports it for the dozens of existing imports.
 *
 * A link that navigates is an `<a>`, not a `<button>` with a router call —
 * landmine 9, and the reason `useRouter()` is avoided for cross-route links.
 * But a link that *looks* like a button should not re-type the classes,
 * because then the two drift. `Button` in `control.tsx` is this function plus
 * an element.
 */

import { cn } from "@/lib/utils";

/**
 * The focus ring, in one place.
 *
 * Colours come from the tokens in `globals.css`, not from Tailwind's palette,
 * which is what makes the accent one line in one file rather than forty-odd
 * literals — and what makes the dark variants follow the theme toggle rather
 * than only the OS.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

export const buttonVariants = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover disabled:hover:bg-accent",
  secondary: "border-line-strong bg-surface-0 text-text hover:bg-surface-2 border",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  danger: "border-danger/40 bg-surface-0 text-danger hover:bg-danger-weak border",
} as const;

export const buttonSizes = {
  sm: "h-8 px-2.5 text-xs",
  md: "px-3 py-2 text-sm",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    focusRing,
    buttonSizes[size],
    buttonVariants[variant],
    className,
  );
}
