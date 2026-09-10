/**
 * 404.
 *
 * Offers the two things a person who lands here actually wants — the builder
 * and the way back — rather than apologising at length. Nothing about the
 * missing path is echoed back: reflecting a URL onto a page is how a 404
 * becomes a phishing surface.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-faint text-sm font-medium">404</p>
        <h1 className="text-text mt-1 text-2xl font-semibold">There is nothing at this address</h1>
      </div>
      <p className="text-muted text-sm leading-relaxed">
        The link may be out of date, or the page may have moved. Your draft is untouched — it lives
        in this browser and is not affected by a wrong URL.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/builder"
          className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Open the builder
        </Link>
        <Link
          href="/"
          className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent rounded-md border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
