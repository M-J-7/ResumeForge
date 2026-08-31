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
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          There is nothing at this address
        </h1>
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The link may be out of date, or the page may have moved. Your draft is untouched — it lives
        in this browser and is not affected by a wrong URL.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/builder"
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          Open the builder
        </Link>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
