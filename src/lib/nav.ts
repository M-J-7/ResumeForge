/**
 * The site's navigation, in one place.
 *
 * The header and the footer were two hand-written arrays that had already
 * drifted: `/guides` publishes four indexed pages and appeared only in the
 * footer, so the one route a visitor reads *before* deciding to build
 * anything was unreachable from the bar at the top of every page. The header
 * meanwhile carried a "Builder" link sitting next to nothing that looked like
 * a call to action, which is the arrangement every shipped product abandons —
 * the highest-intent destination is a button, not the fourth item in a row of
 * grey text.
 *
 * Keeping both surfaces on one export is what stops that recurring. It is
 * also what lets the footer group links into columns without restating the
 * hrefs: a column is a title plus a slice of the same link objects.
 *
 * `external` marks the one link that leaves the site. It is not decoration —
 * `AppFooter` renders those as real `<a>` elements with `rel="noreferrer"`
 * and an icon, because a link that opens a new tab has to say so before it is
 * clicked.
 */

import { REPO_URL } from "./site";

/**
 * Where the header's skip link lands.
 *
 * Here rather than beside the header, because `BuilderShell` needs it too and
 * it is a client component — importing the constant from `AppHeader` would
 * drag `getSessionUser` and the session machinery into the builder's bundle.
 */
export const MAIN_CONTENT_ID = "main-content";

export interface NavLink {
  href: string;
  label: string;
  /** Leaves this origin. Rendered as an `<a>` with an out-of-site marker. */
  external?: boolean;
}

/**
 * The one action the header is for.
 *
 * `/builder` is deliberately not also a nav link. A row of five equal-weight
 * links, one of which is the thing the whole page is asking you to do, is how
 * a landing page ends up with no primary action at all.
 */
export const PRIMARY_CTA: NavLink = { href: "/builder", label: "Start building" };

const TEMPLATES: NavLink = { href: "/templates", label: "Templates" };
const EXAMPLES: NavLink = { href: "/examples", label: "Examples" };
const CHECK: NavLink = { href: "/check", label: "Check" };
const LETTERS: NavLink = { href: "/letters", label: "Cover letters" };
const GUIDES: NavLink = { href: "/guides", label: "Guides" };
const PRICING: NavLink = { href: "/pricing", label: "Pricing" };

/** The bar, signed out. Ordered by where a first-time visitor starts. */
export const HEADER_LINKS: readonly NavLink[] = [
  TEMPLATES,
  EXAMPLES,
  CHECK,
  LETTERS,
  GUIDES,
  // Last, and deliberately so. The page's argument is that almost nothing is
  // behind a price, which is a thing to find rather than a thing to lead with
  // — and a bar that opens with "Pricing" says the opposite before it is read.
  PRICING,
];

/** Appended once there is an account to have resumes in. */
export const HEADER_SIGNED_IN_LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "My resumes" },
];

/**
 * The footer, in columns.
 *
 * Three groups rather than one long row: the row was seven links wide and
 * read as a single undifferentiated strip, which is the least useful shape a
 * footer can take. Columns give each destination a heading that says what
 * kind of thing it is, and they are what make the footer worth crawling —
 * `/examples` publishes eight pages and `/guides` four, and internal links
 * from every page are how they get discovered at all.
 */
export const FOOTER_SECTIONS: readonly { title: string; links: readonly NavLink[] }[] = [
  {
    title: "Build",
    links: [
      // Not `PRIMARY_CTA`: "Start building" is an instruction, and a column of
      // destinations reads badly with one imperative in it. Same href, named
      // the way the other three are.
      { href: PRIMARY_CTA.href, label: "Resume builder" },
      TEMPLATES,
      LETTERS,
      { href: CHECK.href, label: "ATS check" },
      { href: "/bullet-point-checker", label: "Bullet checker" },
    ],
  },
  {
    title: "Learn",
    links: [EXAMPLES, GUIDES, { href: "/resume-action-verbs", label: "Action verbs" }],
  },
  {
    title: "About",
    links: [
      PRICING,
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: REPO_URL, label: "Source code", external: true },
    ],
  },
];

/**
 * The bottom rule, and the whole of the minimal footer.
 *
 * `/signin` renders the compact variant, where a three-column sitemap under a
 * one-field form would outweigh the form. These are the links a page is
 * legally expected to carry wherever it appears.
 */
export const LEGAL_LINKS: readonly NavLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: REPO_URL, label: "Source", external: true },
];

/**
 * Whether the bar should be asking for the primary action on this route.
 *
 * It should not on `/builder`, where the button would navigate to the page
 * showing it. The header renders on every route, so this is the one place the
 * rule lives — the desktop copy in `AppHeader` and the panel copy in
 * `HeaderNav` both read it, and a header that offered the action in one place
 * and withheld it in the other would look like a rendering fault.
 */
export function showsPrimaryCta(pathname: string): boolean {
  return !(pathname === PRIMARY_CTA.href || pathname.startsWith(`${PRIMARY_CTA.href}/`));
}
