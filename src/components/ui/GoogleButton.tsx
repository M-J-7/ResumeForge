"use client";

/**
 * The "Sign in with Google" button (P20-C2).
 *
 * Not a styling preference. Google's branding guidelines are a condition of
 * OAuth app verification: the official mark, its proportions preserved, one
 * of the approved label strings, and placement at least as prominent as the
 * other sign-in options on the page. A generic grey button reading "Continue
 * with Google" satisfies none of that, and it is also the thing users notice
 * — a Google login that does not look like every other Google login reads as
 * a phishing page even when it is the real one.
 *
 * ## Why the logo is inline SVG
 *
 * `next.config.ts` sets `img-src 'self' data: blob:` and no external origin.
 * Google's hosted button asset, and the Google Identity Services script that
 * would normally render this, are both unreachable under that policy — by
 * design, since the same directive is what makes "no third-party analytics on
 * builder routes" structural rather than a promise (§9). So the mark ships as
 * markup. It is Google's four-colour "G", reproduced unmodified; the
 * guidelines permit exactly that and forbid recolouring it, which is why this
 * is the one place in the codebase where an icon carries `fill` values
 * instead of `currentColor`.
 *
 * ## Colours are Google's, not the design system's
 *
 * The values below are from the branding guidelines and deliberately do not
 * read from the theme tokens. They are a third party's brand, not our
 * palette, and a token change must not silently alter them. The only thing
 * the theme decides is *which* approved variant is shown.
 */

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Google's mark at its published proportions.
 *
 * `aria-hidden` because the button's own text is the accessible name. A
 * second name here would produce "Google Continue with Google" in a screen
 * reader.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export interface GoogleButtonProps extends Omit<ComponentProps<"button">, "children"> {
  /**
   * One of Google's approved strings. "Continue with Google" is the default
   * and is what `e2e/auth.spec.ts` asserts by exact name — changing it is a
   * test change, not a copy change.
   */
  label?: "Sign in with Google" | "Sign up with Google" | "Continue with Google";
  /** Shown in place of the label while the redirect is in flight. */
  pendingLabel?: string;
  pending?: boolean;
}

export function GoogleButton({
  className,
  label = "Continue with Google",
  pendingLabel = "Redirecting…",
  pending = false,
  disabled,
  ...props
}: GoogleButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled ?? pending}
      className={cn(
        // 40px minimum height and 12px horizontal padding are from the
        // guidelines; the mark must not be crowded.
        "inline-flex h-10 w-full items-center justify-center gap-3 rounded-md px-3",
        "text-sm font-medium transition",
        // Google specifies Roboto Medium. It is not vendored — the CSP allows
        // no external font origin, and vendoring a whole family for one
        // button is not a trade worth making — so the stack degrades to the
        // UI face, which the guidelines permit.
        "font-[Roboto,var(--font-geist-sans),system-ui,sans-serif]",
        // Light variant: white surface, #747775 border, #1F1F1F text.
        "border border-[#747775] bg-white text-[#1F1F1F] hover:bg-[#f8f9fa]",
        // Dark variant: #131314 surface, #8E918F border, #E3E3E3 text.
        "dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1e1f20]",
        "focus-visible:ring-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <GoogleMark />
      {/* The text is the button's accessible name — the mark is aria-hidden.
          While pending it becomes `pendingLabel`, which is why the e2e suite
          looks for this button before submitting rather than after. */}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}
