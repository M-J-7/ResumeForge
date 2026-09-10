"use client";

/**
 * The per-bullet coach line (P34).
 *
 * Sits under the bullet it is about, collapsed to a single summary until the
 * user opens it. Collapsed by default because a resume has fifteen bullets
 * and four questions each: expanded, this would be four times more text than
 * the resume itself, and the honest version of "here is what to think about"
 * becomes a wall nobody reads.
 *
 * ## D12 — a count of what is left, never a score
 *
 * The summary says "2 things to think about", not "56%". There is no bullet
 * grade here and there must not be one: a number implies a scale somebody
 * calibrated, and nobody has. The count is the same shape the lint panel
 * already uses for the same reason.
 *
 * ## Everything it says is a question
 *
 * Enforced in `lib/coach/parse-bullet.ts` and asserted by `coach.test.ts`.
 * This component renders what that module produces and adds no copy of its
 * own beyond the labels — which is deliberate, because a "helpful example"
 * added here would bypass the test that keeps the feature inside D8.
 */

import { useState } from "react";
import { analyzeBullet, PART_LABELS, type BulletAnalysis } from "@/lib/coach/parse-bullet";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function BulletCoach({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const analysis: BulletAnalysis = analyzeBullet(text);

  if (analysis.notes.length === 0) return null;

  const count = analysis.notes.length;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className={cn(
          "text-muted hover:text-text focus-visible:ring-accent inline-flex items-center gap-1 rounded text-xs transition",
          "focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        {open ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        {/* A count, not a score — D12. */}
        {count} {count === 1 ? "thing" : "things"} to think about
        <span className="sr-only"> for {label}</span>
      </button>

      {open ? (
        // Named, so the questions are one identifiable group rather than
        // loose text after a button — and so a reader landing in the middle
        // of it knows which bullet it belongs to.
        <ul
          aria-label={`Coach notes for ${label}`}
          className="border-line mt-1.5 flex flex-col gap-2 border-l pl-3"
        >
          {analysis.notes.map((note) => (
            <li key={`${note.part}-${note.gap}`} className="text-xs">
              <span className="text-muted font-medium">{PART_LABELS[note.part]}</span>
              <span className="text-faint"> — {note.gap}</span>
              <p className="text-text mt-0.5">{note.question}</p>
              <p className="text-muted mt-0.5">{note.hint}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
