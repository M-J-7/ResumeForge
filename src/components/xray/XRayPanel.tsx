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

/*
 * The parser's voice, throughout.
 *
 * `design.md` §3.1: monospace in this app means "a machine recovered this",
 * never a stylistic choice, and `--machine` is the colour that goes with it —
 * a claim about what a parser read is a different claim, with different
 * reliability, from anything we wrote, and the two must not share a colour.
 * So every value on this panel that came *out of the PDF* is slate and mono;
 * the verdicts about those values keep `--ok` and `--danger`, because a
 * verdict is ours.
 */
const MACHINE_TEXT = "text-machine font-mono";

const STATUS_STYLE: Record<FieldStatus, string> = {
  recovered: "text-ok",
  wrong: "text-danger",
  missing: "text-danger",
  "not-applicable": "text-faint",
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
      <div role="alert" className="text-danger p-4 text-sm">
        Could not read the document back: {error}
      </div>
    );
  }

  if (!bytes || (!geometric && loading)) {
    return (
      <p className="text-faint p-6 text-center text-sm">
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
        <h2 className="text-text text-base font-semibold">What the machine actually read</h2>
        <p className="text-muted mt-1 text-sm">
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
              scorecard.score === 100 ? "text-ok" : "text-warn",
            )}
          >
            {scorecard.score}%
          </span>
          <span className="text-muted text-sm">
            of your fields were recovered correctly
            {failures.length > 0 ? ` — ${failures.length} could not be` : ""}
          </span>
        </div>

        <div className="border-line overflow-x-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-1">
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
                <tr key={field.field} className="border-line border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn("font-medium", STATUS_STYLE[field.status])}>
                      {fieldLabel(field.field)}
                    </span>
                    <span className="sr-only"> — {STATUS_LABEL[field.status]}</span>
                  </td>
                  <td className="text-muted px-3 py-2">
                    {field.expected || <span className="text-faint">—</span>}
                  </td>
                  {/* What came back out of the file: the machine's own
                      words, so slate and mono. A field it could not recover
                      has no recovered text — what is printed there is our
                      verdict, and it keeps the verdict's colour. */}
                  <td
                    className={cn(
                      "px-3 py-2",
                      field.actual ? MACHINE_TEXT : STATUS_STYLE[field.status],
                    )}
                  >
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
        <h3 className="text-text text-sm font-semibold">Where parsers may differ</h3>
        {disagreements.length === 0 ? (
          <p className="text-muted text-sm">
            Both a naive reader and a careful one recover your resume in the same order. That is the
            best case: reading order is unambiguous.
          </p>
        ) : (
          <>
            <p className="text-muted text-sm">
              {disagreements.length} {disagreements.length === 1 ? "line reads" : "lines read"}{" "}
              differently depending on how carefully the parser works. This is normal where a line
              has something aligned to the right — a date beside a job title — and it is where real
              systems diverge from each other.
            </p>
            <ul className="border-line text-machine max-h-40 overflow-y-auto rounded-md border p-2 font-mono text-xs">
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
          <h3 className="text-text text-sm font-semibold">The text a machine extracts</h3>
          <label className="text-muted flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showNaive}
              onChange={(e) => setShowNaive(e.target.checked)}
              className="control-check focus-visible:ring-accent focus-visible:ring-offset-surface-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            Show the naive reading order instead
          </label>
        </div>
        {/* The parser's own ground, not the app's. This block is the
            evidence the whole panel rests on, and it should not look like
            something we typed. */}
        <pre className="bg-machine-weak text-machine border-line max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">
          {shown.text}
        </pre>
      </section>
    </div>
  );
}
