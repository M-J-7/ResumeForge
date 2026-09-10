"use client";

/**
 * The one question asked on first open (P35).
 *
 * Their wizard opens with this and adapts. Ours asks it once, stores the
 * answer in `localStorage`, and never asks again — see
 * `lib/resume/experience-level.ts` for why it is a preference rather than a
 * field on the document.
 *
 * ## Not a modal, and that is the whole design
 *
 * This was a modal for about an hour, and it broke twenty-four existing
 * end-to-end tests: every one of them opens `/builder` and immediately
 * reaches for a field, and a focus-trapping dialog sits in front of all of
 * them. The tests were right. A question that blocks the builder on arrival
 * is worse than no question at all — the person who wants to start typing
 * should be able to start typing, and the answer only reorders a rail they
 * can navigate freely anyway.
 *
 * So it is an inline card above the step, dismissible, with a skip that is a
 * real answer. Nothing is gated behind it, nothing is hidden by it, and a
 * visitor who ignores it entirely gets exactly the product that existed
 * before it did.
 */

import { Button } from "@/components/ui/control";
import { XIcon } from "@/components/ui/icons";
import { EXPERIENCE_LEVEL_OPTIONS, type ExperienceLevel } from "@/lib/resume/experience-level";
import { cn } from "@/lib/utils";

export function ExperienceLevelPrompt({
  open,
  onChoose,
  onSkip,
  current,
}: {
  open: boolean;
  onChoose: (level: ExperienceLevel) => void;
  onSkip: () => void;
  /** Set when reopened from the rail to change an earlier answer. */
  current?: ExperienceLevel | null;
}) {
  if (!open) return null;

  return (
    <section
      aria-label="How much work experience do you have?"
      className="border-line bg-surface-1 mb-5 rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-text text-sm font-semibold">How much work experience do you have?</h2>
          <p className="text-muted mt-1 text-xs">
            It decides which section leads and what advice you get. Nothing is hidden either way,
            and you can change it whenever.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip} aria-label="Skip" className="shrink-0">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/*
        Five rows, not a grid.

        This was `sm:grid-cols-2 lg:grid-cols-3`, which lays five options out
        as three then two and leaves a hole where the sixth card would be —
        the ragged shape `design.md` §6 names. The doc's fix was "one row at
        desktop", and five cards carrying a label *and* a sentence do not fit
        one row of a column this narrow without the sentences collapsing to
        two words each.

        A single column of equal rows is what the content actually is: five
        mutually exclusive answers to one question, in order. The label and
        its detail sit on one line from `sm` and stack below it.
      */}
      <ul className="border-line mt-3 flex flex-col overflow-hidden rounded-md border">
        {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
          <li key={option.id} className="border-line border-b last:border-b-0">
            <button
              type="button"
              onClick={() => onChoose(option.id)}
              aria-pressed={current === option.id}
              className={cn(
                "hover:bg-surface-2 focus-visible:ring-accent flex w-full flex-col gap-0.5 px-3 py-2.5 text-left",
                "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
                "focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                "sm:flex-row sm:items-baseline sm:gap-3",
                current === option.id && "bg-accent-weak",
              )}
            >
              <span className="text-text w-[11rem] shrink-0 text-sm font-medium">
                {option.label}
              </span>
              <span className="text-muted text-xs leading-relaxed">{option.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="sm" className="mt-2" onClick={onSkip}>
        Skip
      </Button>
    </section>
  );
}
