"use client";

/**
 * Offering to move a guest draft onto the account (M2-T3).
 *
 * ## Why this is a prompt and not an automatic import
 *
 * The draft in IndexedDB may not be the user's most recent work — they may
 * have signed in on a shared machine, or on a device where they started
 * something and abandoned it. Silently copying whatever is in local storage
 * into their account creates a resume they did not ask for and cannot
 * distinguish from one they did.
 *
 * ## The ordering that makes it safe
 *
 * Read local → send to server → **wait for confirmation** → clear local. The
 * clear only happens on success, so every failure path — offline, expired
 * session, unmigratable document, the user closing the tab mid-request —
 * leaves the draft exactly where it was. M2-T3's acceptance is "no data loss
 * on any path including mid-flow abandonment", and this ordering is the
 * whole of how that is achieved.
 *
 * The draft store is constructed directly rather than going through
 * `useResumeStore`: the dashboard has no builder mounted, and pulling the
 * whole document store in to delete one key would also drag its history and
 * autosave timers along.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/control";
import { hasAnyContent } from "@/components/builder/progress";
import { documentWordCount } from "@/lib/lint/rules";
import { safeMigrate } from "@/lib/resume/migrate";
import { createDraftStore, idbBackend } from "@/store/persistence";
import { claimDraftAction } from "@/app/dashboard/actions";

type State =
  | { phase: "checking" }
  | { phase: "none" }
  | { phase: "offer"; serialized: string; summary: string }
  | { phase: "error"; message: string; serialized: string; summary: string }
  | { phase: "claimed"; title: string };

/** A one-line description of the draft, so the offer is about something. */
function describeDraft(fullName: string, wordCount: number): string {
  const who = fullName.trim();
  const words = `${wordCount} word${wordCount === 1 ? "" : "s"}`;
  return who ? `${who} — ${words}` : words;
}

export function ClaimDraftPrompt() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "checking" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const draft = await createDraftStore(idbBackend).read();
      if (cancelled) return;
      if (!draft) return setState({ phase: "none" });

      // Migrated only to decide whether the draft is worth offering. What
      // gets sent is the original bytes, so the server migrates the same
      // input rather than trusting a client-side transformation of it.
      const result = safeMigrate(draft.document);
      if (!result.ok || !hasAnyContent(result.document)) return setState({ phase: "none" });

      setState({
        phase: "offer",
        serialized: JSON.stringify(draft.document),
        // The same count the dashboard column will show, so the offer and
        // the row it becomes do not report different numbers.
        summary: describeDraft(
          result.document.contact.fullName,
          documentWordCount(result.document),
        ),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const claim = useCallback(
    (serialized: string, summary: string) => {
      startTransition(async () => {
        const result = await claimDraftAction(serialized);
        if (!result.ok) {
          setState({ phase: "error", message: result.error, serialized, summary });
          return;
        }
        // Only now is it safe to drop the local copy.
        await createDraftStore(idbBackend).clear();
        setState({ phase: "claimed", title: result.value.title });
        router.refresh();
      });
    },
    [router],
  );

  if (state.phase === "checking" || state.phase === "none") return null;

  if (state.phase === "claimed") {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      >
        Saved <strong className="font-medium">{state.title}</strong> to your account. It is no
        longer stored only in this browser.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-sky-300 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950">
      <div>
        <p className="text-sm font-medium text-sky-950 dark:text-sky-100">
          There is a resume saved in this browser
        </p>
        <p className="mt-1 text-sm text-sky-900 dark:text-sky-200">
          {state.summary}. Save it to your account and it will follow you between devices. Leave it
          and it stays in this browser only, which still works.
        </p>
      </div>

      {state.phase === "error" ? (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => claim(state.serialized, state.summary)}
        >
          {pending ? "Saving…" : "Save it to my account"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setState({ phase: "none" })}>
          Not now
        </Button>
      </div>
    </div>
  );
}
