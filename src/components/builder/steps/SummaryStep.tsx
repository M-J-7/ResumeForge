"use client";

import { Field, Textarea } from "@/components/ui/control";
import { useSection } from "@/components/builder/useSection";

/** Roughly two to four lines on a rendered page — longer and it stops being read. */
const SUGGESTED_WORDS = 60;

export function SummaryStep() {
  const { section, update } = useSection("summary");
  if (!section) return null;

  const words = section.content.trim().split(/\s+/).filter(Boolean).length;
  const tooLong = words > SUGGESTED_WORDS;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Professional summary"
        hint="Two or three sentences: what you do, how long you have done it, and the single result you are proudest of. Skip it entirely rather than writing filler — an empty section beats 'results-driven professional'."
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            className="min-h-32"
            value={section.content}
            placeholder="Backend engineer with seven years building payment infrastructure at scale. Led the migration that cut settlement latency from 400ms to 90ms across 12 markets."
            onChange={(e) => update({ ...section, content: e.target.value }, "summary.content")}
          />
        )}
      </Field>

      <p
        className={
          tooLong
            ? "text-xs font-medium text-amber-700 dark:text-amber-500"
            : "text-xs text-zinc-500 dark:text-zinc-400"
        }
      >
        {words} {words === 1 ? "word" : "words"}
        {tooLong
          ? ` — over ${SUGGESTED_WORDS}, this is getting long enough that it will be skimmed.`
          : ""}
      </p>
    </div>
  );
}
