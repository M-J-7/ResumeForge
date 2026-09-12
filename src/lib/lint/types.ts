/**
 * The lint engine's shape (M0-T11).
 *
 * Framed like ESLint per D11: every rule has a stable id, a severity, a
 * message, and — the part that matters most here — a one-line explanation of
 * *why it matters*. A resume builder that says "weak verb" without saying
 * why teaches nothing; the user either ignores it or obeys it superstitiously.
 *
 * Per D12 the UI shows "3 issues left" while editing rather than a live
 * 0–100 score. Gamifying a partly-heuristic number trains people to optimize
 * the number instead of the resume.
 *
 * Rules are hand-written rather than delegated to a language server (D11):
 * LanguageTool wants 2–4GB of RAM on a container otherwise around 200MB, for
 * marginal gain over checks this targeted.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

export type Severity = "error" | "warning" | "info";

/**
 * Where a finding lives, so the UI can navigate to it. `stepId` matches the
 * builder's step ids; `entryId` narrows to a specific entry when relevant.
 */
export interface LintLocation {
  stepId: string;
  sectionId?: string;
  entryId?: string;
  /** Index into an entry's bullets, when the finding is about one bullet. */
  bulletIndex?: number;
}

export interface LintFinding {
  ruleId: string;
  severity: Severity;
  /** What is wrong, in the user's terms. */
  message: string;
  /** One line on why it matters. Never generic — see `rules.test.ts`. */
  why: string;
  location: LintLocation;
  /** A stable key for dismissal, unique to this finding instance. */
  key: string;
}

export interface LintRule {
  id: string;
  severity: Severity;
  /** Shown in the rule list; a short description of what the rule checks. */
  title: string;
  why: string;
  run: (doc: ResumeDocument) => Omit<LintFinding, "ruleId" | "severity" | "why" | "key">[];
}

/**
 * A finding the user has explicitly dismissed, with their reason.
 *
 * Dismissals carry a reason because a rule dismissed without one is
 * indistinguishable from a rule that was never understood — and because the
 * user coming back a month later deserves to know why they overrode it.
 */
export interface Dismissal {
  key: string;
  reason: string;
  dismissedAt: number;
}

export function findingKey(ruleId: string, location: LintLocation): string {
  return [ruleId, location.sectionId, location.entryId, location.bulletIndex]
    .filter((part) => part !== undefined)
    .join(":");
}
