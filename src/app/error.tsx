"use client";

/**
 * The route-level error boundary.
 *
 * The single most important thing this page says is that the draft is safe.
 * Someone who has spent forty minutes writing a resume and hits an error
 * screen assumes they have lost it, and the reasonable response to that
 * assumption is to close the tab — which is the one action that would make
 * the fear come true if an autosave were still pending.
 *
 * `digest` is shown because it is the only thing that connects what the user
 * saw to a line in the server log. Nothing else about the error is rendered:
 * a message from the server can carry a query, a path, or a parameter, and
 * `src/server/logging.ts` exists precisely because those can contain the
 * resume.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console only. Next has already reported it server-side, and
    // the client is not a place to send anything anywhere (§9).
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>

      <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        <strong className="font-medium">Your resume is safe.</strong> It is stored in this browser
        and was saved as you typed. Nothing here has deleted or altered it.
      </p>

      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Try again — most of these are momentary. If it keeps happening, the builder itself usually
        still works.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          Try again
        </button>
        <Link
          href="/builder"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Back to the builder
        </Link>
      </div>

      {error.digest ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Reference <code className="font-mono">{error.digest}</code> — quote this if you report it.
        </p>
      ) : null}
    </main>
  );
}
