/**
 * The "last changed" dates on the content pages (ROADMAP Phase 1.4).
 *
 * One date per example and per guide (`updated`, on the data), used three
 * ways: the sitemap's `lastModified`, the Article's `dateModified`, and an
 * "Updated" line a reader can see. Google uses `lastmod` to decide what to
 * recrawl — and stops trusting a site's dates once they are shown to be
 * wrong, which is why `content-dates.test.ts` makes a stale one fail the
 * build rather than trusting anybody to remember.
 *
 * Dates are formatted by hand from the `YYYY-MM-DD` string rather than
 * through `Date`: `new Date("2026-09-10")` is midnight UTC, and formatting it
 * in a server west of Greenwich prints the ninth.
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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-09-10` → `10 September 2026`. Day first reads the same in India, the UK and the US. */
export function formatContentDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (!name) throw new Error(`No month ${month} in ${iso}`);
  return `${Number(day)} ${name} ${year}`;
}

/** The newest of a set of dates — what an index page's own `lastmod` is. */
export function latestUpdate(items: readonly { updated: string }[]): string | undefined {
  // Lexical order is date order for YYYY-MM-DD, which is why that shape is required.
  return items.reduce<string | undefined>(
    (latest, item) => (latest === undefined || item.updated > latest ? item.updated : latest),
    undefined,
  );
}

/** Whether a string is a real `YYYY-MM-DD` calendar date. */
export function isContentDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
