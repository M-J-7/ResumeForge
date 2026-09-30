/**
 * What changed on the site, dated by when it reached it (ROADMAP R7).
 *
 * Two jobs. For a person deciding whether to trust a tool with their resume,
 * a dated record of what it does and when it changed is evidence the thing is
 * maintained and says what it is doing — the same reason the trust signals
 * name where each claim can be checked. For a crawler, it is a page that
 * genuinely changes, dated honestly (`changelog.test.ts` keeps the dates in
 * order and the sitemap takes the newest).
 *
 * Written for visitors, not for this repository: what they can now do, see or
 * rely on, in their words. Held to D14 like every other page — a change is
 * described, never sold with an outcome.
 */

import { PRODUCT_NAME } from "@/lib/product";

export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  /** When it reached the live site, `YYYY-MM-DD`. */
  date: string;
  kind: ChangeKind;
  title: string;
  body: string;
  link?: { href: string; label: string };
}

/** Newest first. */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-09-30",
    kind: "new",
    title: "Every template downloads free as Word or PDF",
    body:
      "Each template on the templates page now has Word and PDF buttons. The file is made in your " +
      "browser, by the same code the builder downloads with, from the sample resume its picture " +
      "shows — nothing is uploaded, and there is no watermark.",
    link: { href: "/templates", label: "Browse the templates" },
  },
  {
    date: "2026-09-30",
    kind: "new",
    title: "A reminder to keep a copy",
    body:
      "Without an account, your resume lives only in this browser, which is what keeps it private " +
      "and also means clearing your browsing data deletes it. Once there is something to lose, the " +
      "builder now says so and offers a backup file that opens here again, or an account. Answer " +
      "either way and it stays quiet for a month.",
  },
  {
    date: "2026-09-30",
    kind: "improved",
    title: "Pages load faster on phones",
    body:
      "Every page now loads about a third of the script it used to: the PDF and document-reading " +
      "code arrives only when you use it. Page titles appear with the page instead of waiting for " +
      "scripts to run, and the template gallery's pictures are images drawn once from the real " +
      "renderer rather than drawn in your browser on every visit. On Lighthouse's throttled-phone " +
      "test, measured against this site, pages that scored 76 to 91 now score 93 to 99.",
  },
  {
    date: "2026-09-30",
    kind: "new",
    title: "A plain account of what we count",
    body:
      "The site now keeps a tally of page views and of which tools get used — one number per thing " +
      "per day, with no cookie, no identifier and nothing you type. The privacy page lists every " +
      "count. Browsers that send Global Privacy Control or Do Not Track are not counted at all.",
    link: { href: "/privacy", label: "What we count" },
  },
  {
    date: "2026-09-29",
    kind: "new",
    title: "Eight new example resumes, for India and the US",
    body:
      "For India: a software engineer fresher, a B.Com fresher, an MBA fresher and a BPO customer " +
      "support executive, set on A4. For the US: a cashier, a medical assistant, a warehouse " +
      "associate and a certified nursing assistant, set on US Letter. Each shows the plain text a " +
      "parser reads from it.",
    link: { href: "/examples", label: "See the examples" },
  },
  {
    date: "2026-09-29",
    kind: "improved",
    title: "The keyword match knows more fields",
    body:
      "Matching a resume against a job description now recognises around 150 terms from " +
      "healthcare, teaching, office work, finance, retail, HR, sales and engineering, so a nurse's " +
      "or a teacher's resume is compared on its own vocabulary and not only on software terms.",
  },
  {
    date: "2026-09-29",
    kind: "new",
    title: "The Six-Second View",
    body:
      "A new tab in the builder shows where the facts a first read looks for — your name, your " +
      "current and previous roles, your education — land on page one of your actual PDF, and flags " +
      "a current role pushed low or a fact that has slipped to page two.",
    link: { href: "/builder", label: "Open the builder" },
  },
  {
    date: "2026-09-29",
    kind: "new",
    title: "Three free tools",
    body:
      "A keyword scanner that compares a job posting with your resume, a bullet point checker that " +
      "asks what each bullet is missing, and a list of action verbs grouped by what you did. All " +
      "three run in your browser; nothing you paste is sent anywhere.",
    link: { href: "/resume-keyword-scanner", label: "Try the keyword scanner" },
  },
  {
    date: "2026-09-29",
    kind: "fixed",
    title: "Imports keep the first bullet of every role",
    body:
      "Importing a PDF or Word resume whose bullets were marked with ● or a hyphen dropped the " +
      "first bullet under each job. It no longer does.",
  },
  {
    date: "2026-09-29",
    kind: "improved",
    title: "Spell-check where you write sentences",
    body:
      "Summaries, bullets and descriptions are spell-checked in every browser. Names, email " +
      "addresses, phone numbers, links and skills are left alone, where a red underline would only " +
      "be wrong.",
  },
  {
    date: "2026-09-29",
    kind: "improved",
    title: "A new look, and a page that says what is free",
    body:
      "The site was redesigned throughout. The pricing page says plainly what will always be " +
      "free — every download, in every format, with or without an account — and what an account " +
      "adds.",
    link: { href: "/pricing", label: "What is free" },
  },
  {
    date: "2026-09-12",
    kind: "new",
    title: `${PRODUCT_NAME} is live`,
    body:
      "The builder, the free ATS check, and PDF, Word, plain-text and JSON Resume downloads — free, " +
      "with no account needed. An account is optional; resumes saved to one are backed up off-site " +
      "continuously.",
  },
];

/** The newest entry's date: the page's "last updated" and its sitemap date. */
export const CHANGELOG_UPDATED = CHANGELOG[0]!.date;

/** The entries grouped by day, newest day first, in the order written. */
export function changelogByDay(): { date: string; entries: ChangelogEntry[] }[] {
  const days: { date: string; entries: ChangelogEntry[] }[] = [];
  for (const entry of CHANGELOG) {
    const day = days.at(-1);
    if (day?.date === entry.date) day.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  }
  return days;
}
