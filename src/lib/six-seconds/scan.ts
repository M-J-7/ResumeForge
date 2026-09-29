/**
 * The Six-Second View (ROADMAP F1): where the things a quick first read looks
 * for actually land on the page you are about to send.
 *
 * ## What it is based on, stated at the strength it deserves
 *
 * TheLadders' eye-tracking studies of recruiters (2012, and again in 2018)
 * found a first pass over a resume of about six to seven seconds, and found it
 * spent mostly on a handful of facts: the candidate's name, the current title
 * and employer, the previous title and employer, the dates of each, and
 * education. That is where this product's name comes from. It is one
 * company's study, of recruiters rather than of software, and the page that
 * shows this says so (`SIX_SECOND_SOURCE`).
 *
 * What this module does with it is modest and checkable: it finds those facts
 * **in the real PDF** — the artifact, never an estimate (D3) — and reports how
 * far down the first page each one sits. It does not claim to model where any
 * particular person's eyes go.
 *
 * ## The two things it flags
 *
 * 1. **The current role starts low on page one.** A long summary or a large
 *    skills block above the experience pushes the single most-read fact down
 *    the page. Past `CURRENT_ROLE_ZONE` of the way down, it is flagged.
 * 2. **A fact is not on page one at all** — the previous role for an
 *    experienced candidate; education and the strongest project for somebody
 *    with no roles yet, for whom those *are* the record.
 *
 * Everything else is reported and not flagged: a count of what is left, never
 * a score (D12).
 */

import { STANDARD_SECTION_LABELS } from "@/lib/layout/document";
import type { PdfPage } from "@/lib/pdf/read";
import type { ResumeDocument, Section } from "@/lib/resume/schema";

/** The study, as the page cites it. */
export const SIX_SECOND_SOURCE =
  "TheLadders' eye-tracking studies of recruiters measured a first pass of about six seconds in 2012 and 7.4 in 2018, most of it spent on the name, the current and previous titles and employers, their dates, and education. It is one company's research, and recruiters dispute the exact figure — the positions below are measured from your PDF, not from anyone's eyes.";

/**
 * How far down page one the current role may start before it is flagged —
 * a fraction of the page height, 0 at the top.
 *
 * Not a number from the study, which reports what was looked at rather than
 * where on the page it sat. It is this product's rule for "near the top": the
 * header and a three-line summary end around a quarter of the way down on
 * every template here, so a current role that starts past 45% has a lot
 * above it, and the fix — a shorter summary, skills moved below experience —
 * is always available.
 */
export const CURRENT_ROLE_ZONE = 0.45;

export type ScanTargetId = "name" | "current-role" | "previous-role" | "education" | "project";

export type ScanStatus =
  /** Found on page one, where it should be. */
  | "ok"
  /** On page one, but lower than a quick read reaches easily. */
  | "low"
  /** Only on a later page. */
  | "later-page"
  /** In the document, but not found in the PDF text — reported, not blamed. */
  | "not-found";

export interface ScanTarget {
  id: ScanTargetId;
  /** What it is, in the reader's words: "Your current role". */
  label: string;
  /** The text looked for, as the resume has it. */
  text: string;
  /** Whether a problem with this one counts as something to fix. */
  flagged: boolean;
  status: ScanStatus;
  /** 1-based page it was found on, or null. */
  page: number | null;
  /** 0 at the top of that page, 1 at the bottom. Null when not found. */
  depth: number | null;
  /** One sentence about this target's position — never a score. */
  note: string;
}

export interface ScanResult {
  targets: ScanTarget[];
  /** Flagged targets that are not `ok`: what "N things to look at" counts. */
  issues: number;
}

/** Lowercase, and without any whitespace — PDF text splits runs unpredictably. */
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** The longest prefix worth searching for: long titles wrap onto a second line. */
function needleOf(text: string): string {
  return squash(text).slice(0, 28);
}

function visible<T extends Section["type"]>(
  doc: ResumeDocument,
  type: T,
): Extract<Section, { type: T }> | undefined {
  return doc.sections.find(
    (section): section is Extract<Section, { type: T }> => section.type === type && section.visible,
  );
}

interface Wanted {
  id: ScanTargetId;
  label: string;
  text: string;
  /** Alternatives tried in order when the first is empty or not found. */
  needles: string[];
  mustBeOnFirstPage: boolean;
  zone?: number;
  /** Search from this section's heading, not from the top of the page. */
  section?: string;
  /** And from after this target, when it was found. */
  after?: ScanTargetId;
}

function wanted(doc: ResumeDocument): Wanted[] {
  const list: Wanted[] = [];
  const name = doc.contact.fullName.trim();
  if (name) {
    list.push({
      id: "name",
      label: "Your name",
      text: name,
      needles: [name],
      mustBeOnFirstPage: true,
    });
  }

  const roles = (visible(doc, "experience")?.entries ?? []).filter(
    (entry) => entry.title.trim() || entry.organization.trim(),
  );
  const describe = (entry: (typeof roles)[number]) =>
    [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(", ");

  const [current, previous] = roles;
  if (current) {
    list.push({
      id: "current-role",
      label: "Your current role",
      text: describe(current),
      needles: [current.title, current.organization].filter((t) => t.trim()),
      mustBeOnFirstPage: true,
      zone: CURRENT_ROLE_ZONE,
      section: STANDARD_SECTION_LABELS.experience,
    });
  }
  if (previous) {
    list.push({
      id: "previous-role",
      label: "Your previous role",
      text: describe(previous),
      needles: [previous.title, previous.organization].filter((t) => t.trim()),
      mustBeOnFirstPage: true,
      section: STANDARD_SECTION_LABELS.experience,
      // Two roles can share a title; the previous one is below the current.
      after: "current-role",
    });
  }

  const noRoles = roles.length === 0;

  const study = visible(doc, "education")?.entries.find(
    (entry) => entry.credential.trim() || entry.institution.trim(),
  );
  if (study) {
    list.push({
      id: "education",
      label: "Your education",
      text: [study.credential.trim(), study.institution.trim()].filter(Boolean).join(", "),
      needles: [study.credential, study.institution].filter((t) => t.trim()),
      // For somebody with a work history, education on page two is normal.
      // With no roles, it is most of the record.
      mustBeOnFirstPage: noRoles,
      section: STANDARD_SECTION_LABELS.education,
    });
  }

  if (noRoles) {
    const project = visible(doc, "projects")?.entries.find((entry) => entry.name.trim());
    if (project) {
      list.push({
        id: "project",
        label: "Your first project",
        text: project.name.trim(),
        needles: [project.name],
        mustBeOnFirstPage: true,
        section: STANDARD_SECTION_LABELS.projects,
      });
    }
  }

  return list;
}

/** Every line of the document in reading order, with where it sits. */
interface PlacedLine {
  /** Position in reading order across all pages. */
  index: number;
  squashed: string;
  page: number;
  depth: number;
}

function placeLines(pages: readonly PdfPage[]): PlacedLine[] {
  const placed: PlacedLine[] = [];
  for (const page of pages) {
    const height = page.heightPt || 1;
    for (const line of page.lines) {
      // `y` is the baseline measured up from the bottom; depth runs down from
      // the top, to the top of the line rather than its baseline.
      const top = height - (line.y + line.height);
      placed.push({
        index: placed.length,
        squashed: squash(line.text),
        page: page.pageNumber,
        depth: Math.min(1, Math.max(0, top / height)),
      });
    }
  }
  return placed;
}

/**
 * The line that *is* a section's heading — the label alone on its line, as
 * every template sets it — or null when the section has no heading here.
 */
function headingLine(lines: readonly PlacedLine[], label: string): PlacedLine | null {
  const wanted = squash(label);
  return lines.find((line) => line.squashed === wanted) ?? null;
}

/**
 * The first line after `after` that contains one of the needles.
 *
 * Searching from the section's heading is what keeps a role from being found
 * in the summary: summaries very often open with the job title ("Platform
 * engineer with…"), and the first version of this matched that line and
 * reported the current role at 15% down a page where it began at 48% —
 * caught by looking at the overlay on a real page, 2026-09-28.
 */
function locate(
  lines: readonly PlacedLine[],
  needles: readonly string[],
  after: number,
): PlacedLine | null {
  for (const raw of needles) {
    const needle = needleOf(raw);
    if (!needle) continue;
    const found = lines.find((line) => line.index > after && line.squashed.includes(needle));
    if (found) return found;
  }
  return null;
}

function percent(depth: number): string {
  return `${Math.round(depth * 100)}%`;
}

export function scanDocument(doc: ResumeDocument, pages: readonly PdfPage[]): ScanResult {
  const lines = placeLines(pages);
  const foundAt = new Map<ScanTargetId, number>();

  const targets: ScanTarget[] = wanted(doc).map((want) => {
    let start = -1;
    if (want.section) start = headingLine(lines, want.section)?.index ?? -1;
    if (want.after) start = Math.max(start, foundAt.get(want.after) ?? -1);
    const found = locate(lines, want.needles, start);
    if (found) foundAt.set(want.id, found.index);
    const base = {
      id: want.id,
      label: want.label,
      text: want.text,
      flagged: want.mustBeOnFirstPage,
    };

    if (!found) {
      return {
        ...base,
        status: "not-found",
        page: null,
        depth: null,
        note: "Not found in the PDF's text, so its position could not be measured.",
      };
    }

    if (found.page > 1) {
      return {
        ...base,
        status: "later-page",
        page: found.page,
        depth: found.depth,
        note: want.mustBeOnFirstPage
          ? `Only on page ${found.page}. A first read may not reach it.`
          : `On page ${found.page}, which is usual when there is work history above it.`,
      };
    }

    if (want.zone !== undefined && found.depth > want.zone) {
      return {
        ...base,
        status: "low",
        page: 1,
        depth: found.depth,
        note: `Starts ${percent(found.depth)} of the way down page one. A shorter summary, or skills moved below experience, brings it up.`,
      };
    }

    return {
      ...base,
      status: "ok",
      page: 1,
      depth: found.depth,
      note: `On page one, ${percent(found.depth)} of the way down.`,
    };
  });

  const issues = targets.filter(
    (target) => target.flagged && (target.status === "low" || target.status === "later-page"),
  ).length;

  return { targets, issues };
}
