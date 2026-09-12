/**
 * The Bullet Coach (P34, M4-T7).
 *
 * The D8-compatible answer to "Enhance with AI", and the half of the content
 * work that operates on what the user has already written rather than
 * offering them something to start from.
 *
 * ## It asks questions. It never writes.
 *
 * Every competitor's version of this button rewrites the bullet. Ours
 * decomposes it into **Action / What / How / Outcome**, notices which part is
 * absent, and asks about it:
 *
 * > _No measurable result. What changed — a percentage, time saved, a count,
 * > a scale?_
 *
 * That is the D8 line, and it is not a technicality. A model that rewrites a
 * bullet is inventing a claim about somebody's work on their behalf, and the
 * person then sends it to an employer under their own name. Asking "what
 * changed?" produces a better bullet *and* leaves every fact in it theirs.
 *
 * `coach.test.ts` enforces it mechanically: no message this module produces
 * may be a sentence that could be pasted into a resume. Every question ends
 * in a question mark, and no field anywhere contains a digit — so the coach
 * cannot supply a number the user did not have.
 *
 * ## The four parts, and why these four
 *
 * A bullet that persuades has all of: a strong **action**, the **what** it
 * acted on, the **how** it was done, and the **outcome** it produced. Most
 * weak bullets are missing exactly one, and which one it is decides what to
 * say. "Rebuilt the ingestion pipeline" is not weak writing — it is a
 * complete clause missing only its result, and telling its author to "use
 * stronger verbs" would be advice about a problem they do not have.
 *
 * ## Reuse, not a second opinion
 *
 * The verb classification and the quantity detector come from
 * `lib/lint/rules.ts`, exported for this. A coach that called a verb weak
 * while the checklist beside it called the same verb fine would undermine
 * both.
 */

import {
  DUTY_PHRASES,
  FIRST_PERSON,
  NON_VERB_OPENERS,
  QUANTITY,
  WEAK_VERBS,
} from "@/lib/lint/rules";

/** The four things a persuasive bullet has. */
export type BulletPart = "action" | "what" | "how" | "outcome";

export interface CoachNote {
  part: BulletPart;
  /** Names the gap. A fragment about the *bullet*, never about the person. */
  gap: string;
  /** The question to ask. Always ends in a question mark. */
  question: string;
  /** Where to look for the answer. Never an example the user could paste. */
  hint: string;
}

export interface BulletAnalysis {
  /** Which parts the bullet already has. */
  present: Record<BulletPart, boolean>;
  /**
   * What is missing, most consequential first. Empty for a bullet with all
   * four parts — the coach staying quiet is a real answer.
   */
  notes: CoachNote[];
}

/**
 * Words that introduce *how* something was done.
 *
 * "by", "through", "using", "via", "with". Kept short deliberately: a longer
 * list catches more, and every extra entry is another way to tell somebody
 * their complete bullet is incomplete.
 */
const METHOD = /\b(by|through|using|via|with|after|across)\b/i;

/**
 * Phrases that introduce a result even when no number follows.
 *
 * "resulting in", "which cut", "enabling". A bullet can name an outcome
 * without quantifying it — that is a weaker bullet, not an outcome-less one,
 * and the coach should ask for the number rather than for the result.
 */
const OUTCOME_PHRASE =
  /\b(result(ed|ing)?\s+in|so\s+that|enabl(ed|ing)|allow(ed|ing)|lead(ing)?\s+to|led\s+to|cutting|reducing|increasing|raising|saving|eliminat(ed|ing)|improv(ed|ing)|now)\b/i;

/**
 * A stated before and after — "from three days to under an hour".
 *
 * The quantity detector wants a digit, and a good bullet often writes its
 * numbers as words. This is the shape that carries the comparison whether or
 * not it is written in figures.
 */
const BEFORE_AND_AFTER = /\bfrom\b[^.]{1,60}\bto\b/i;

/**
 * Numbers written as words.
 *
 * `QUANTITY` in the lint engine looks for a digit, which is right for what
 * *it* asks: `experience/no-quantified-outcome` is nudging people toward
 * figures, because a figure is easier to scan. The coach is answering a
 * different question — "does this bullet state an outcome at all?" — and
 * "closed with **zero** adjustments for three consecutive years" plainly
 * does. Asking its author what changed would be the coach failing to read
 * the sentence.
 *
 * So the two deliberately disagree, and the disagreement is the point rather
 * than a drift: broadening `QUANTITY` itself would silence the lint rule on
 * bullets it is correctly nudging.
 */
const NUMBER_WORD =
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozens?|hundreds?|thousands?|millions?|billions?)\b/i;

/**
 * Verbs that *are* an outcome, rather than introducing one.
 *
 * "Cut shortlisting time from three days to under an hour" was the bullet
 * that found this: it states a result, contains no digit, and matches none
 * of the connective phrases above — because the result is the verb. Asking
 * its author "what changed?" would be the coach failing to read the bullet
 * it is commenting on, which is worse than saying nothing.
 */
const OUTCOME_VERBS = new Set([
  "cut",
  "reduced",
  "lowered",
  "shortened",
  "accelerated",
  "increased",
  "raised",
  "grew",
  "lifted",
  "doubled",
  "tripled",
  "halved",
  "quadrupled",
  "saved",
  "eliminated",
  "removed",
  "prevented",
  "recovered",
  "improved",
  "won",
  "retained",
]);

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** The opening word, stripped to letters — the same normalisation the rule uses. */
function openingWord(text: string): string {
  return (
    words(text)[0]
      ?.toLowerCase()
      .replace(/[^a-z']/g, "") ?? ""
  );
}

export function hasStrongAction(text: string): boolean {
  const first = openingWord(text);
  if (!first) return false;
  if (WEAK_VERBS.has(first) || NON_VERB_OPENERS.test(first)) return false;
  const lower = text.toLowerCase();
  return !DUTY_PHRASES.some((phrase) => lower.includes(phrase));
}

export function hasOutcome(text: string): boolean {
  return (
    QUANTITY.test(text) ||
    OUTCOME_PHRASE.test(text) ||
    BEFORE_AND_AFTER.test(text) ||
    NUMBER_WORD.test(text) ||
    OUTCOME_VERBS.has(openingWord(text))
  );
}

/**
 * Decomposes a bullet and says what is missing.
 *
 * An empty or near-empty bullet returns no notes at all. The coach is for
 * improving something that exists; a blank field already has an empty state
 * and a hint, and stacking four questions onto it would be noise at exactly
 * the moment somebody is trying to start.
 */
export function analyzeBullet(text: string): BulletAnalysis {
  const trimmed = text.trim();
  const wordCount = words(trimmed).length;

  const present: Record<BulletPart, boolean> = {
    action: hasStrongAction(trimmed),
    // Something was acted *on*: a verb plus at least two more words. Below
    // that there is no object in the sentence to comment about.
    what: wordCount >= 3,
    how: METHOD.test(trimmed),
    outcome: hasOutcome(trimmed),
  };

  if (wordCount < 2) return { present, notes: [] };

  const notes: CoachNote[] = [];

  // Ordered by consequence. A bullet missing its result is the commonest and
  // costliest failure; a bullet missing its method is the least.
  if (!present.outcome) {
    notes.push({
      part: "outcome",
      gap: "No measurable result.",
      question: "What changed because you did this?",
      hint: "A percentage, an amount of time, a count, or a scale — whichever you have.",
    });
  }

  if (!present.action) {
    const first = openingWord(trimmed);
    notes.push({
      part: "action",
      gap: DUTY_PHRASES.some((phrase) => trimmed.toLowerCase().includes(phrase))
        ? "Describes the job rather than your work."
        : `Opens on “${first}”, which describes presence rather than a contribution.`,
      question: "What did you actually do?",
      hint: "Lead with the verb that names the change you made.",
    });
  }

  if (!present.what) {
    notes.push({
      part: "what",
      gap: "Too short to say what was acted on.",
      question: "What did you do it to?",
      hint: "Name the system, the team, the process, or the account.",
    });
  }

  if (!present.how && present.action) {
    notes.push({
      part: "how",
      gap: "Does not say how.",
      question: "How did you do it?",
      hint: "The method is often what makes the result believable.",
    });
  }

  if (FIRST_PERSON.test(trimmed)) {
    notes.push({
      part: "action",
      gap: "Uses a first-person pronoun.",
      question: "Can the sentence start with the verb instead?",
      hint: "A resume is written in an implied first person, so the pronoun is redundant.",
    });
  }

  return { present, notes };
}

/**
 * How many parts a bullet has, out of four.
 *
 * **Not a score, and never rendered as a percentage** — D12. It is a count
 * of what is left, the same thing the lint panel shows, and it exists so the
 * UI can say "2 of 4" rather than inventing a bullet grade.
 */
export function partsPresent(analysis: BulletAnalysis): number {
  return Object.values(analysis.present).filter(Boolean).length;
}

export const BULLET_PARTS: readonly BulletPart[] = ["action", "what", "how", "outcome"];

export const PART_LABELS: Record<BulletPart, string> = {
  action: "Action",
  what: "What",
  how: "How",
  outcome: "Outcome",
};
