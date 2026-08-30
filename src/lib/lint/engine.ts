/**
 * Runs the rules and applies dismissals (M0-T11).
 */

import { RULES } from "./rules";
import { findingKey, type Dismissal, type LintFinding, type Severity } from "./types";
import type { ResumeDocument } from "@/lib/resume/schema";

export interface LintResult {
  findings: LintFinding[];
  /** Counts by severity, for the "3 issues left" indicator (D12). */
  counts: Record<Severity, number>;
  /** Errors plus warnings — what "issues left" actually counts. */
  outstanding: number;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function lint(doc: ResumeDocument, dismissals: readonly Dismissal[] = []): LintResult {
  const dismissed = new Set(dismissals.map((d) => d.key));
  const findings: LintFinding[] = [];

  for (const rule of RULES) {
    for (const partial of rule.run(doc)) {
      const key = findingKey(rule.id, partial.location);
      if (dismissed.has(key)) continue;
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        why: rule.why,
        key,
        ...partial,
      });
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  return {
    findings,
    counts,
    // Info findings are observations, not work. Counting them would make the
    // number never reach zero, which is how a checklist stops being read.
    outstanding: counts.error + counts.warning,
  };
}
