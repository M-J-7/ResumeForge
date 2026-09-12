/**
 * The bullet scaffolds (P33-C1). Written here, owned outright.
 *
 * ## The tension this file exists to resolve
 *
 * A competitor's headline content feature is "thousands of expert-written,
 * keyword-optimized bullet points". That is a database, and so is this. The
 * obvious source is **O\*NET Task Statements** — CC BY 4.0, commercial use
 * permitted with attribution, same provenance as `data/skills.json`.
 *
 * Except O\*NET tasks are **duty-shaped**: _"Analyze user needs and software
 * requirements to plan and design systems."_ That is a description of a job,
 * not of anything anyone achieved — and `bullets/duty-phrasing` in
 * `lib/lint/rules.ts` exists to flag exactly that shape. Shipping O\*NET
 * tasks as suggested bullets would have the product's own lint engine mark
 * its own suggestions as defects, in front of the user, immediately.
 *
 * So the split is: **O\*NET supplies the topic index** — what an occupation
 * actually involves, and its alternate titles for the "related roles" list —
 * and **we write the achievement-shaped scaffolds ourselves**, here.
 *
 * The side effect is ownership. No upstream licence change can take the
 * useful half away, which is the same reasoning already applied to the
 * curated skill aliases in `lib/skills/curated.ts`.
 *
 * ## Every scaffold has a blank, and that is the D8 boundary
 *
 * `Cut ___ from ___ to ___ by ___` is unmistakably a template to complete.
 * It is not a claim, because it does not say anything yet — the user supplies
 * every fact in it. That is what keeps a phrase library inside D8 while
 * delivering the same ergonomic win a generated one does: nothing here
 * invents a number, an employer, or an outcome, and nothing is ever
 * auto-inserted.
 *
 * ## They must lint clean, and a test proves it
 *
 * `phrases.test.ts` builds a resume out of every scaffold in this file and
 * runs the entire lint engine over it, asserting zero warnings. If the
 * phrase bank cannot satisfy our own rules, it is the phrase bank that is
 * wrong. In practice that means every scaffold below:
 *
 * - opens with a strong past-tense verb (never one in `WEAK_VERBS`, never an
 *   article or preposition — `bullets/weak-verb`);
 * - contains none of `DUTY_PHRASES` (`bullets/duty-phrasing`);
 * - uses no first-person pronoun (`bullets/first-person`) — note that this
 *   rules out the word "our", which is easy to write by accident;
 * - stays well under forty words (`bullets/too-long`).
 *
 * The blanks are `___`, which contains no digit, so a resume built purely
 * from scaffolds still trips `experience/no-quantified-outcome` — an `info`
 * finding, and the correct one: an unfilled scaffold genuinely has no
 * measurable result in it yet. The test asserts zero *errors and warnings*,
 * which is what "issues left" counts (D12).
 */

/** The literal a user sees and replaces. Three underscores, no more. */
export const BLANK = "___";

/**
 * What a scaffold is about, independent of job title.
 *
 * Topics are the join between O\*NET's occupation data and the text we own:
 * the build script maps an occupation to a set of topic ids, and the
 * scaffolds hang off the topics. That indirection is what lets one written
 * scaffold serve two hundred occupations without writing it two hundred
 * times, and what keeps the O\*NET half swappable.
 */
export interface PhraseTopic {
  readonly id: string;
  /** Shown as the group heading in the drawer. */
  readonly label: string;
  /** One line on what belongs under it. */
  readonly hint: string;
  readonly scaffolds: readonly string[];
}

export const PHRASE_TOPICS: readonly PhraseTopic[] = [
  {
    id: "efficiency",
    label: "Made something faster or cheaper",
    hint: "The most persuasive shape there is, because both ends of it are numbers.",
    scaffolds: [
      `Cut ${BLANK} from ${BLANK} to ${BLANK} by ${BLANK}`,
      `Reduced ${BLANK} by ${BLANK}% by ${BLANK}`,
      `Removed ${BLANK} from ${BLANK}, saving ${BLANK} per ${BLANK}`,
      `Automated ${BLANK}, taking it from ${BLANK} of manual work to ${BLANK}`,
      `Consolidated ${BLANK} into ${BLANK}, cutting ${BLANK} spend by ${BLANK}`,
      `Renegotiated ${BLANK}, lowering ${BLANK} by ${BLANK} a year`,
    ],
  },
  {
    id: "delivery",
    label: "Shipped something",
    hint: "Name the thing, then who used it. A launch nobody adopted is not a result.",
    scaffolds: [
      `Shipped ${BLANK}, used by ${BLANK}`,
      `Built ${BLANK} that ${BLANK}, replacing ${BLANK}`,
      `Launched ${BLANK} in ${BLANK}, ${BLANK} ahead of ${BLANK}`,
      `Delivered ${BLANK} across ${BLANK} with ${BLANK}`,
      `Rebuilt ${BLANK}, taking ${BLANK} from ${BLANK} to ${BLANK}`,
      `Migrated ${BLANK} to ${BLANK} with ${BLANK} downtime`,
    ],
  },
  {
    id: "scale",
    label: "Handled scale or volume",
    hint: "Numbers a reader can picture: users, requests, rows, sites, dollars.",
    scaffolds: [
      `Operated ${BLANK} serving ${BLANK} ${BLANK} a ${BLANK}`,
      `Scaled ${BLANK} from ${BLANK} to ${BLANK} without ${BLANK}`,
      `Managed ${BLANK} worth ${BLANK} across ${BLANK}`,
      `Processed ${BLANK} ${BLANK} per ${BLANK} at ${BLANK} accuracy`,
      `Oversaw ${BLANK} accounts totalling ${BLANK}`,
    ],
  },
  {
    id: "quality",
    label: "Improved quality or reliability",
    hint: "The before-and-after matters more than the practice you introduced.",
    scaffolds: [
      `Cut ${BLANK} defects from ${BLANK} to ${BLANK} by ${BLANK}`,
      `Raised ${BLANK} from ${BLANK} to ${BLANK} over ${BLANK}`,
      `Eliminated ${BLANK}, ending ${BLANK} that had cost ${BLANK}`,
      `Introduced ${BLANK}, cutting ${BLANK} incidents by ${BLANK}%`,
      `Diagnosed ${BLANK} that had persisted ${BLANK}, resolving it in ${BLANK}`,
    ],
  },
  {
    id: "revenue",
    label: "Moved a commercial number",
    hint: "Revenue, retention, conversion, cost per acquisition — whichever one you owned.",
    scaffolds: [
      `Grew ${BLANK} from ${BLANK} to ${BLANK} in ${BLANK}`,
      `Won ${BLANK} accounts worth ${BLANK}, including ${BLANK}`,
      `Lifted ${BLANK} by ${BLANK}% by ${BLANK}`,
      `Retained ${BLANK} of ${BLANK} through ${BLANK}`,
      `Opened ${BLANK} as a new ${BLANK}, reaching ${BLANK} within ${BLANK}`,
    ],
  },
  {
    id: "leadership",
    label: "Led people or a programme",
    hint: "Say what the team achieved, not how many people reported to you.",
    scaffolds: [
      `Led ${BLANK} people through ${BLANK}, delivering ${BLANK}`,
      `Hired and trained ${BLANK}, of whom ${BLANK}`,
      `Coordinated ${BLANK} across ${BLANK} teams to ${BLANK}`,
      `Mentored ${BLANK}, ${BLANK} of whom ${BLANK}`,
      `Ran ${BLANK} that ${BLANK}, ending ${BLANK}`,
    ],
  },
  {
    id: "process",
    label: "Changed how work is done",
    hint: "A process change counts when you can say what it changed.",
    scaffolds: [
      `Redesigned ${BLANK}, cutting ${BLANK} from ${BLANK} to ${BLANK}`,
      `Standardised ${BLANK} across ${BLANK}, removing ${BLANK}`,
      `Documented ${BLANK}, cutting ${BLANK} time for ${BLANK} by ${BLANK}`,
      `Replaced ${BLANK} with ${BLANK}, saving ${BLANK} each ${BLANK}`,
      `Established ${BLANK}, which now ${BLANK}`,
    ],
  },
  {
    id: "analysis",
    label: "Found something in the data",
    hint: "An analysis is worth a bullet when a decision came out of it.",
    scaffolds: [
      `Analysed ${BLANK} to find ${BLANK}, leading to ${BLANK}`,
      `Modelled ${BLANK}, forecasting ${BLANK} within ${BLANK}`,
      `Identified ${BLANK} worth ${BLANK} that ${BLANK} had missed`,
      `Built ${BLANK} reporting that ${BLANK} now use to ${BLANK}`,
      `Tested ${BLANK} against ${BLANK}, showing ${BLANK}`,
    ],
  },
  {
    id: "customer",
    label: "Served customers or clients",
    hint: "Volume and outcome together. One without the other reads as a job description.",
    scaffolds: [
      `Resolved ${BLANK} ${BLANK} per ${BLANK} at ${BLANK} satisfaction`,
      `Recovered ${BLANK} escalations that had reached ${BLANK}`,
      `Advised ${BLANK} clients on ${BLANK}, resulting in ${BLANK}`,
      `Cut ${BLANK} response time from ${BLANK} to ${BLANK}`,
      `Rewrote ${BLANK} so ${BLANK} could ${BLANK} without ${BLANK}`,
    ],
  },
  {
    id: "compliance",
    label: "Met a standard or passed an audit",
    hint: "Name the standard. It is the part a reader can verify.",
    scaffolds: [
      `Prepared ${BLANK} for ${BLANK}, passing with ${BLANK}`,
      `Brought ${BLANK} into compliance with ${BLANK} across ${BLANK}`,
      `Closed ${BLANK} audit findings in ${BLANK}`,
      `Wrote ${BLANK} adopted as ${BLANK} for ${BLANK}`,
    ],
  },
  {
    id: "teaching",
    label: "Taught, wrote, or presented",
    hint: "Audience size and what changed for them.",
    scaffolds: [
      `Taught ${BLANK} to ${BLANK}, ${BLANK} of whom ${BLANK}`,
      `Presented ${BLANK} to ${BLANK} at ${BLANK}`,
      `Wrote ${BLANK} read by ${BLANK}`,
      `Ran ${BLANK} sessions covering ${BLANK} for ${BLANK}`,
    ],
  },
  {
    id: "study",
    label: "Coursework, projects and study",
    hint: "For a first resume: the same shapes, sized to what you have actually done.",
    scaffolds: [
      `Built ${BLANK} for ${BLANK}, used by ${BLANK}`,
      `Placed ${BLANK} of ${BLANK} in ${BLANK}`,
      `Completed ${BLANK} covering ${BLANK}, finishing ${BLANK}`,
      `Organised ${BLANK} for ${BLANK} students, ${BLANK}`,
      `Contributed ${BLANK} to ${BLANK}, which ${BLANK}`,
    ],
  },
];

const TOPICS_BY_ID = new Map(PHRASE_TOPICS.map((topic) => [topic.id, topic]));

export function getTopic(id: string): PhraseTopic | null {
  return TOPICS_BY_ID.get(id) ?? null;
}

/** Every scaffold across every topic — what the lint test runs over. */
export const ALL_SCAFFOLDS: readonly string[] = PHRASE_TOPICS.flatMap((t) => t.scaffolds);

/**
 * The topics shown when nothing is known about the user's job title.
 *
 * Not "all of them": twelve groups with no ordering is a list nobody reads.
 * These four are the shapes that apply to almost any role, which is what
 * makes them the right default rather than the most popular ones.
 */
export const DEFAULT_TOPIC_IDS: readonly string[] = [
  "efficiency",
  "delivery",
  "quality",
  "leadership",
];
