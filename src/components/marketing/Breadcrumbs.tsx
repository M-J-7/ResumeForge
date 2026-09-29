/**
 * The trail above a content page's title, drawn from the same list the
 * `BreadcrumbList` JSON-LD is built from — so what a search result shows and
 * what the reader sees cannot disagree.
 *
 * Every crumb but the last is a link; the last is where you are, marked with
 * `aria-current` and left as text, because a link to the page you are on is a
 * control that does nothing.
 */

import Link from "next/link";

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumbs({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-faint text-small flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-muted">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link
                    href={crumb.path}
                    className="hover:text-text rule-grow rounded-sm font-medium"
                  >
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
