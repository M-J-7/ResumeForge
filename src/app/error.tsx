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
 *
 * ## Why this one does not adopt `PageHeader`
 *
 * Every other route opens with the shared band. This is the boundary that
 * catches a render failure, and `PageHeader` mounts `MotionProvider`, the
 * ambient field and four client components — if the thing that threw *was* in
 * that tree, the error page throws too and the visitor gets Next's stock
 * screen instead of the one sentence that matters ("your resume is safe").
 *
 * So it takes the type tokens and the shared button classes and stops there.
 * A boundary should depend on as little as it can get away with.
 */

import { useEffect } from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button-style";
import { SiteHeader } from "@/components/shell/SiteHeader";

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
    <>
      {/* This boundary sits above both route groups, so the group layout —
          and its header — is what it replaces. The browser-side header is
          the one that cannot itself be the thing that failed on the server. */}
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16"
      >
        <h1 className="text-text text-display-3 font-semibold">Something went wrong</h1>

        <p className="border-ok/40 bg-ok-weak text-text text-small elev-1 rounded-md border px-3 py-2">
          <strong className="font-medium">Your resume is safe.</strong> It is stored in this browser
          and was saved as you typed. Nothing here has deleted or altered it.
        </p>

        <p className="text-muted text-body leading-relaxed">
          Try again — most of these are momentary. If it keeps happening, the builder itself usually
          still works.
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className={buttonClassName({ variant: "primary" })}>
            Try again
          </button>
          <Link href="/builder" className={buttonClassName()}>
            Back to the builder
          </Link>
        </div>

        {error.digest ? (
          <p className="text-faint text-small">
            Reference <code className="font-mono">{error.digest}</code> — quote this if you report
            it.
          </p>
        ) : null}
      </main>
    </>
  );
}
