/**
 * The pages whose views the counter will accept, exactly.
 *
 * The browser's check (`viewEvent` in `src/lib/events.ts`) is a set of shapes,
 * because the page cannot carry every slug. This is the list: every route in
 * the sitemap, built from the same arrays the sitemap and the routes read,
 * plus the application's own sections. A `view:` name for anything else is
 * refused — which is what stops a script from filling the table with rows
 * named after whatever it likes.
 */

import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { GUIDES } from "@/lib/guides/guides";
import { ACTION_VERBS_PATH } from "@/lib/verbs/action-verbs";

const PAGES = [
  "/",
  "/check",
  "/templates",
  "/pricing",
  "/privacy",
  "/terms",
  "/examples",
  "/guides",
  "/bullet-point-checker",
  "/resume-keyword-scanner",
  ACTION_VERBS_PATH,
];

/** The application, by section. Never by the id in a URL. */
const SECTIONS = ["/builder", "/dashboard", "/letters", "/match", "/signin"];

export const COUNTED_PATHS: ReadonlySet<string> = new Set([
  ...PAGES,
  ...SECTIONS,
  ...ROLE_EXAMPLES.map((example) => `/examples/${example.slug}`),
  ...GUIDES.map((guide) => `/guides/${guide.slug}`),
]);

/** Whether a `view:` name names a page that exists. */
export function isCountedView(name: string): boolean {
  return name.startsWith("view:") && COUNTED_PATHS.has(name.slice("view:".length));
}
