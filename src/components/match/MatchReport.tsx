"use client";

/**
 * What the match engine found (P27-H2).
 *
 * Four blocks, in the order the plan puts them, and the order is the
 * argument:
 *
 * 1. **Three gauges, never one number.** D12 rejects a single 0–100 badge
 *    because one number is a thing to maximise. Coverage, Evidence and
 *    Formatting measure different things and cannot be traded against each
 *    other, so there is nothing to game. Each carries its own one-line "why
 *    this matters" rather than a tooltip nobody opens.
 * 2. **What this posting is really asking for.** The top eight requirements
 *    by `jdWeight`, each with its mention count and the sections it appeared
 *    under. Entirely derived, entirely explainable — this is the
 *    recommendation surface requirement 1 asks for, and it never writes text
 *    for the user (D8).
 * 3. **The requirements checklist**, grouped by JD section so `required`
 *    sits above `preferred`, each row carrying `demonstrated` / `listed
 *    only` / `missing` as text plus a tone. Expanding a row shows the
 *    literal resume text that matched — M3-T5's acceptance is that every
 *    component traces back to specific resume text, and a score you cannot
 *    click through to is indistinguishable from one that was invented.
 * 4. **The anti-stuffing notice**, shown whenever a penalty applied, with
 *    the reason. Stated as a deduction that already happened, not as advice.
 *
 * ## What this deliberately does not do
 *
 * The plan sketches "clicking a demonstrated item scrolls the preview to the
 * matching text". The preview is a rasterised canvas — `PdfCanvas` paints
 * pages to bitmaps and holds no text geometry — so there is no position to
 * scroll to without building a text-coordinate layer the app does not have.
 * Quoting the matched text inline satisfies the same acceptance criterion
 * (traceability to specific resume text) with none of that machinery, and it
 * is arguably better: the quote is readable where the finding is, rather than
 * in a 40%-scale page thumbnail. A missing item still jumps to the step where
 * it would go, which is the half that needs navigation.
 */

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/control";
import { Gauge } from "@/components/ui/gauge";
import { AlertTriangleIcon, ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { JdSectionKind } from "@/lib/jd/parse";
import type { KeywordFinding, KeywordStatus, MatchResult } from "@/lib/match/score";
import { EVIDENCE_WEIGHT, type EvidenceKind } from "@/lib/match/evidence";
import { cn } from "@/lib/utils";
import { UnmatchedPostingNotice } from "./UnmatchedPostingNotice";

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

const SECTION_LABELS: Record<JdSectionKind, string> = {
  required: "Requirements",
  responsibilities: "Responsibilities",
  preferred: "Nice to have",
  intro: "Introduction",
  about: "About the company",
  benefits: "Benefits",
  legal: "Legal boilerplate",
  process: "Hiring process",
  unknown: "Elsewhere in the posting",
};

/**
 * The order the checklist groups in. Deliberately not the parser's own
 * ordering: the reader wants the sections that decide the screen first, and
 * a posting's introduction usually comes before its requirements on the page.
 */
const GROUP_ORDER: readonly JdSectionKind[] = [
  "required",
  "responsibilities",
  "preferred",
  "intro",
  "unknown",
  "about",
  "process",
  "benefits",
  "legal",
];

const STATUS_LABEL: Record<KeywordStatus, string> = {
  demonstrated: "Demonstrated",
  "listed-only": "Listed only",
  missing: "Missing",
};

const STATUS_TONE: Record<KeywordStatus, BadgeTone> = {
  demonstrated: "ok",
  "listed-only": "warn",
  missing: "danger",
};

/** Where a piece of evidence was found, in the user's vocabulary. */
const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  experienceBullet: "in an experience bullet",
  projectBullet: "in a project bullet",
  entryHeading: "in a role or project title",
  certification: "in a certification",
  educationBullet: "in an education bullet",
  summary: "in your summary",
  skillsList: "in your skills list",
};

/** The builder step a missing skill would most plausibly be added to. */
const STEP_FOR_STATUS: Record<KeywordStatus, string> = {
  missing: "experience",
  "listed-only": "experience",
  demonstrated: "experience",
};

const GAUGE_NOTES = {
  coverage:
    "How much of what the posting asks for appears in your resume at all, weighted by where the posting asked for it.",
  evidence:
    "Of what you do match, how much is shown in a bullet rather than sitting in a list. A list is a claim; a bullet is evidence.",
  formatting:
    "The structural issues the builder already flags — headings, dates, contact details. Nothing to do with this posting.",
} as const;

/* -------------------------------------------------------------------------- */
/* Report                                                                      */
/* -------------------------------------------------------------------------- */

export function MatchReport({
  result,
  onNavigateToStep,
  coverLetterHref,
  onSaveAndWriteLetter,
  savingLetterPosting = false,
}: {
  result: MatchResult;
  /** Jumps the builder to a step. Absent outside the builder. */
  onNavigateToStep?: (stepId: string) => void;
  /** P29's entry point, once the posting has an id to point at. */
  coverLetterHref?: string;
  /**
   * Saves the posting and navigates, for when it has no id yet (§10.2, 2.5).
   *
   * The whole block used to be gated on `coverLetterHref`, so a user who
   * pasted and analysed without saving — which is the path the empty state
   * invites — saw no route to the feature at all.
   */
  onSaveAndWriteLetter?: () => void;
  savingLetterPosting?: boolean;
}) {
  // Shared with the letter editor since §10.2 — see `UnmatchedPostingNotice`.
  if (result.unmatchedJd) return <UnmatchedPostingNotice />;

  const ranked = [...result.keywords].sort((a, b) => b.jdWeight - a.jdWeight);
  const topAsks = ranked.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <Gauges result={result} />

      {result.stuffingPenalty.applied > 0 ? (
        <StuffingNotice
          applied={result.stuffingPenalty.applied}
          reasons={result.stuffingPenalty.reasons}
        />
      ) : null}

      <TopAsks findings={topAsks} />

      <Checklist findings={ranked} onNavigateToStep={onNavigateToStep} />

      {coverLetterHref || onSaveAndWriteLetter ? (
        <div className="border-line bg-surface-1 flex flex-wrap items-center gap-3 rounded-lg border p-4">
          <div className="min-w-0 flex-1">
            <p className="text-text text-sm font-medium">Write a cover letter for this posting</p>
            <p className="text-muted mt-0.5 text-xs">
              Assembled from sentences already in your resume — never invented, and fully editable.
            </p>
          </div>
          {coverLetterHref ? (
            <a
              href={coverLetterHref}
              className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
            >
              Write a cover letter
            </a>
          ) : (
            /*
              The posting has no id yet, so the label says what the button is
              about to do. Silently saving under "Write a cover letter" would
              write a row the user did not ask for.
            */
            <Button variant="primary" onClick={onSaveAndWriteLetter} disabled={savingLetterPosting}>
              {savingLetterPosting ? "Saving…" : "Save posting and write a cover letter"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Gauges                                                                      */
/* -------------------------------------------------------------------------- */

function Gauges({ result }: { result: MatchResult }) {
  return (
    <div className="border-line bg-surface-1 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <GaugeCell value={result.coverage} label="Coverage" note={GAUGE_NOTES.coverage} />
        <GaugeCell value={result.evidence} label="Evidence" note={GAUGE_NOTES.evidence} />
        <GaugeCell value={result.formatting} label="Formatting" note={GAUGE_NOTES.formatting} />
      </div>
      <p className="text-muted mt-4 text-xs">
        Three numbers rather than one, on purpose. They measure different things and cannot be
        traded against each other, so there is no single score to optimise instead of the resume.
      </p>
    </div>
  );
}

function GaugeCell({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Gauge value={value} label={label} />
      <p className="text-muted max-w-[22rem] text-xs">{note}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Anti-stuffing                                                               */
/* -------------------------------------------------------------------------- */

function StuffingNotice({ applied, reasons }: { applied: number; reasons: readonly string[] }) {
  return (
    <div role="status" className="border-danger/30 bg-danger-weak rounded-lg border p-4">
      <p className="text-danger flex items-center gap-2 text-sm font-semibold">
        <AlertTriangleIcon className="h-4 w-4" aria-hidden="true" />
        {applied} points deducted for keyword density
      </p>
      <ul className="text-danger mt-2 flex list-disc flex-col gap-1 pl-5 text-xs opacity-90">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="text-danger mt-2 text-xs opacity-90">
        A human reads a resume before any of this matters, and repetition at this density reads as
        padding to them. Deducting for it is the whole reason the coverage number is not something
        you can raise by typing the same word again.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* What the posting is really asking for                                       */
/* -------------------------------------------------------------------------- */

function TopAsks({ findings }: { findings: readonly KeywordFinding[] }) {
  if (findings.length === 0) return null;

  return (
    <section aria-labelledby="match-top-asks">
      <h3 id="match-top-asks" className="text-text text-sm font-semibold">
        What this posting is really asking for
      </h3>
      <p className="text-muted mt-1 text-xs">
        Ranked by how much weight the posting itself puts on each one — how often it is named, how
        rare the term is, and which section it appeared under.
      </p>

      <ol className="mt-3 flex flex-col gap-2">
        {findings.map((finding, index) => (
          <li
            key={finding.skill.id}
            className="border-line bg-surface-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-2"
          >
            <span className="text-muted w-4 shrink-0 text-xs tabular-nums">{index + 1}</span>
            <span className="text-text text-sm font-medium">{finding.skill.canonical}</span>
            <Badge tone={STATUS_TONE[finding.status]}>{STATUS_LABEL[finding.status]}</Badge>
            <span className="text-muted text-xs">
              {finding.jdMentions} mention{finding.jdMentions === 1 ? "" : "s"} ·{" "}
              {finding.jdSections.map((kind) => SECTION_LABELS[kind]).join(", ")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Requirements checklist                                                      */
/* -------------------------------------------------------------------------- */

function Checklist({
  findings,
  onNavigateToStep,
}: {
  findings: readonly KeywordFinding[];
  onNavigateToStep?: (stepId: string) => void;
}) {
  /**
   * A skill named under both Requirements and Nice-to-have belongs in the
   * stronger group only. Listing it twice would double-count it to the eye
   * even though the scorer counts it once.
   */
  const grouped = new Map<JdSectionKind, KeywordFinding[]>();
  for (const finding of findings) {
    const strongest = GROUP_ORDER.find((kind) => finding.jdSections.includes(kind)) ?? "unknown";
    const bucket = grouped.get(strongest);
    if (bucket) bucket.push(finding);
    else grouped.set(strongest, [finding]);
  }

  return (
    <section aria-labelledby="match-checklist">
      <h3 id="match-checklist" className="text-text text-sm font-semibold">
        Every requirement, and where you stand on it
      </h3>

      <div className="mt-3 flex flex-col gap-5">
        {GROUP_ORDER.filter((kind) => grouped.has(kind)).map((kind) => (
          <div key={kind}>
            <h4 className="text-muted text-xs font-semibold tracking-wide uppercase">
              {SECTION_LABELS[kind]}
            </h4>
            <ul className="border-line mt-2 flex flex-col divide-y divide-[var(--color-line)] rounded-md border">
              {grouped.get(kind)?.map((finding) => (
                <ChecklistRow
                  key={finding.skill.id}
                  finding={finding}
                  onNavigateToStep={onNavigateToStep}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChecklistRow({
  finding,
  onNavigateToStep,
}: {
  finding: KeywordFinding;
  onNavigateToStep?: (stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  /** Strongest first, so the quote shown is the best evidence, not the first. */
  const evidence = [...finding.resumeEvidence].sort(
    (a, b) => EVIDENCE_WEIGHT[b.kind] - EVIDENCE_WEIGHT[a.kind],
  );

  return (
    <li className="bg-surface-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "focus-visible:ring-accent hover:bg-surface-2 flex w-full items-center gap-2 px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <Chevron className="text-muted h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-text min-w-0 flex-1 truncate text-sm">{finding.skill.canonical}</span>
        <Badge tone={STATUS_TONE[finding.status]}>{STATUS_LABEL[finding.status]}</Badge>
      </button>

      {open ? (
        <div className="border-line bg-surface-1 border-t px-3 py-3">
          <p className="text-muted text-xs">
            <span className="text-text font-medium">In the posting:</span> named{" "}
            {finding.jdMentions} time{finding.jdMentions === 1 ? "" : "s"}, under{" "}
            {finding.jdSections.map((k) => SECTION_LABELS[k]).join(" and ")}.
          </p>
          <blockquote className="border-line text-muted mt-1.5 border-l-2 pl-3 text-xs italic">
            {finding.jdQuote}
          </blockquote>

          {evidence.length > 0 ? (
            <>
              <p className="text-text mt-3 text-xs font-medium">In your resume:</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {evidence.slice(0, 3).map((item, index) => (
                  <li key={`${item.sectionId}-${item.entryId ?? index}`} className="text-xs">
                    <span className="text-muted">{EVIDENCE_LABEL[item.kind]} — </span>
                    <span className="text-text">&ldquo;{item.text}&rdquo;</span>
                  </li>
                ))}
              </ul>
              {finding.status === "listed-only" ? (
                <p className="text-warn mt-2 text-xs">
                  Only in a list. A line describing what you built with it counts for roughly four
                  times as much — the list entry is a claim, the bullet is evidence.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted mt-3 text-xs">
              Nothing in your resume mentions it. If you have used it, which piece of work was that?
            </p>
          )}

          {finding.status !== "demonstrated" && onNavigateToStep ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => onNavigateToStep(STEP_FOR_STATUS[finding.status])}
            >
              Go to Experience
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
