/**
 * The date on a letter.
 *
 * Its own module for one reason: it must not use `Intl.DateTimeFormat`.
 * Node builds vary in the ICU data they ship — a small-icu build formats
 * `"en-GB"` as `en-US` without saying so — and the emitters' golden-text
 * tests would then pass on one machine and fail on another. The month names
 * are written out, which is also what `lib/resume/dates.ts` already does for
 * the resume's date ranges.
 *
 * `1 September 2026` rather than `09/01/2026`: a numeric date is ambiguous
 * across the Atlantic and a letter is read by a person, not a parser.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Returns null for an unparseable date rather than "Invalid Date". */
export function formatLetterDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const month = MONTHS[date.getMonth()];
  if (!month) return null;
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/**
 * Parses a stored `YYYY-MM-DD` into a *local* date.
 *
 * `new Date("2026-09-01")` is specified to parse as UTC midnight, so in any
 * timezone west of Greenwich `getDate()` on the result returns the 31st of
 * August. A letter dated a day earlier than the user chose is a small bug
 * with an embarrassing failure mode, so the string is split rather than
 * handed to the Date parser.
 */
export function parseDateISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** The ISO calendar date, with no time component — what the letter stores. */
export function toDateISO(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
