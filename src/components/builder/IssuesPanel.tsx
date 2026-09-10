/**
 * "3 issues left" (M0-T11, D12).
 *
 * Deliberately not a 0–100 score. A partly-heuristic number presented as a
 * score gets optimized instead of the resume — people chase the last five
 * points by padding rather than by writing something truer. A count of
 * outstanding items has a natural floor at zero and nothing to game.
 *
 * Info-level findings are listed but not counted, so the number can actually
 * reach zero. A checklist that never completes stops being read.
 */

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/control";
import { lint } from "@/lib/lint/engine";
import type { Dismissal, LintFinding, Severity } from "@/lib/lint/types";
import { useResumeStore } from "@/store/resume";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<Severity, string> = {
  error: "bg-danger",
  warning: "bg-warn",
  info: "bg-accent",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  error: "Needs fixing",
  warning: "Worth improving",
  info: "Worth a look",
};

export function IssuesPanel({ onNavigate }: { onNavigate?: (stepId: string) => void }) {
  const doc = useResumeStore((s) => s.history.present);
  const [dismissals, setDismissals] = useState<Dismissal[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState<LintFinding | null>(null);
  const [reason, setReason] = useState("");

  const result = useMemo(() => lint(doc, dismissals), [doc, dismissals]);
  const { outstanding, findings } = result;

  const confirmDismiss = () => {
    if (!dismissing) return;
    setDismissals((prev) => [
      ...prev,
      { key: dismissing.key, reason: reason.trim(), dismissedAt: Date.now() },
    ]);
    setDismissing(null);
    setReason("");
  };

  return (
    <section aria-label="Resume issues" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition",
          "focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none",
          outstanding > 0
            ? "bg-warn-weak text-warn hover:opacity-90"
            : "bg-ok-weak text-ok hover:opacity-90",
        )}
      >
        <span className="font-medium">
          {outstanding === 0
            ? findings.length === 0
              ? "No issues"
              : "Nothing left to fix"
            : `${outstanding} ${outstanding === 1 ? "issue" : "issues"} left`}
        </span>
        <span aria-hidden className="text-xs">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <ul className="flex flex-col gap-2">
          {findings.length === 0 ? (
            <li className="text-muted px-3 py-2 text-sm">
              Nothing flagged. This does not guarantee any particular outcome — it means the checks
              here are satisfied.
            </li>
          ) : (
            findings.map((finding) => (
              <li key={finding.key} className="border-line rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      SEVERITY_STYLES[finding.severity],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-text text-sm">
                      <span className="sr-only">{SEVERITY_LABEL[finding.severity]}: </span>
                      {finding.message}
                    </p>
                    {/* The "why" is the part that teaches; never hide it. */}
                    <p className="text-muted mt-1 text-xs">{finding.why}</p>

                    <div className="mt-2 flex gap-2">
                      {onNavigate ? (
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => onNavigate(finding.location.stepId)}
                        >
                          Go there
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => setDismissing(finding)}
                      >
                        Dismiss
                      </Button>
                    </div>

                    {dismissing?.key === finding.key ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <label className="text-muted text-xs">
                          Why are you dismissing this?
                          <input
                            autoFocus
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Deliberate — this is a personal statement."
                            className="border-line-strong bg-surface-0 mt-1 w-full rounded border px-2 py-1 text-xs"
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button
                            className="px-2 py-1 text-xs"
                            onClick={confirmDismiss}
                            disabled={reason.trim().length === 0}
                          >
                            Dismiss
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            onClick={() => {
                              setDismissing(null);
                              setReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
