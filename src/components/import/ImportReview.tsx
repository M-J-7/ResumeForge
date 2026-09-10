"use client";

/**
 * What the parser recovered, and what it is unsure of (P31-A3).
 *
 * Import never lands silently. A silent "imported!" presents every guess as
 * fact, and import is lossy in ways the user cannot see from the outside: a
 * PDF has no URL behind its link text, `03/04/2023` has no month, a
 * heading we do not recognise becomes a custom section. Showing the
 * confidence report is the same argument D14 makes about ATS claims —
 * describe what was actually read, never imply more.
 *
 * Every uncertain field links to the builder step that fixes it, so the
 * report is a work list rather than a disclaimer. That is the whole reason
 * it carries `stepId`.
 *
 * ## Why this is not a confirmation dialog
 *
 * Nothing here asks "are you sure". The import has already happened, through
 * the store's history, so Ctrl+Z puts the previous draft back — the same
 * reasoning `ImportResumeFile` inherits from the JSON Resume import it
 * replaced. A confirmation asks for a decision before the user can see the
 * result; this shows the result and leaves the decision reversible.
 */

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/control";
import { AlertTriangleIcon } from "@/components/ui/icons";
import type { ImportConfidence, ImportResult } from "@/lib/import/parse-resume";

const TONE: Record<ImportConfidence, BadgeTone> = {
  high: "ok",
  medium: "neutral",
  low: "warn",
};

const LABEL: Record<ImportConfidence, string> = {
  high: "Read cleanly",
  medium: "Check this",
  low: "Needs you",
};

export function ImportReview({
  result,
  onNavigateToStep,
}: {
  result: ImportResult;
  /** Omitted outside the builder — on `/check` there is no step to open. */
  onNavigateToStep?: (stepId: string) => void;
}) {
  const uncertain = result.fields.filter((f) => f.confidence !== "high");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">
        {/* A count of what is left, never a score — D12. */}
        {uncertain.length === 0
          ? "Every field came back cleanly. Read it over anyway; a parser can only see what is in the file."
          : `${uncertain.length} ${uncertain.length === 1 ? "field needs" : "fields need"} a look. Everything else came back cleanly.`}
      </p>

      {result.warnings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {result.warnings.map((warning) => (
            <li
              key={warning}
              className="border-warn/30 bg-warn-weak text-warn flex gap-2 rounded-md border p-2 text-xs"
            >
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Field
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                What was read
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Confidence
              </th>
            </tr>
          </thead>
          <tbody>
            {result.fields.map((field) => (
              <tr key={field.field} className="border-line border-t align-top">
                <th scope="row" className="text-text px-3 py-2 text-left font-medium">
                  {field.field}
                </th>
                <td className="text-muted px-3 py-2">
                  {field.value ?? <span className="text-faint">Nothing found</span>}
                  <span className="text-faint mt-0.5 block">{field.note}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge tone={TONE[field.confidence]}>{LABEL[field.confidence]}</Badge>
                  {onNavigateToStep && field.confidence !== "high" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 block"
                      onClick={() => onNavigateToStep(field.stepId)}
                    >
                      Fix it
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-muted text-xs">
        <summary className="text-text cursor-pointer font-medium">
          The text the parser worked from
        </summary>
        <pre className="bg-surface-2 mt-2 max-h-64 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {result.text}
        </pre>
      </details>
    </div>
  );
}
