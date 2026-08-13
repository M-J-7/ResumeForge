/**
 * Resume dates.
 *
 * Dates are stored structurally as `{ year, month }`, never as a formatted
 * string. Formatting is a render concern, and storing "03/04/2023" would be
 * ambiguous between US and international readers.
 *
 * Output uses month *names* ("Jan 2023 – Present") specifically because that
 * form reads identically everywhere, which matters for a global audience and
 * keeps ATS date parsing unambiguous.
 */

export interface PartialDate {
  /** Four-digit year. */
  year: number;
  /** 1–12, or null when the user gave only a year. */
  month: number | null;
}

export interface DateRange {
  start: PartialDate;
  /** Null exactly when `current` is true. */
  end: PartialDate | null;
  current: boolean;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** En dash (U+2013) — the typographically correct range separator. */
export const DATE_RANGE_SEPARATOR = "–";

export const PRESENT_LABEL = "Present";

/**
 * Orders two partial dates. A year-only date sorts before any month in the
 * same year, so `{2023, null}` precedes `{2023, 3}`.
 */
export function compareDates(a: PartialDate, b: PartialDate): number {
  if (a.year !== b.year) return a.year - b.year;
  return (a.month ?? 0) - (b.month ?? 0);
}

export function formatPartialDate(date: PartialDate): string {
  if (date.month === null) return String(date.year);
  const name = MONTH_NAMES[date.month - 1];
  // Guard rather than assert: month is schema-validated to 1–12, but this
  // function is also reachable from migration code handling untrusted input.
  if (name === undefined) return String(date.year);
  return `${name} ${date.year}`;
}

export function formatDateRange(range: DateRange): string {
  const start = formatPartialDate(range.start);
  const end = range.current
    ? PRESENT_LABEL
    : range.end
      ? formatPartialDate(range.end)
      : PRESENT_LABEL;
  return `${start} ${DATE_RANGE_SEPARATOR} ${end}`;
}

/** True when the range is internally consistent (used by schema refinement). */
export function isValidRange(range: DateRange): boolean {
  if (range.current) return range.end === null;
  if (range.end === null) return false;
  return compareDates(range.start, range.end) <= 0;
}
