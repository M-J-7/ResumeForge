/**
 * Resume action verbs, grouped by what the person did (ROADMAP Phase 3).
 *
 * "Resume action verbs" is one of the most-searched questions in the
 * category, in India and the US alike, and the usual answer is a list of two
 * hundred words in alphabetical order. A list does not help anybody choose. So
 * this is grouped the way the phrase bank already is — by the kind of thing
 * you did — and every group carries sentence *shapes* with blanks in them,
 * which is the part that turns a verb into a bullet.
 *
 * ## Built from what the product already owns
 *
 * - The groups are the phrase bank's topics (`PHRASE_TOPICS`), with their
 *   labels and hints, so the page and the builder's phrase drawer agree.
 * - Each group's verbs start with the openers of that topic's own scaffolds —
 *   derived, not retyped — plus a short authored list of the obvious
 *   neighbours below.
 * - The shapes are the bank's scaffolds, which `phrases.test.ts` already runs
 *   through the lint engine one at a time.
 * - "Stop opening with" is the lint engine's own `WEAK_VERBS` and
 *   `DUTY_PHRASES`: the page tells a reader exactly what the checker in the
 *   builder will flag, and why.
 *
 * `action-verbs.test.ts` holds every verb to the same lint rules, so the page
 * can never recommend a word the builder then complains about.
 *
 * Spelling is British, as the phrase bank's is ("analysed", "organised"). The
 * page says in plain words that the American spellings are equally correct —
 * the one thing that matters is using one of them throughout.
 */

import { PHRASE_TOPICS } from "@/lib/phrases/scaffolds";

/** When the verb list and the shapes last changed. Pinned in `content-dates.test.ts`. */
export const ACTION_VERBS_UPDATED = "2026-09-28";

export const ACTION_VERBS_PATH = "/resume-action-verbs";

/**
 * Verbs a topic's scaffolds do not open with but obviously belong beside
 * them. Single past-tense words only: a bullet opens on one, and a phrasal
 * verb ("set up") is two words that read as a weak opener in the lint rule.
 */
const NEIGHBOURS: Readonly<Record<string, readonly string[]>> = {
  efficiency: ["streamlined", "simplified", "shortened", "accelerated", "lowered", "halved"],
  delivery: ["designed", "developed", "implemented", "released", "produced", "completed"],
  scale: ["expanded", "extended", "doubled", "tripled", "grew", "migrated"],
  quality: ["fixed", "prevented", "restored", "stabilised", "hardened", "verified"],
  revenue: ["secured", "negotiated", "generated", "converted", "sold", "renewed"],
  leadership: ["coached", "directed", "trained", "onboarded", "recruited", "delegated"],
  process: ["formalised", "restructured", "overhauled", "instituted", "mapped", "simplified"],
  analysis: ["measured", "forecast", "audited", "evaluated", "investigated", "quantified"],
  customer: ["guided", "answered", "escalated", "retained", "onboarded", "trained"],
  compliance: ["audited", "certified", "enforced", "inspected", "documented", "remediated"],
  teaching: ["tutored", "coached", "planned", "assessed", "explained", "facilitated"],
  study: ["researched", "published", "studied", "qualified", "earned", "presented"],
};

export interface VerbGroup {
  id: string;
  /** What you did, in the phrase bank's words — "Shipped something". */
  label: string;
  /** The bank's one-line advice for this kind of bullet. */
  hint: string;
  verbs: readonly string[];
  /** Sentence shapes with blanks — never finished sentences (D8). */
  shapes: readonly string[];
}

function openers(scaffolds: readonly string[]): string[] {
  return scaffolds.map((scaffold) =>
    (scaffold.split(/\s+/)[0] ?? "").replace(/[^A-Za-z-]/g, "").toLowerCase(),
  );
}

function unique(words: readonly string[]): string[] {
  return [...new Set(words.filter(Boolean))];
}

export const VERB_GROUPS: readonly VerbGroup[] = PHRASE_TOPICS.map((topic) => ({
  id: topic.id,
  label: topic.label,
  hint: topic.hint,
  verbs: unique([...openers(topic.scaffolds), ...(NEIGHBOURS[topic.id] ?? [])]),
  shapes: topic.scaffolds.slice(0, 3),
}));

export interface WeakOpener {
  /** Exactly as the lint engine lists it. */
  phrase: string;
  /** Why it is weak, in one sentence. */
  why: string;
  /** What to reach for instead — each one is on this page. */
  instead: readonly string[];
}

/**
 * The openers the builder's checker flags, with what to use instead.
 *
 * Not every entry in `WEAK_VERBS` is here — "was", "did" and "familiar" need
 * no explanation — but every entry here is in `WEAK_VERBS` or
 * `DUTY_PHRASES`, which the test asserts.
 */
export const WEAK_OPENERS: readonly WeakOpener[] = [
  {
    phrase: "responsible for",
    why: "It says the task existed. It does not say you did it, or how well.",
    instead: ["led", "ran", "managed", "delivered"],
  },
  {
    phrase: "worked on",
    why: "Being near the work is not the work. Say which part was yours.",
    instead: ["built", "designed", "rebuilt", "tested"],
  },
  {
    phrase: "helped",
    why: "It hides your share of the result behind someone else's.",
    instead: ["delivered", "coordinated", "prepared", "resolved"],
  },
  {
    phrase: "assisted",
    why: "The same as helped, one register more formal.",
    instead: ["prepared", "processed", "organised", "coordinated"],
  },
  {
    phrase: "participated",
    why: "Attendance, not contribution.",
    instead: ["presented", "analysed", "wrote", "tested"],
  },
  {
    phrase: "handled",
    why: "True of every task anyone has ever had.",
    instead: ["resolved", "processed", "closed", "escalated"],
  },
  {
    phrase: "used",
    why: "A tool is not an achievement. Say what the tool let you do.",
    instead: ["built", "automated", "analysed", "migrated"],
  },
  {
    phrase: "tasked with",
    why: "Someone gave you the job. The bullet should say what you did with it.",
    instead: ["delivered", "completed", "launched", "shipped"],
  },
];

/** Every verb on the page, for the test and the count in the copy. */
export const ALL_ACTION_VERBS: readonly string[] = unique(VERB_GROUPS.flatMap((g) => g.verbs));
