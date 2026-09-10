/**
 * Reading dates out of somebody else's resume (P31-A2).
 *
 * `lib/resume/dates.ts` writes one canonical form and reads none, which is
 * correct for our own documents: we chose the format. An imported resume was
 * written by whoever wrote it, in whatever their word processor offered, so
 * this module is the inverse — it accepts the forms real resumes use and
 * returns the structural `DateRange` the schema stores.
 *
 * ## What it deliberately will not do
 *
 * There is no `dd/mm/yyyy` vs `mm/dd/yyyy` guess. `03/04/2023` is March in
 * one hemisphere and April in the other, and there is nothing in a resume
 * that disambiguates it. A numeric date with a day component therefore
 * resolves to the **year only**, and the field is reported at low confidence
 * so the user is asked rather than told. Silently picking one convention
 * would move somebody's start date by a month and never say so — which is
 * the failure mode this whole import path exists to avoid.
 *
 * `mm/yyyy` is unambiguous once there is no day, so that one is read fully.
 */

import type { DateRange, PartialDate } from "@/lib/resume/dates";

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** Words a resume uses for "still there". */
const PRESENT = /^(present|current|now|ongoing|to\s*date|till\s*date|date)$/i;

/**
 * Separators between the two ends of a range.
 *
 * Includes the word "to" because plenty of resumes write it out, and the
 * various dashes because a document that has been through a word processor's
 * autocorrect has an en dash where the author typed a hyphen.
 */
const SEPARATOR = /\s*(?:[–—−-]{1,2}|\b(?:to|till|until|through|thru)\b)\s*/i;

const YEAR = /^(19|20)\d{2}$/;

export interface ParsedDate {
  date: PartialDate;
  /** False when a day component made the month ambiguous — see the docblock. */
  monthCertain: boolean;
}

/** Reads one end of a range. Returns null when the text is not a date. */
export function parsePartialDate(raw: string): ParsedDate | null {
  const text = raw.trim().replace(/[.,]+$/, "");
  if (text.length === 0) return null;

  // "Mar 2022", "March 2022", "Mar. 2022"
  const named = text.match(/^([A-Za-z]{3,9})\.?\s+(?:of\s+)?((?:19|20)\d{2})$/);
  if (named) {
    const month = MONTHS[(named[1] ?? "").toLowerCase()];
    if (month !== undefined) {
      return { date: { year: Number(named[2]), month }, monthCertain: true };
    }
  }

  // "2022 Mar" — less common, but Indian and continental templates do it.
  const reversed = text.match(/^((?:19|20)\d{2})\s+([A-Za-z]{3,9})\.?$/);
  if (reversed) {
    const month = MONTHS[(reversed[2] ?? "").toLowerCase()];
    if (month !== undefined) {
      return { date: { year: Number(reversed[1]), month }, monthCertain: true };
    }
  }

  // "03/2022", "03-2022". No day component, so the month is unambiguous.
  const numericMonth = text.match(/^(\d{1,2})[/\\.-]((?:19|20)\d{2})$/);
  if (numericMonth) {
    const month = Number(numericMonth[1]);
    if (month >= 1 && month <= 12) {
      return { date: { year: Number(numericMonth[2]), month }, monthCertain: true };
    }
  }

  // "03/04/2023" — the case the docblock refuses to guess at.
  const numericFull = text.match(/^\d{1,2}[/\\.-]\d{1,2}[/\\.-]((?:19|20)\d{2})$/);
  if (numericFull) {
    return { date: { year: Number(numericFull[1]), month: null }, monthCertain: false };
  }

  if (YEAR.test(text)) return { date: { year: Number(text), month: null }, monthCertain: true };

  return null;
}

export interface ParsedDateRange {
  range: DateRange;
  /** Character offset of the match within the line it was found in. */
  index: number;
  /** Length of the matched text, so the caller can slice around it. */
  length: number;
  /** False when either end had to fall back to a year — see the docblock. */
  certain: boolean;
}

/**
 * A date range as it might appear anywhere in a line.
 *
 * The scan is over *candidate* substrings rather than one big regex, because
 * one regex covering every accepted form is unreadable and, worse, unfixable
 * — the JD parser learned the same thing about heading patterns. Each half
 * is validated by `parsePartialDate`, which is the single definition of what
 * a date is.
 *
 * ## The month word is spelled out, not "any short word"
 *
 * This began as `[A-Za-z]{3,9}\.?\s+`, which is wrong in a way that stays
 * invisible until it is not. `"Research Associate 2026 – Present"` matched
 * with `Associate` as the month word; `parsePartialDate` then rejected the
 * pair, and the line came back **undated** — so the role lost its dates, its
 * title and its employer together, and the section collapsed into one entry
 * per line. A token pattern that is too loose here does not produce a
 * slightly wrong date. It produces no date, and takes the entry with it.
 *
 * The `\b` after the alternation is what stops `Marketing` matching as `mar`
 * and `Senior` as `sep`.
 */
const MONTH_ALTERNATION =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b";

/** `Mar 2022`, `2022 Mar`, `03/04/2023`, `03/2022`, `2022` — in that order. */
const DATE_TOKEN_SOURCE = [
  `${MONTH_ALTERNATION}\\.?\\s+(?:19|20)\\d{2}`,
  `(?:19|20)\\d{2}\\s+${MONTH_ALTERNATION}\\.?`,
  `\\d{1,2}[/\\\\.-]\\d{1,2}[/\\\\.-](?:19|20)\\d{2}`,
  `\\d{1,2}[/\\\\.-](?:19|20)\\d{2}`,
  `(?:19|20)\\d{2}`,
].join("|");

const DATE_TOKEN = new RegExp(DATE_TOKEN_SOURCE, "gi");

/** One end of a range, anchored — the same forms, matched at the start. */
const DATE_TOKEN_AT_START = new RegExp(`^(?:${DATE_TOKEN_SOURCE}|[A-Za-z]+)`, "i");

export function findDateRange(line: string): ParsedDateRange | null {
  DATE_TOKEN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DATE_TOKEN.exec(line)) !== null) {
    const startText = match[0];
    const index = match.index;
    const start = parsePartialDate(startText);
    if (!start) {
      // Resume one character in rather than past the whole token: a token
      // this function could not parse — `13/2022`, say — must not swallow
      // the readable year sitting inside it.
      DATE_TOKEN.lastIndex = index + 1;
      continue;
    }

    const after = line.slice(index + startText.length);
    const separator = SEPARATOR.exec(after);
    if (!separator || separator.index !== 0) {
      // A lone date: a graduation year, a certification issue date. Still a
      // usable range for a single-point entry, reported as such by having
      // start and end be the same instant.
      continue;
    }

    const rest = after.slice(separator[0].length);
    // The trailing `[A-Za-z]+` alternative is what catches "Present" and the
    // other words a resume uses for "still there"; it is last so a real date
    // is always preferred over reading one as a word.
    const endText = DATE_TOKEN_AT_START.exec(rest)?.[0];
    if (!endText) continue;

    const length = startText.length + separator[0].length + endText.length;

    if (PRESENT.test(endText.trim())) {
      return {
        range: { start: start.date, end: null, current: true },
        index,
        length,
        certain: start.monthCertain,
      };
    }

    const end = parsePartialDate(endText);
    if (!end) continue;

    // A range that runs backwards fails `isValidRange` and would be rejected
    // by the schema. Ordering it is the only repair that keeps the user's
    // two numbers; reporting it as uncertain is how they find out.
    const backwards =
      end.date.year < start.date.year ||
      (end.date.year === start.date.year && (end.date.month ?? 0) < (start.date.month ?? 0));

    return {
      range: backwards
        ? { start: end.date, end: start.date, current: false }
        : { start: start.date, end: end.date, current: false },
      index,
      length,
      certain: start.monthCertain && end.monthCertain && !backwards,
    };
  }

  return null;
}

/** A single date with no range — a graduation year or an issue date. */
export function findSingleDate(line: string): { date: PartialDate; index: number } | null {
  DATE_TOKEN.lastIndex = 0;
  for (const match of line.matchAll(DATE_TOKEN)) {
    const parsed = parsePartialDate(match[0]);
    if (parsed) return { date: parsed.date, index: match.index ?? 0 };
  }
  return null;
}
