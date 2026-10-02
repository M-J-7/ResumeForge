/**
 * What an example page says in a search result: its title and description.
 *
 * ## Written for the query, which differs by market
 *
 * In India the search is "<role> resume format", and very often "… format
 * download" or "… in Word". In the US it is "<role> resume example" or
 * "… template". The page is the same kind of page either way, so the title
 * follows the market the example is written for, and says what the page now
 * gives — a free Word and PDF file — because a results page full of
 * "free download" titles is what the searcher is choosing between.
 *
 * The heading on the page stays "<role> resume example": it is written for a
 * reader who has arrived, and the breadcrumb and `reference.spec.ts` use it.
 *
 * ## Sixty characters, and no site name
 *
 * The 2026-10-02 audit found example titles of 63–68 characters, so results
 * cut the role-specific end. The guides solved the same problem by dropping
 * the site name (`search-title.test.ts`); Google shows the name from the
 * `WebSite` markup anyway. Each title here is the first of three shapes that
 * fits in sixty, longest first.
 *
 * ## A description that fits in 160
 *
 * The page's own summary when it fits with the download line after it — it is
 * the one sentence written about that resume in particular. The longer
 * summaries are written as "who this is — the detail", so the part before the
 * dash is used next, which still describes that resume and nobody else's.
 * Only then a fixed sentence that names the role and what is on the page. The
 * audit found twenty descriptions of 161–236 characters, cut mid-word in a
 * result.
 */

import type { RoleExample } from "./roles";

export const SEARCH_TITLE_LIMIT = 60;
export const SEARCH_DESCRIPTION_LIMIT = 160;

/** "Software Engineer (Fresher)" → "Software Engineer fresher", as it is typed. */
function searchedRole(role: string): string {
  return role.replace(/\s*\(([^)]+)\)/g, (_match, inner: string) => ` ${inner.toLowerCase()}`);
}

/** "format" in India, "example" elsewhere. */
function noun(example: Pick<RoleExample, "market">): "format" | "example" {
  return example.market === "IN" ? "format" : "example";
}

export function exampleSearchTitle(example: Pick<RoleExample, "role" | "market">): string {
  const role = searchedRole(example.role);
  const kind = noun(example);
  const candidates = [
    `${role} resume ${kind} — free Word & PDF`,
    kind === "format" ? `${role} resume format and example` : `${role} resume example and template`,
    `${role} resume ${kind}`,
  ];
  return candidates.find((title) => title.length <= SEARCH_TITLE_LIMIT) ?? candidates.at(-1)!;
}

export function exampleSearchDescription(
  example: Pick<RoleExample, "role" | "market" | "summary">,
): string {
  const download = "Free to download in Word and PDF";
  // "A cashier's resume with the numbers a store manager checks — drawers, …"
  const head = example.summary.split(" — ")[0]!.replace(/[.,;:]+$/, "");
  const candidates = [
    `${example.summary} ${download}.`,
    ...(head.length >= 40 && head !== example.summary
      ? [`${head}. ${download}, with the plain text an ATS reads.`, `${head}. ${download}.`]
      : []),
    `${searchedRole(example.role)} resume ${noun(example)}, free to download in Word or PDF, ` +
      "with notes on each choice and the plain text an ATS reads from it.",
  ];
  return candidates.find((text) => text.length <= SEARCH_DESCRIPTION_LIMIT) ?? candidates.at(-1)!;
}
