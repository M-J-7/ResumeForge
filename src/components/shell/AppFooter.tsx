/**
 * The application footer (P22-E1).
 *
 * Mounted per page rather than in the root layout, and that is deliberate.
 * `/builder` is a full-height three-column application view whose preview pane
 * fills the space beneath the header; a footer in the root layout would take
 * height from it on every render and shrink the resume canvas. Content pages
 * want a footer, application pages do not, and there is no way to express that
 * from a single shared layout without a route group and a page move.
 *
 * ## What the shipped version changed
 *
 * It was one sentence and a row of seven links. That is a placeholder shape:
 * seven destinations of different kinds — a tool, two content hubs, two legal
 * pages — laid end to end with nothing saying which was which, so the strip
 * read as undifferentiated and the eye skipped it. A footer is the last thing
 * a visitor who did not convert looks at, and the only navigation a crawler
 * finds on every single page.
 *
 * Three changes:
 *
 *   - **A brand block.** The mark, the name, and the position in two
 *     sentences. It is what turns the strip into the bottom of a site rather
 *     than a list of links that happens to be last.
 *   - **Columns with headings.** `Build`, `Learn`, `About` — grouped in
 *     `lib/nav.ts` beside the header's links, so the two surfaces cannot
 *     drift the way they had (`/guides` was in this footer and nowhere in the
 *     bar). The headings are real `<h2>`s inside a labelled `<nav>`, which is
 *     what lets a screen-reader user jump the whole block.
 *   - **A bottom rule.** Copyright and the one line that explains the name.
 *     Its absence is the single most reliable tell that a site is a draft.
 *
 * The links are still not decoration: `/examples` publishes eight pages and
 * `/guides` four, and internal links from every crawled page are how they get
 * discovered at all. The underline arrives on hover and focus, where it is
 * doing a job, and it grows from the left (`.rule-grow`) — the same gesture
 * the section rules on the landing page make.
 *
 * ## The `minimal` variant
 *
 * `/signin` is a single field in a narrow column. A three-column sitemap
 * under it would outweigh the form it is meant to support, so that page gets
 * the legal row and the copyright and nothing else. One component with two
 * shapes rather than two components, because the thing that must not drift is
 * the legal row, and it drifts the moment it is written twice.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon, FileTextIcon } from "@/components/ui/icons";
import { FOOTER_SECTIONS, LEGAL_LINKS, type NavLink } from "@/lib/nav";
import { PRODUCT_NAME } from "@/lib/product";

/**
 * The copyright year, resolved when the page renders.
 *
 * Statically prerendered routes freeze it at build time, which is the usual
 * trade every site makes here — the alternative is a client component whose
 * only job is to correct one number after hydration, and a hydration mismatch
 * on every page is a worse thing to own than a year that a deploy refreshes.
 */
function currentYear(): number {
  return new Date().getFullYear();
}

/** A footer link, internal or not. */
function FooterLink({ link, className }: { link: NavLink; className?: string }) {
  const classes = cn(
    "text-muted hover:text-text focus-visible:ring-accent rule-grow inline-flex items-center gap-1",
    "rounded-sm text-sm transition-colors duration-[var(--dur-fast)]",
    "focus-visible:ring-2 focus-visible:outline-none",
    className,
  );

  /*
   * A real anchor for the one link that leaves the site, with the marker
   * beside the label rather than only in the `rel`. A new tab that opens
   * without warning is disorienting for exactly the people least able to
   * recover from it, and `next/link` would prefetch a host we do not own.
   */
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={classes}>
        {link.label}
        <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <Link href={link.href} className={classes}>
      {link.label}
    </Link>
  );
}

export interface AppFooterProps {
  className?: string;
  /** `minimal` is the legal row alone — see the note above. */
  variant?: "full" | "minimal";
}

export function AppFooter({ className, variant = "full" }: AppFooterProps) {
  const year = currentYear();

  /*
   * The padding here is on the element the caller can reach, and it is not
   * responsive, so a page embedding this inside its own column can cancel it
   * outright with `px-0`. `cn` merges, but a plain `px-0` would leave an
   * `sm:px-6` standing and inset the row by 24px at every width that matters.
   * `/signin` does exactly that.
   */
  if (variant === "minimal") {
    return (
      <footer className={cn("border-line mt-auto border-t px-6 py-8", className)}>
        <div className="text-faint mx-auto flex max-w-5xl flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {PRODUCT_NAME}
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterLink link={link} className="text-xs" />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className={cn("border-line mt-auto border-t", className)}>
      {/* The padding lives inside the width cap, exactly as it does in
          `AppHeader`. With it on the `<footer>` instead, the two containers
          resolve to different left edges above 1328px and the footer’s
          wordmark sits 24px inboard of the header’s — a misalignment that is
          invisible in a component and obvious on the page. */}
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:gap-20">
          {/* The brand block. It is the only place in the footer with a mark,
              which is what stops the whole thing reading as a run of links. */}
          <div>
            <Link
              href="/"
              className="text-text focus-visible:ring-accent group inline-flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
            >
              <FileTextIcon className="text-accent h-5 w-5 transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:-rotate-6" />
              {PRODUCT_NAME}
            </Link>
            <p className="text-muted mt-4 max-w-xs text-sm leading-relaxed text-balance">
              Built to be honest about what a resume can and cannot do.
            </p>
            <p className="text-faint mt-3 max-w-xs text-sm leading-relaxed text-balance">
              Every download is free, permanently. It works without an account, and nothing leaves
              your browser unless you ask it to.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="text-text text-xs font-semibold tracking-[0.08em] uppercase">
                  {section.title}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {section.links.map((link) => (
                    <li key={`${section.title}:${link.href}`}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* The bottom rule. Two facts and no links — everything clickable is
            already in the columns above, and a second copy of them here is
            how a footer gets to twenty links nobody reads. */}
        <div className="border-line text-faint mt-14 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {PRODUCT_NAME}
          </p>
          <p className="text-balance">
            Named for the six seconds a recruiter spends before deciding.
          </p>
        </div>
      </div>
    </footer>
  );
}
