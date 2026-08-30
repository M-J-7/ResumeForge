/**
 * Field-recovery scorecard (M1-T2).
 *
 * The trick this whole feature rests on: **we know the correct answer.** We
 * generated the document, so we can re-parse our own output and grade the
 * result against the `ResumeDocument` it came from. Competitors can only
 * offer heuristics about whether a resume "looks ATS-friendly"; this is a
 * measurement.
 *
 * Which means the acceptance criterion runs the other way from most tests:
 * anything below 100% on our own fixtures is a bug in *our emitters*, not a
 * limitation of the scorecard. Finding those bugs is the point of building it.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { formatPartialDate } from "@/lib/resume/dates";
import type { ExtractedDocument } from "./extract";
import type { ResumeDocument } from "@/lib/resume/schema";

export interface RecoveredFields {
  name: string | null;
  email: string | null;
  phone: string | null;
  roles: RecoveredRole[];
}

export interface RecoveredRole {
  title: string | null;
  organization: string | null;
  startLabel: string | null;
  endLabel: string | null;
}

/* -------------------------------------------------------------------------- */
/* Recovery                                                                    */
/* -------------------------------------------------------------------------- */

const EMAIL = /[^\s@|]+@[^\s@|]+\.[A-Za-z]{2,}/;

/**
 * A phone number as a parser would look for one: a run of digits, spaces,
 * and the punctuation phone numbers actually use. Deliberately loose, then
 * validated by libphonenumber.
 */
const PHONE_CANDIDATE = /\+?[\d][\d\s().-]{6,}\d/g;

/**
 * The name is taken from the first line, which is the heuristic essentially
 * every parser uses and the reason we put the name there alone.
 *
 * A line is rejected if it looks like contact detail rather than a name —
 * otherwise a resume whose name failed to render would silently "recover" an
 * email address as the candidate's name, which is exactly the failure this
 * feature exists to make visible.
 */
function recoverName(lines: readonly string[]): string | null {
  for (const line of lines) {
    const candidate = line.trim();
    if (candidate.length === 0) continue;
    if (EMAIL.test(candidate)) return null;
    if (candidate.includes("|")) return null;
    if (/^\d/.test(candidate)) return null;
    return candidate;
  }
  return null;
}

function recoverEmail(text: string): string | null {
  return text.match(EMAIL)?.[0] ?? null;
}

/**
 * Validated with libphonenumber rather than by regex alone. A bare digit run
 * matches dates, credential ids, and quantified outcomes ("cut latency from
 * 400ms to 90ms"), so the check has to be for a *real* number.
 */
function recoverPhone(text: string): string | null {
  for (const candidate of text.match(PHONE_CANDIDATE) ?? []) {
    const trimmed = candidate.trim();
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.isValid()) return trimmed;
  }
  return null;
}

/**
 * Recovers roles by finding each date range and reading the lines around it.
 *
 * Two layouts have to work, because the two PDF strategies legitimately
 * produce different ones from the *same* document. A role header is visually
 * one line with the title left and the date right, so the geometric strategy
 * reports `"Senior Backend Engineer  Mar 2022 – Present"`. Stream order sees
 * the underlying emission order instead — the whole left column, then the
 * right — giving title, then organization, then date on separate lines.
 *
 * Neither is wrong, and the difference is exactly what M1-T3 surfaces to the
 * user. But the scorecard has to model a *competent* parser, so it handles
 * both rather than scoring our own output down for a layout a real parser
 * would read correctly.
 */
const DATE_RANGE = /([A-Z][a-z]{2}\s+\d{4}|\d{4})\s*[–-]\s*(Present|[A-Z][a-z]{2}\s+\d{4}|\d{4})/;

/** Section headings and similar chrome are never a job title. */
function isStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (DATE_RANGE.test(trimmed)) return true;
  // Headings render uppercased, so an all-caps line is chrome, not content.
  return trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
}

/** The organization leads its line; the location is right-aligned after it. */
function leadingField(line: string | undefined): string | null {
  const value = line?.split(/\s{2,}|\s+·\s+/)[0]?.trim();
  return value && value.length > 0 ? value : null;
}

function recoverRoles(lines: readonly string[]): RecoveredRole[] {
  const roles: RecoveredRole[] = [];

  lines.forEach((line, index) => {
    const match = line.match(DATE_RANGE);
    if (!match) return;

    const before = line.slice(0, match.index).trim();

    if (before.length > 0) {
      // Geometric: title and date share the visual line.
      roles.push({
        title: before,
        organization: leadingField(lines[index + 1]),
        startLabel: match[1] ?? null,
        endLabel: match[2] ?? null,
      });
      return;
    }

    // Stream order: the date stands alone, with the title and organization
    // immediately above it. Walk back over anything structural.
    const organizationLine = lines[index - 1];
    const titleLine = lines[index - 2];
    if (!titleLine || isStructuralLine(titleLine)) return;

    roles.push({
      title: leadingField(titleLine),
      organization:
        organizationLine && !isStructuralLine(organizationLine)
          ? leadingField(organizationLine)
          : null,
      startLabel: match[1] ?? null,
      endLabel: match[2] ?? null,
    });
  });

  return roles;
}

export function recoverFields(extracted: ExtractedDocument): RecoveredFields {
  return {
    name: recoverName(extracted.lines),
    email: recoverEmail(extracted.text),
    phone: recoverPhone(extracted.text),
    roles: recoverRoles(extracted.lines),
  };
}

/* -------------------------------------------------------------------------- */
/* Grading                                                                     */
/* -------------------------------------------------------------------------- */

export type FieldStatus = "recovered" | "wrong" | "missing" | "not-applicable";

export interface FieldResult {
  field: string;
  status: FieldStatus;
  expected: string;
  actual: string | null;
  /** Contributes this much to the weighted score. */
  weight: number;
}

export interface Scorecard {
  strategy: string;
  fields: FieldResult[];
  /** Weighted percentage recovered, 0–100. */
  score: number;
}

/**
 * Contact details and the most recent role carry the most weight, because
 * they carry the most consequence: a recruiter who cannot reach you, or who
 * sees the wrong current employer, is a worse outcome than a garbled third
 * job from eight years ago.
 */
const WEIGHTS = {
  name: 3,
  email: 3,
  phone: 2,
  mostRecentRole: 2,
  otherRole: 1,
} as const;

/** Comparison that ignores differences no human or parser would care about. */
function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9@.+\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(expected: string, actual: string | null): boolean {
  if (actual === null) return false;
  const a = normalizeForComparison(expected);
  const b = normalizeForComparison(actual);
  if (a === b) return true;
  // A parser that recovered the field plus adjacent text still found it.
  return b.includes(a) && a.length > 0;
}

function grade(
  field: string,
  expected: string,
  actual: string | null,
  weight: number,
): FieldResult {
  if (expected.trim().length === 0) {
    return { field, status: "not-applicable", expected, actual, weight: 0 };
  }
  if (actual === null) return { field, status: "missing", expected, actual, weight };
  return {
    field,
    status: matches(expected, actual) ? "recovered" : "wrong",
    expected,
    actual,
    weight,
  };
}

/** Phone comparison goes through libphonenumber so formatting cannot fail it. */
function gradePhone(expected: string, actual: string | null): FieldResult {
  if (expected.trim().length === 0) {
    return { field: "phone", status: "not-applicable", expected, actual, weight: 0 };
  }
  if (actual === null) {
    return { field: "phone", status: "missing", expected, actual, weight: WEIGHTS.phone };
  }
  const a = parsePhoneNumberFromString(expected);
  const b = parsePhoneNumberFromString(actual);
  const same = a && b ? a.number === b.number : matches(expected, actual);
  return {
    field: "phone",
    status: same ? "recovered" : "wrong",
    expected,
    actual,
    weight: WEIGHTS.phone,
  };
}

export function scoreRecovery(
  truth: ResumeDocument,
  recovered: RecoveredFields,
  strategy: string,
): Scorecard {
  const fields: FieldResult[] = [
    grade("name", truth.contact.fullName, recovered.name, WEIGHTS.name),
    grade("email", truth.contact.email, recovered.email, WEIGHTS.email),
    gradePhone(truth.contact.phone, recovered.phone),
  ];

  const experience = truth.sections.find((s) => s.type === "experience");
  const trueRoles =
    experience?.type === "experience" && experience.visible ? experience.entries : [];

  // Roles are matched by title rather than by position: a parser that
  // recovers them out of order has still recovered them, and grading by
  // index would report a false failure for the whole run.
  //
  // Exact titles are claimed first, and each recovered role is used once.
  // Both matter: "Backend Engineer" is a substring of "Senior Backend
  // Engineer", so a greedy substring pass hands the junior role the senior
  // role's employer and dates, then reports the mismatch as a parse failure
  // that never happened.
  const claimed = new Set<number>();

  const claim = (title: string): RecoveredRole | null => {
    const exact = recovered.roles.findIndex(
      (role, i) =>
        !claimed.has(i) &&
        role.title !== null &&
        normalizeForComparison(role.title) === normalizeForComparison(title),
    );
    const index =
      exact !== -1
        ? exact
        : recovered.roles.findIndex(
            (role, i) => !claimed.has(i) && role.title !== null && matches(title, role.title),
          );
    if (index === -1) return null;
    claimed.add(index);
    return recovered.roles[index] ?? null;
  };

  // Claim exact matches across all roles before any fuzzy ones, so a fuzzy
  // match cannot take a role that an exact match needed.
  const matched = new Map<string, RecoveredRole | null>();
  for (const entry of trueRoles) matched.set(entry.id, null);
  for (const entry of trueRoles) {
    const exact = recovered.roles.findIndex(
      (role, i) =>
        !claimed.has(i) &&
        role.title !== null &&
        normalizeForComparison(role.title) === normalizeForComparison(entry.title),
    );
    if (exact === -1) continue;
    claimed.add(exact);
    matched.set(entry.id, recovered.roles[exact] ?? null);
  }

  trueRoles.forEach((entry, index) => {
    const weight = index === 0 ? WEIGHTS.mostRecentRole : WEIGHTS.otherRole;
    const match = matched.get(entry.id) ?? claim(entry.title);

    fields.push(
      grade(`role.${index}.title`, entry.title, match?.title ?? null, weight),
      grade(`role.${index}.organization`, entry.organization, match?.organization ?? null, weight),
      grade(
        `role.${index}.start`,
        formatPartialDate(entry.dates.start),
        match?.startLabel ?? null,
        weight,
      ),
      grade(
        `role.${index}.end`,
        entry.dates.current ? "Present" : entry.dates.end ? formatPartialDate(entry.dates.end) : "",
        match?.endLabel ?? null,
        weight,
      ),
    );
  });

  const graded = fields.filter((f) => f.status !== "not-applicable");
  const total = graded.reduce((sum, f) => sum + f.weight, 0);
  const earned = graded
    .filter((f) => f.status === "recovered")
    .reduce((sum, f) => sum + f.weight, 0);

  return {
    strategy,
    fields,
    score: total === 0 ? 100 : Math.round((earned / total) * 100),
  };
}
