"use client";

/**
 * "This resume is only in this browser" — said once there is something to
 * lose (ROADMAP R2).
 *
 * A guest's draft lives in IndexedDB and nowhere else (D6). The builder
 * already asks the browser to keep it (`navigator.storage.persist()` in
 * `store/persistence.ts`), which protects it from eviction and from nothing
 * the visitor does themselves: clearing browsing data, a cleaner app, a
 * different browser next week. There is no copy on a server to restore from,
 * by design, so the only backup is the one they take.
 *
 * So once the draft is `worthKeeping` — a name and a real piece of a resume —
 * a guest is offered the two ways to keep it: a JSON Resume file they hold,
 * which this builder (and others) can open again, or an account. Either
 * answer, or "Remind me in a month", puts it away for a month. Never shown
 * to someone signed in: their work is already on the server.
 *
 * Button names are not the export panel's. `Download JSON Resume` is matched
 * by exact name in both test suites, and a second control with that name
 * would make every one of those lookups ambiguous.
 */

import { useState } from "react";
import { Button } from "@/components/ui/control";
import { buttonClassName } from "@/components/ui/button-style";
import { resumeFileName } from "@/lib/emit/filename";
import { toJsonResume } from "@/lib/interop/json-resume";
import { worthKeeping } from "@/lib/resume/worth-keeping";
import { track } from "@/lib/track";
import { useResumeStore } from "@/store/resume";

/** Where "put away for a month" is remembered. A timestamp, nothing else. */
export const BACKUP_NUDGE_KEY = "backup-nudge-dismissed";
const QUIET_FOR_MS = 30 * 24 * 60 * 60 * 1000;

function quietUntil(): number {
  try {
    return Number(localStorage.getItem(BACKUP_NUDGE_KEY) ?? 0) + QUIET_FOR_MS;
  } catch {
    return 0;
  }
}

function putAway(): void {
  try {
    localStorage.setItem(BACKUP_NUDGE_KEY, String(Date.now()));
  } catch {
    // Private browsing: it comes back next visit, which is a small annoyance
    // and not a reason to fail anything.
  }
}

export function BackupNudge({ signedIn }: { signedIn: boolean }) {
  const resume = useResumeStore((state) => state.history.present);
  const hydrated = useResumeStore((state) => state.hydrated);
  // Read on the first render in the browser. The server cannot see this
  // browser's answer and renders nothing either way — nothing renders until
  // the draft has hydrated from IndexedDB, which only a browser can do — so
  // the two first renders cannot disagree.
  const [quiet, setQuiet] = useState(
    () => typeof window !== "undefined" && Date.now() < quietUntil(),
  );

  if (signedIn || !hydrated || quiet || !worthKeeping(resume)) return null;

  const dismiss = () => {
    putAway();
    setQuiet(true);
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(toJsonResume(resume), null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = resumeFileName(resume.contact.fullName, "json");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track("backup:download");
    dismiss();
  };

  return (
    <section
      aria-labelledby="backup-nudge-heading"
      className="anim-pop border-line bg-surface-1 mt-8 flex flex-col gap-3 rounded-lg border p-4 shadow-[var(--elev-1)]"
    >
      <h2 id="backup-nudge-heading" className="text-text text-sm font-semibold">
        Keep a copy of this resume
      </h2>
      <p className="text-muted max-w-prose text-sm leading-relaxed">
        It is saved in this browser and nowhere else — that is what keeps it private, and it means
        clearing your browsing data deletes it for good. A backup file opens here again, in any
        browser; an account keeps it for you.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={downloadBackup}>
          Download a backup
        </Button>
        <a href="/signin" className={buttonClassName({ size: "sm" })} onClick={putAway}>
          Keep it in an account
        </a>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Remind me in a month
        </Button>
      </div>
    </section>
  );
}
