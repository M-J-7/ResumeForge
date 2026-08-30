/**
 * X-Ray (M1-T3) — the three layers.
 *
 * 1. The plain text a machine recovers, beside the document.
 * 2. A field-by-field scorecard, recovered value against the true value.
 * 3. Where the naive and geometric reads disagree — the places real parsers
 *    diverge from one another.
 *
 * The claim this supports is the one no competitor can make: not "this is
 * ATS-friendly" but "here is what the machine actually read". It is
 * demonstrable because we hold the ground truth, and per D14 that is the only
 * kind of claim worth making about parsing.
 */

"use client";

import { useState } from "react";
import { useXRay } from "./useXRay";
import type { FieldResult, FieldStatus } from "@/lib/xray/scorecard";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<FieldStatus, string> = {
  recovered: "text-emerald-700 dark:text-emerald-400",
  wrong: "text-red-700 dark:text-red-400",
  missing: "text-red-700 dark:text-red-400",
  "not-applicable": "text-zinc-400 dark:text-zinc-500",
};

const STATUS_LABEL: Record<FieldStatus, string> = {
  recovered: "Recovered",
  wrong: "Read incorrectly",
  missing: "Not found",
  "not-applicable": "Not provided",
};

/** `role.0.title` reads badly in a table; humans want "Role 1 — title". */
function fieldLabel(field: string): string {
  const match = field.match(/^role\.(\d+)\.(\w+)$/);
  if (!match) return field.charAt(0).toUpperCase() + field.slice(1);
  return `Role ${Number(match[1]) + 1} — ${match[2]}`;
}

export function XRayPanel({ bytes, active }: { bytes: Uint8Array | null; active: boolean }) {
  const { loading, streamOrder, geometric, scorecard, disagreements, error } = useXRay(
    bytes,
    active,
  );
  const [showNaive, setShowNaive] = useState(false);

  if (error) {
    return (
      <div role="alert" className="p-4 text-sm text-red-700 dark:text-red-400">
        Could not read the document back: {error}
      </div>
    );
  }

  if (!bytes || (!geometric && loading)) {
    return (
      <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {bytes ? "Reading your resume back…" : "Add some content to see what a machine reads."}
      </p>
    );
  }

  if (!geometric || !scorecard) return null;

  const graded = scorecard.fields.filter((f) => f.status !== "not-applicable");
  const failures = graded.filter((f) => f.status !== "recovered");
  const shown = showNaive && streamOrder ? streamOrder : geometric;

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-4">
      <header>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          What the machine actually read
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every other builder tells you a resume is ATS-friendly. This re-reads the file you are
          about to send, and checks it against what you typed.
        </p>
      </header>

      {/* Layer 2 — the scorecard. Placed first because it is the answer; the
          extracted text below is the evidence for it. */}
      <section aria-label="Field recovery scorecard" className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              "text-3xl font-semibold tabular-nums",
              scorecard.score === 100
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400",
            )}
          >
            {scorecard.score}%
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            of your fields were recovered correctly
            {failures.length > 0 ? ` — ${failures.length} could not be` : ""}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Field
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  You wrote
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  The machine read
                </th>
              </tr>
            </thead>
            <tbody>
              {scorecard.fields.map((field: FieldResult) => (
                <tr
                  key={field.field}
                  className="border-t border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn("font-medium", STATUS_STYLE[field.status])}>
                      {fieldLabel(field.field)}
                    </span>
                    <span className="sr-only"> — {STATUS_LABEL[field.status]}</span>
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {field.expected || <span className="text-zinc-400">—</span>}
                  </td>
                  <td className={cn("px-3 py-2", STATUS_STYLE[field.status])}>
                    {field.actual ?? STATUS_LABEL[field.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Layer 3 — where the two reads diverge. */}
      <section aria-label="Parser disagreements" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Where parsers may differ
        </h3>
        {disagreements.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Both a naive reader and a careful one recover your resume in the same order. That is the
            best case: reading order is unambiguous.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {disagreements.length} {disagreements.length === 1 ? "line reads" : "lines read"}{" "}
              differently depending on how carefully the parser works. This is normal where a line
              has something aligned to the right — a date beside a job title — and it is where real
              systems diverge from each other.
            </p>
            <ul className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 p-2 font-mono text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {disagreements.slice(0, 20).map((line) => (
                <li key={line} className="py-0.5">
                  {line}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Layer 1 — the raw text. Last, because it is the longest and the
          least immediately legible; the score above is what convinces. */}
      <section aria-label="Extracted text" className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            The text a machine extracts
          </h3>
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={showNaive}
              onChange={(e) => setShowNaive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            Show the naive reading order instead
          </label>
        </div>
        <pre className="max-h-96 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {shown.text}
        </pre>
      </section>
    </div>
  );
}
