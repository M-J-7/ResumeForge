/**
 * 404.
 *
 * Offers the two things a person who lands here actually wants — the builder
 * and the way back — rather than apologising at length. Nothing about the
 * missing path is echoed back: reflecting a URL onto a page is how a 404
 * becomes a phishing surface.
 *
 * It opens with the same band every other route does. A 404 that looks like a
 * different website is the one that makes a visitor assume the whole site is
 * broken rather than that one link was.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Band, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/Band";
import { buttonClassName } from "@/components/ui/button-style";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {/*
          `Band`, not `PageHeader`, and the reason is a hard gate rather than
          taste. Next renders the root `not-found.tsx` inside the root layout,
          so it is in the client component graph of **every** route under it —
          `/builder` included. `PageHeader` carries `MotionProvider` and the
          ambient field, so importing it here put Motion's 156 kB chunk on the
          builder's critical path. `Band` is the same chrome with no client
          code at all.
        */}
        <Band stage containerClassName="max-w-2xl">
          {/* The status code in the machine's face, because that is whose word
              it is — and it is the one thing a visitor who already knows what a
              404 is wants to see confirmed. */}
          <p className="text-machine text-micro font-mono tracking-wider uppercase">404</p>
          <h1 className={cn(PAGE_TITLE_CLASS, "mt-3")}>There is nothing at this address</h1>
          <p className={cn(PAGE_LEAD_CLASS, "mt-5")}>
            The link may be out of date, or the page may have moved. Your draft is untouched &mdash;
            it lives in this browser and is not affected by a wrong URL.
          </p>
        </Band>

        <div className="py-band-tight mx-auto w-full max-w-2xl px-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/builder" className={buttonClassName({ variant: "primary" })}>
              Open the builder
            </Link>
            <Link href="/" className={buttonClassName()}>
              Back to the home page
            </Link>
          </div>
        </div>
      </main>

      {/* A 404 is the one page where a sitemap is the whole point: the visitor
          asked for something that is not here, and the footer is the cheapest
          list of what is. */}
      <AppFooter />
    </>
  );
}
