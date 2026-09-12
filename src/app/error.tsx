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
      <h1 className="text-text text-2xl font-semibold">Something went wrong</h1>

      <p className="rounded-md border border-ok/40 bg-ok-weak px-3 py-2 text-sm text-text">
        <strong className="font-medium">Your resume is safe.</strong> It is stored in this browser
        and was saved as you typed. Nothing here has deleted or altered it.
      </p>

      <p className="text-muted text-sm leading-relaxed">
        Try again — most of these are momentary. If it keeps happening, the builder itself usually
        still works.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Try again
        </button>
        <Link
          href="/builder"
          className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent rounded-md border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to the builder
        </Link>
      </div>

      {error.digest ? (
        <p className="text-faint text-xs">
          Reference <code className="font-mono">{error.digest}</code> — quote this if you report it.
        </p>
      ) : null}
    </main>
  );
}
