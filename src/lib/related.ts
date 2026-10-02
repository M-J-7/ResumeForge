/**
 * Which example and guide pages link to which (ROADMAP Phase 1.7).
 *
 * Every example and guide used to link to its own index and nowhere else, so
 * a reader who landed on the nurse example from a search had one way onward —
 * back up — and a crawler reached each page only through the index. Sideways
 * links do both jobs: they give the reader the next thing worth reading, and
 * they spread the site's link weight across its pages instead of pooling it
 * on two indexes.
 *
 * ## Chosen, not scored
 *
 * The guide ↔ example pairs are written out below rather than computed from
 * text similarity. There are a handful of guides; a similarity score over them
 * would be a machine for producing surprising links. A table a person can read is
 * one a person can correct, and `related.test.ts` fails the build if a slug in
 * it stops existing.
 *
 * ## Every page gets linked to, not only from
 *
 * `relatedExamples` fills from the same field first and then wraps around the
 * list starting just after the current page, so the links are spread evenly —
 * nobody's page is the one that every other page happens to point at, and
 * none is left with no inbound link. The test asserts both.
 */

import { GUIDES, type Guide } from "./guides/guides";
import { ROLE_EXAMPLES, type RoleExample } from "./examples/roles";

/** Examples that show what each guide is arguing, in the order to read them. */
const EXAMPLES_FOR_GUIDE: Readonly<Record<string, readonly string[]>> = {
  "what-an-ats-actually-does": [
    "software-developer",
    "registered-nurse",
    "customer-service-representative",
  ],
  "resume-with-no-experience": [
    "graduate-no-experience",
    "customer-service-representative",
    "administrative-assistant",
  ],
  "how-to-quantify-a-bullet": ["sales-executive", "truck-driver", "financial-analyst"],
  "resume-file-format": ["accountant", "electrician", "graphic-designer"],
  "resume-format-for-freshers": ["software-engineer-fresher", "bcom-fresher", "mba-fresher"],
  "how-to-write-a-resume-summary": ["marketing-manager", "pharmacy-technician", "receptionist"],
  "resume-for-campus-placement": [
    "civil-engineer-fresher",
    "software-engineer-fresher",
    "graduate-no-experience",
  ],
  "how-long-should-a-resume-be": ["project-manager", "dental-assistant", "data-analyst"],
  "cv-vs-resume-vs-biodata": ["staff-nurse", "bcom-fresher", "digital-marketing-executive"],
  "employment-gap-on-resume": ["administrative-assistant", "server", "staff-nurse"],
  "resume-for-naukri": ["java-developer", "hr-executive", "bpo-customer-support"],
  "career-change-resume": ["teacher", "retail-store-manager", "mechanical-engineer"],
  "resume-for-us-jobs-from-india": [
    "software-engineer-fresher",
    "software-developer",
    "accountant",
  ],
  "two-column-resume-ats": [
    "customer-service-representative",
    "graphic-designer",
    "software-developer",
  ],
  "federal-resume-vs-private-resume": [
    "administrative-assistant",
    "certified-nursing-assistant",
    "project-manager",
  ],
  "is-any-resume-builder-really-free": ["cashier", "bcom-fresher", "warehouse-associate"],
};

/**
 * The guides that bear on an example: any guide that names it, then the two
 * that apply to every resume — quantifying a bullet and choosing a file —
 * which is also what guarantees every example links to at least one guide.
 */
const UNIVERSAL_GUIDES = ["how-to-quantify-a-bullet", "resume-file-format"] as const;

function bySlug<T extends { slug: string }>(items: readonly T[], slugs: readonly string[]): T[] {
  return slugs
    .map((slug) => items.find((item) => item.slug === slug))
    .filter((item): item is T => item !== undefined);
}

/** Up to `limit` other examples: the same field first, then an even spread. */
export function relatedExamples(example: RoleExample, limit = 3): RoleExample[] {
  const index = ROLE_EXAMPLES.findIndex((candidate) => candidate.slug === example.slug);
  // Starting just after this page and wrapping is what spreads the links: the
  // nurse page points onward from the nurse, not always at the first entries.
  const rotated = [...ROLE_EXAMPLES.slice(index + 1), ...ROLE_EXAMPLES.slice(0, index)];

  // At most two from the same field, then the rest from elsewhere. Same
  // field first is what a reader wants; *only* the same field is what
  // stranded a page — once "Early career" and "Operations" had four and six
  // examples, their pages linked only to each other and the marketing
  // manager was linked from nowhere (2026-09-29). `related.test.ts` asserts
  // every example is linked from another.
  const sameField = rotated.filter((candidate) => candidate.field === example.field).slice(0, 2);
  const others = rotated.filter((candidate) => candidate.field !== example.field);
  return [...sameField, ...others].slice(0, limit);
}

/** Up to `limit` guides for an example — the ones written about it first. */
export function guidesForExample(example: RoleExample, limit = 2): Guide[] {
  const naming = Object.entries(EXAMPLES_FOR_GUIDE)
    .filter(([, slugs]) => slugs.includes(example.slug))
    .map(([guide]) => guide);
  const slugs = [...new Set([...naming, ...UNIVERSAL_GUIDES])];
  return bySlug(GUIDES, slugs).slice(0, limit);
}

/** The examples a guide points at. */
export function examplesForGuide(guide: Guide): RoleExample[] {
  return bySlug(ROLE_EXAMPLES, EXAMPLES_FOR_GUIDE[guide.slug] ?? []);
}

/**
 * Up to `limit` other guides, for the end of a guide.
 *
 * It used to be every other guide, which was right at four and a wall of
 * links by the tenth. Now the same rules as `relatedExamples`, for the same
 * reasons. The list starts just after the current guide and wraps, so every
 * guide is linked from another and none is the one every page happens to
 * point at. A guide written for one market leads with up to two others for
 * that market — a fresher in Pune wants the campus-placement guide next, not
 * the federal one — then guides that hold anywhere, then the other market's.
 * A guide that holds anywhere takes the rotation as it comes, which is what
 * carries readers from the general guides into the market ones.
 */
export function otherGuides(guide: Guide, limit = 4): Guide[] {
  const index = GUIDES.findIndex((candidate) => candidate.slug === guide.slug);
  const rotated = [...GUIDES.slice(index + 1), ...GUIDES.slice(0, index)];
  if (guide.market === undefined) return rotated.slice(0, limit);

  const sameMarket = rotated.filter((candidate) => candidate.market === guide.market).slice(0, 2);
  const anywhere = rotated.filter((candidate) => candidate.market === undefined);
  const otherMarket = rotated.filter(
    (candidate) => candidate.market !== undefined && candidate.market !== guide.market,
  );
  return [...sameMarket, ...anywhere, ...otherMarket].slice(0, limit);
}

/** Tests only: the hand-written table, so a stale slug can be named. */
export const EXAMPLES_FOR_GUIDE_TABLE = EXAMPLES_FOR_GUIDE;
