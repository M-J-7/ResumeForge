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
 *
 * ## Whose draft it may offer (§10.1)
 *
 * This component was the escalation path of the shared-storage bug. It read
 * one fixed key on dashboard mount and offered whatever was in it — with the
 * previous person's real name rendered in the summary — to whoever was
 * signed in now, one click from copying it into their account.
 *
 * It now reads two slots by name, and no others: `guest`, and the signed-in
 * user's own. Those are the only two this browser is allowed to hold work in,
 * and a slot belonging to anybody else is not merely skipped here — it has
 * already been deleted by `purgeForeignStorage`.
 *
 * Both are needed, and the guest one is preferred when both exist. The guest
 * slot is the one that would otherwise be stranded, which is the flow this
 * prompt was built for: build something with no account, sign in, keep it.
 * The owner's own slot matters because `/builder` with no `?resume=` is a
 * real and linked-to path for a signed-in user — the dashboard's own "Open
 * the builder" link goes there — and the work typed into it syncs nowhere
 * until it is adopted. Reading only `guest` would have quietly stranded it.
 *
 * ## "Not now" has to stick
 *
 * It used to be `setState` alone, so it survived until the next render of the
 * dashboard and no longer — every visit re-offered the same draft, and after
 * a sign-out and a different sign-in it re-offered it to somebody else. The
 * dismissal is recorded against the draft's `savedAt`, so declining is
 * permanent for *that* draft and a guest who goes back and does more work
 * still gets asked about the new version.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/control";
import { hasAnyContent } from "@/components/builder/progress";
import { documentWordCount } from "@/lib/lint/rules";
import { safeMigrate } from "@/lib/resume/migrate";
import { createDraftStore, idbBackend, STORAGE_KEY, type DraftStore } from "@/store/persistence";
import { GUEST_OWNER, namespacedKey } from "@/store/owner";
import { CLAIM_DRAFT_DISMISSED_KEY } from "@/store/purge";
import { claimDraftAction } from "@/app/dashboard/actions";

type State =
  | { phase: "checking" }
  | { phase: "none" }
  | { phase: "offer"; serialized: string; summary: string; savedAt: number; key: string }
  | {
      phase: "error";
      message: string;
      serialized: string;
      summary: string;
      savedAt: number;
      key: string;
    }
  | { phase: "claimed"; title: string; id: string };

/**
 * The two slots this prompt may read, in the order it prefers them.
 *
 * Built per call rather than held in a module constant, so the owner's key is
 * resolved after `<StorageOwner>` has published the identity rather than at
 * import time — when it would still be `guest`.
 */
function claimableStores(): { key: string; store: DraftStore }[] {
  const guest = namespacedKey(STORAGE_KEY, GUEST_OWNER);
  const mine = namespacedKey(STORAGE_KEY);
  const keys = mine === guest ? [guest] : [guest, mine];
  return keys.map((key) => ({ key, store: createDraftStore(idbBackend, { key }) }));
}

/**
 * Where "Not now" is remembered.
 *
 * `localStorage` rather than the key-value store: it is a one-word UI
 * preference read synchronously during a decision that is already awaiting
 * IndexedDB, and adding a second async read to answer it would make the
 * prompt flash in and back out. Namespaced like everything else, so
 * declining on one account does not silence the offer on another.
 */
function isDismissed(savedAt: number): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(namespacedKey(CLAIM_DRAFT_DISMISSED_KEY)) === String(savedAt);
  } catch {
    // Private browsing. Asking again is a small annoyance; failing the
    // dashboard over a dismissal marker would not be.
    return false;
  }
}

function rememberDismissal(savedAt: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(namespacedKey(CLAIM_DRAFT_DISMISSED_KEY), String(savedAt));
  } catch {
    // Best effort; the offer is hidden for this session regardless.
  }
}

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
      for (const { key, store } of claimableStores()) {
        const draft = await store.read();
        if (cancelled) return;
        if (!draft) continue;
        if (isDismissed(draft.savedAt)) continue;

        // Migrated only to decide whether the draft is worth offering. What
        // gets sent is the original bytes, so the server migrates the same
        // input rather than trusting a client-side transformation of it.
        const result = safeMigrate(draft.document);
        if (!result.ok || !hasAnyContent(result.document)) continue;

        return setState({
          phase: "offer",
          key,
          savedAt: draft.savedAt,
          serialized: JSON.stringify(draft.document),
          // The same count the dashboard column will show, so the offer and
          // the row it becomes do not report different numbers.
          summary: describeDraft(
            result.document.contact.fullName,
            documentWordCount(result.document),
          ),
        });
      }
      setState({ phase: "none" });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setState((previous) => {
      if (previous.phase === "offer" || previous.phase === "error") {
        rememberDismissal(previous.savedAt);
      }
      return { phase: "none" };
    });
  }, []);

  const claim = useCallback(
    (offer: { serialized: string; summary: string; savedAt: number; key: string }) => {
      const { serialized, summary, savedAt, key } = offer;
      startTransition(async () => {
        const result = await claimDraftAction(serialized);
        if (!result.ok) {
          setState({ phase: "error", message: result.error, serialized, summary, savedAt, key });
          return;
        }
        // Only now is it safe to drop the local copy — and only the slot the
        // offer actually came from, never both.
        await createDraftStore(idbBackend, { key }).clear();
        setState({ phase: "claimed", title: result.value.title, id: result.value.id });
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
        className="border-ok/40 bg-ok-weak text-text rounded-md border px-4 py-3 text-sm"
      >
        Saved <strong className="font-medium">{state.title}</strong> to your account. It is no
        longer stored only in this browser.{" "}
        <Link
          href={`/builder?resume=${encodeURIComponent(state.id)}`}
          className="underline underline-offset-2"
        >
          Keep editing it
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="border-accent/40 bg-accent-weak flex flex-col gap-3 rounded-md border px-4 py-3">
      <div>
        <p className="text-text text-sm font-medium">There is a resume saved in this browser</p>
        <p className="text-muted mt-1 text-sm">
          {state.summary}. Save it to your account and it will follow you between devices. Leave it
          and it stays in this browser only, which still works.
        </p>
      </div>

      {state.phase === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={pending} onClick={() => claim(state)}>
          {pending ? "Saving…" : "Save it to my account"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
