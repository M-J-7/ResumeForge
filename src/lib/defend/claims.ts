/**
 * "Defend every number" (ROADMAP F9).
 *
 * Every figure and every strong claim on the page, grouped by the role or
 * project it sits in, each with the question an interviewer is most likely to
 * ask about it. It is interview preparation, and it is the other half of the
 * Bullet Coach's argument: the coach asks for a number because a number is
 * believed, and this is the list of numbers somebody will now ask you about.
 *
 * ## It lists and asks. It never writes.
 *
 * D8, the same line the coach holds. Nothing here produces text for the
 * resume: the spans are the user's own words, found and marked, and the
 * questions are questions. `claims.test.ts` enforces the second mechanically —
 * every question ends in a question mark and contains no digit, so nothing
 * here can hand anyone a figure they did not have.
 *
 * ## What counts
 *
 * A **figure** is a number with a job in the sentence: money, a percentage, a
 * rank, a multiple, a before-and-after, a headcount, a duration, a plain
 * count. What is *not* a figure is as important, because a checklist padded
 * with non-claims teaches the reader to skim it: years ("in 2025"), dates
 * ("03/2024"), version and product numbers ("Java 17", "ISO 9001", "S3"),
 * and anything glued to letters.
 *
 * A **claim** is a word that asserts a comparison or a level nobody can see
 * from the page — "the first", "largest", "record", "expert", "fluent". They
 * carry no digit and invite the same follow-up a number does: compared with
 * what?
 *
 * ## Deterministic, and cheap
 *
 * Regular expressions over the document, no PDF, no network. It runs on every
 * render of the panel, which is every edit, and it has to be fast enough that
 * nobody could tell.
 */

import type { ResumeDocument } from "@/lib/resume/schema";

/** What a marked span is, which decides the question it invites. */
export type ClaimKind =
  | "change"
  | "money"
  | "percent"
  | "rank"
  | "score"
  | "multiple"
  | "team"
  | "time"
  | "count"
  | "superlative"
  | "proficiency";

export interface ClaimSpan {
  readonly kind: ClaimKind;
  /** Offsets into the line's text, end exclusive. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface ClaimLine {
  /** Stable while the bullet stays where it is: entry id and bullet index. */
  readonly id: string;
  /** The bullet or sentence exactly as written. */
  readonly text: string;
  /** Every figure and claim in it, in reading order. */
  readonly spans: readonly ClaimSpan[];
  /**
   * One question for the figures, and one more when the line also makes a
   * word claim — "the largest account, grown by 40%" invites both "compared
   * with what?" and "40% of what?".
   */
  readonly questions: readonly string[];
}

export interface ClaimGroup {
  readonly id: string;
  /** "Software Engineering Intern · Finvo Payments", "Summary". */
  readonly title: string;
  readonly lines: readonly ClaimLine[];
}

export interface ClaimReport {
  readonly groups: readonly ClaimGroup[];
  /** Numeric spans across the page. */
  readonly figures: number;
  /** Word claims across the page. */
  readonly claims: number;
}

/* -------------------------------------------------------------------------- */
/* Patterns                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Most specific first. When two spans overlap, the earlier kind wins — a
 * before-and-after contains two percentages, and it is one claim.
 */
const KIND_ORDER: readonly ClaimKind[] = [
  "change",
  "money",
  "percent",
  "rank",
  "score",
  "multiple",
  "team",
  "time",
  "count",
  "superlative",
  "proficiency",
];

const NUMBER = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const CURRENCY = String.raw`(?:A\$|C\$|NZ\$|US\$|S\$|HK\$|[$€£₹¥]|\bRs\.?\s?|\bINR\s?|\bUSD\s?|\bEUR\s?|\bGBP\s?)`;
const SCALE = String.raw`(?:\s?(?:k|K|m|M|mn|bn|B|million|billion|thousand|lakhs?|crores?|cr|L)\b)?`;
/** Hedges a before-and-after may carry on its second figure. */
const HEDGE = String.raw`(?:(?:under|over|below|above|about|around|nearly|almost|just|less than|more than|roughly)\s+)?`;
/** A figure as it appears inside a before-and-after: currency, number, unit. */
const FIGURE_IN_CHANGE = String.raw`[−+-]?${CURRENCY}?(?:${NUMBER})${SCALE}(?:ms|s|h)?\s?%?`;

const TIME_UNIT = String.raw`(?:ms|milliseconds?|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|years?|yrs?|quarters?|semesters?)`;

/**
 * A before-and-after is a claim of change, so something has to have changed:
 * "cut … from 40 minutes to 6". Without a verb of change, "revenues from €4m
 * to €80m" is a range, and asking what it was before would be nonsense.
 */
const CHANGE_VERB =
  /\b(?:cut|cutting|reduc\w*|rais\w*|increas\w*|grew|grow\w*|improv\w*|brought|bringing|took|taking|mov\w*|lower\w*|dropp\w*|decreas\w*|boost\w*|lift\w*|shorten\w*|sped|speed\w*|accelerat\w*|halv\w*|doubl\w*|tripl\w*|went|fell|rose|climb\w*|jump\w*|expand\w*|scal\w*|shrank|shrunk|narrow\w*|trimm\w*|slash\w*|compress\w*)\b/i;

/** People a headcount can be of, when a verb of leading comes before it. */
const PEOPLE = String.raw`(?:direct reports?|reports|engineers|developers|analysts|designers|people|staff|employees|volunteers|nurses|agents|associates|cashiers|technicians|teachers|tutors|students|interns|members|contractors|consultants|representatives|reps|drivers|workers|managers|leads|trainees|hires|joiners|starters|recruits|graduates|residents|caregivers|aides|assistants)`;
const LEADING = /\b(led|lead|leading|managed|manage|managing|supervised|supervise|supervising|mentored|mentoring|coached|coaching|directed|oversaw|oversee|headed|hired|trained|training|precepted|onboarded|built a team|ran a team)\b/i;

const PATTERNS: Readonly<Record<Exclude<ClaimKind, "team">, readonly RegExp[]>> = {
  change: [
    new RegExp(
      // "from an average of 4.2 hours to 90 minutes", "from 6 hours of manual
      // work to 20 minutes": a few words may sit on either side of the first
      // figure, and the second may carry its unit.
      String.raw`\bfrom\s+(?:[\p{L}-]+\s+){0,3}${FIGURE_IN_CHANGE}(?:\s+[\p{L}-]+){0,4}\s+(?:to|down to|up to)\s+${HEDGE}${FIGURE_IN_CHANGE}(?:\s?${TIME_UNIT}\b)?`,
      "giu",
    ),
  ],
  money: [
    new RegExp(String.raw`${CURRENCY}(?:${NUMBER})${SCALE}\+?`, "gu"),
    new RegExp(String.raw`\b(?:${NUMBER})\s?(?:lakhs?|crores?)\b`, "giu"),
    new RegExp(
      String.raw`\b(?:${NUMBER})\s?(?:(?:million|billion|thousand)\s)?(?:dollars|rupees|euros|pounds)\b`,
      "giu",
    ),
  ],
  percent: [
    // "Raised margin 2.4 points" is percentage points, which is how margins,
    // rates and shares are usually moved.
    new RegExp(
      String.raw`\b(?:${NUMBER})\s?(?:%|percent\b|per\s?cent\b|(?:percentage\s)?points?\b|pts\b|bps\b|basis points\b|pp\b)`,
      "giu",
    ),
  ],
  rank: [
    // Not "7th semester" or "4th floor": an ordinal that names a period or a
    // place is a date or an address, not a placing.
    new RegExp(
      String.raw`\b\d+(?:st|nd|rd|th)\b(?!\s+(?:semester|sem|year|grade|floor|standard|std|class|edition|generation|gen|century|anniversary|birthday|quarter|week|day|month|batch|cohort))(?:\s+(?:of|out of|among)\s+(?:${NUMBER}))?`,
      "giu",
    ),
    /\btop\s+\d+(?:\s?%|\s?percent\b)?/giu,
    /#\d+\b/gu,
  ],
  score: [
    // "CSAT at 4.7 out of 5", "rated 9/10". Not "24/7", and not a date: the
    // second number is short and nothing follows it but a word boundary.
    new RegExp(
      String.raw`(?<![\d/.])\d{1,3}(?:\.\d+)?\s?(?:\/|out of)\s?\d{1,3}(?:\.\d+)?(?![\d/])`,
      "giu",
    ),
  ],
  multiple: [
    /\b(?:doubled|doubling|tripled|tripling|quadrupled|halved|halving)\b/giu,
    /\b\d+(?:\.\d+)?\s?[x×](?![\p{L}\d])/giu,
  ],
  time: [
    new RegExp(String.raw`\b(?:${NUMBER})\+?\s?-?\s?${TIME_UNIT}\b`, "giu"),
    // Units written against the number, the way latency is: "1.4s", "210ms".
    new RegExp(String.raw`\b(?:${NUMBER})(?:ms|s|h)\b`, "gu"),
  ],
  count: [
    new RegExp(
      String.raw`(?<![\p{L}\d.,/:#$€£₹¥-])(?:${NUMBER})(?:[kKmM](?![\p{L}])|\s?(?:million|billion|thousand)\b)?\+?(?![\d/:]|\.\d|[\p{L}]|-\d)`,
      "gu",
    ),
  ],
  superlative: [
    // "The first" only when it claims a first — "the first attribution model
    // in the company", "the first to…" — and never "the first 90 days", "the
    // first call" or "the first submission", which are just the first one.
    /\b(?:the first(?=(?:\s+[\p{L}-]+){0,3}\s+(?:to|in the|in its|in our|in their|ever)\b)|the only|first-ever|first ever|sole|largest|biggest|highest|lowest|fastest|best(?![\s-]+(?:practices?|sellers?|selling|efforts?|fit|possible|use))|top-performing|top performer|top-rated|highest-rated|number one|no\.\s?1|award-winning|single-handedly|unprecedented|unmatched|record-breaking|record-setting|(?:set|broke)\s+(?:a|the)\s+(?:\w+\s+)?record|record\s+(?:high|low|sales|year|quarter|month|revenue|numbers?))\b/giu,
  ],
  proficiency: [
    /\b(?:expert(?:ise)?|fluent(?:ly)?|native speaker|bilingual|trilingual|proficient|proficiency|mastery|deep knowledge|extensive (?:experience|knowledge)|highly skilled|guru|ninja|rockstar)\b/giu,
  ],
};

/**
 * "Advanced" is a level only in a skills list. In a sentence it is usually a
 * verb ("advanced to the national finals"), a certificate's name ("Advanced
 * Cardiac Life Support") or somebody else's adjective ("advanced analytics").
 */
const SKILL_LEVEL = /\b(?:advanced|intermediate|beginner|basic knowledge)\b/giu;

/**
 * Years or months of doing something — "five years of experience", "4 years
 * in payments" — are tenure, which the dates on the page already state. They
 * are not a figure anybody asks to see the working for.
 */
function isTenure(text: string, span: { start: number; end: number; text: string }): boolean {
  if (!/(?:years?|yrs?|months?|mos?)$/i.test(span.text)) return false;
  const after = text.slice(span.end);
  const before = text.slice(0, span.start);
  // Not "for": "no pressure injuries for 14 months" is a claim about a period,
  // and exactly the kind somebody asks to hear more about.
  return /^\s*(?:of|in|as|at|on|with|experience|,|\)|$)/i.test(after) || /\bwith\s*$/i.test(before);
}

/** "Before the 20th", "by the 5th": a day of the month, not a placing. */
const DAY_OF_MONTH = /\b(?:before|by|on|until|till|after|from|every|each)\s+the\s+$/i;

/**
 * A number that names rather than counts: "grade 4", "level 3", "phase 2",
 * "sprint 12". Lower-case labels only — a capitalised one is caught as a
 * product's number by `isProductNumber`.
 */
const LABEL_BEFORE =
  /\b(?:grade|level|band|tier|stage|step|phase|round|version|class|standard|std|semester|sem|room|floor|gate|section|chapter|unit|page|rev|release|sprint|batch|cohort|week|day|month|year|no\.|number|ward|bay|bed|line|lane|route|zone|shift)\s+$/i;

/** A year on its own is a date, not a figure — unless it counts something. */
const YEAR = /^(?:19[5-9]\d|20\d\d)$/;
const COUNTED_NOUN =
  /^\s+(?:users|customers|clients|students|patients|employees|people|members|downloads|orders|tickets|calls|units|items|records|accounts|leads|residents|visitors|subscribers|transactions|shipments|parcels|boxes|cases|claims)\b/i;

/**
 * A number right after a capitalised word that is not the sentence's first is
 * a name's number — "Java 17", "Windows 11", "ISO 9001", "Series 7" — not a
 * figure anybody has to defend.
 */
function isProductNumber(text: string, start: number): boolean {
  const before = text.slice(0, start);
  const match = /(\S+)\s+$/.exec(before);
  if (!match) return false;
  const word = match[1]!;
  if (!/^[\p{Lu}][\p{L}+#.-]*$/u.test(word)) return false;
  // The first word of the line or sentence is capitalised because it starts
  // one: "Trained 26 staff" is a headcount.
  const wordStart = before.length - match[0].length;
  const prefix = before.slice(0, wordStart).trimEnd();
  return prefix.length > 0 && !/[.!?;:]$/.test(prefix);
}

/* -------------------------------------------------------------------------- */
/* Finding spans                                                               */
/* -------------------------------------------------------------------------- */

interface Candidate extends ClaimSpan {
  readonly rank: number;
}

interface FindOptions {
  /** A skills-list item, where "Advanced Excel" states a level. */
  readonly skill?: boolean;
}

function candidates(text: string, options: FindOptions): Candidate[] {
  const found: Candidate[] = [];
  /** Ranges that are not claims at all — tenure — and so block any kind. */
  const blocked: { start: number; end: number }[] = [];
  const push = (kind: ClaimKind, start: number, end: number) => {
    // Trim trailing space a unit pattern can swallow.
    const raw = text.slice(start, end);
    const trimmed = raw.replace(/\s+$/, "");
    found.push({
      kind,
      start,
      end: start + trimmed.length,
      text: trimmed,
      rank: KIND_ORDER.indexOf(kind),
    });
  };

  for (const kind of KIND_ORDER) {
    if (kind === "team") continue;
    for (const pattern of PATTERNS[kind]) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;
        if (kind === "change" && !CHANGE_VERB.test(text.slice(0, start))) continue;
        if (kind === "rank" && DAY_OF_MONTH.test(text.slice(0, start)) && !/\s/.test(match[0])) {
          continue;
        }
        if (kind === "score" && /^24\s?\/\s?7$/.test(match[0])) continue;
        if (kind === "count") {
          const value = match[0].replace(/[+kKmM]$/, "");
          if (YEAR.test(value) && !COUNTED_NOUN.test(text.slice(end))) continue;
          if (isProductNumber(text, start)) continue;
          if (LABEL_BEFORE.test(text.slice(0, start))) continue;
        }
        if (kind === "time") {
          const spanText = match[0].trimEnd();
          const span = { start, end: start + spanText.length, text: spanText };
          // "The first 90 days", "the last 6 months": a period being
          // described. Tenure likewise. Either blocks the number inside it
          // from turning up again as a plain count.
          const period = /\b(?:first|last|next|past|final)\s+$/i.test(text.slice(0, start));
          if (period || isTenure(text, span)) {
            blocked.push(span);
            continue;
          }
        }
        push(kind, start, end);
      }
    }
  }

  if (options.skill) {
    for (const match of text.matchAll(SKILL_LEVEL)) {
      push("proficiency", match.index, match.index + match[0].length);
    }
  }

  // A headcount is a count of people after a verb of leading. It outranks a
  // plain count, and asks a different question.
  if (LEADING.test(text)) {
    const team = new RegExp(
      String.raw`\b(?:team|group|crew|squad|department|unit)\s+of\s+(?:${NUMBER})\b|\b(?:${NUMBER})\+?\s+(?:[\p{L}-]+\s+)?${PEOPLE}\b`,
      "giu",
    );
    for (const match of text.matchAll(team)) {
      push("team", match.index, match.index + match[0].length);
    }
  }

  return found.filter(
    (candidate) =>
      !blocked.some((range) => candidate.start < range.end && range.start < candidate.end),
  );
}

/** Non-overlapping spans, the most specific kind winning each overlap. */
export function findClaims(text: string, options: FindOptions = {}): ClaimSpan[] {
  const ordered = candidates(text, options).sort(
    (a, b) => a.rank - b.rank || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const accepted: Candidate[] = [];
  for (const candidate of ordered) {
    const overlaps = accepted.some((kept) => candidate.start < kept.end && kept.start < candidate.end);
    if (!overlaps) accepted.push(candidate);
  }
  return accepted
    .sort((a, b) => a.start - b.start)
    .map(({ kind, start, end, text: spanText }) => ({ kind, start, end, text: spanText }));
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The follow-up each kind invites. Questions only: no digit, a question mark
 * at the end, and nothing that could be pasted into a resume (D8).
 */
export const QUESTIONS: Readonly<Record<ClaimKind, string>> = {
  change: "What was it before, what was it after, and how did you measure both?",
  money: "Whose money was it, over what period, and which part of it was your doing?",
  percent: "A percentage of what, over what period — and how do you know?",
  rank: "Ranked against whom, and on what measure?",
  score: "A score given by whom, from how many responses, over what period?",
  multiple: "From what starting point, over how long, and what else changed at the same time?",
  team: "What was your part, and what was theirs?",
  time: "How was the time measured, before and after?",
  count: "How did you count it, and what would the number be if somebody checked?",
  superlative: "Compared with what — and who else would say so?",
  proficiency: "What is the hardest thing you have done with it, and could you show it on the spot?",
};

const NUMERIC: ReadonlySet<ClaimKind> = new Set([
  "change",
  "money",
  "percent",
  "rank",
  "score",
  "multiple",
  "team",
  "time",
  "count",
]);

function questionsFor(spans: readonly ClaimSpan[]): string[] {
  const kinds = new Set(spans.map((span) => span.kind));
  const numeric = KIND_ORDER.find((kind) => NUMERIC.has(kind) && kinds.has(kind));
  const word = KIND_ORDER.find((kind) => !NUMERIC.has(kind) && kinds.has(kind));
  return [numeric, word].filter((kind): kind is ClaimKind => kind !== undefined).map((kind) => QUESTIONS[kind]);
}

/* -------------------------------------------------------------------------- */
/* The document                                                                */
/* -------------------------------------------------------------------------- */

function line(id: string, text: string, options: FindOptions = {}): ClaimLine | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const spans = findClaims(trimmed, options);
  if (spans.length === 0) return null;
  return { id, text: trimmed, spans, questions: questionsFor(spans) };
}

function joined(...parts: readonly string[]): string {
  return parts.map((part) => part.trim()).filter((part) => part.length > 0).join(" · ");
}

function bulletLines(entryId: string, bullets: readonly string[]): ClaimLine[] {
  return bullets
    .map((bullet, index) => line(`${entryId}:${index}`, bullet))
    .filter((item): item is ClaimLine => item !== null);
}

/**
 * Every figure and claim on the page, in the order the page shows them.
 * Hidden sections are left out: they are not on the page anyone will hold.
 */
export function collectClaims(doc: ResumeDocument): ClaimReport {
  const groups: ClaimGroup[] = [];

  for (const section of doc.sections) {
    if (!section.visible) continue;

    switch (section.type) {
      case "summary": {
        const sentences = section.content.split(/(?<=[.!?])\s+/);
        const lines = sentences
          .map((sentence, index) => line(`${section.id}:${index}`, sentence))
          .filter((item): item is ClaimLine => item !== null);
        if (lines.length > 0) groups.push({ id: section.id, title: "Summary", lines });
        break;
      }
      case "experience":
        for (const entry of section.entries) {
          const lines = bulletLines(entry.id, entry.bullets);
          if (lines.length > 0) {
            groups.push({
              id: entry.id,
              title: joined(entry.title, entry.organization) || "Untitled role",
              lines,
            });
          }
        }
        break;
      case "projects":
        for (const entry of section.entries) {
          const lines = bulletLines(entry.id, entry.bullets);
          if (lines.length > 0) {
            groups.push({ id: entry.id, title: joined(entry.name, entry.role) || "Untitled project", lines });
          }
        }
        break;
      case "education":
        for (const entry of section.entries) {
          const lines = bulletLines(entry.id, entry.bullets);
          if (lines.length > 0) {
            groups.push({
              id: entry.id,
              title: joined(entry.credential, entry.institution) || "Education",
              lines,
            });
          }
        }
        break;
      case "custom":
        for (const entry of section.entries) {
          const lines = bulletLines(entry.id, entry.bullets);
          if (lines.length > 0) {
            groups.push({
              id: entry.id,
              title: joined(entry.title, entry.subtitle) || section.label || "Other",
              lines,
            });
          }
        }
        break;
      case "skills": {
        // A skill list is claims by construction, but only a stated level —
        // "Advanced Excel", "Fluent Spanish" — is one somebody will test.
        const lines = section.groups
          .flatMap((group) =>
            group.skills.map((skill, index) => line(`${group.id}:${index}`, skill, { skill: true })),
          )
          .filter(
            (item): item is ClaimLine =>
              item !== null && item.spans.some((span) => span.kind === "proficiency"),
          );
        if (lines.length > 0) groups.push({ id: section.id, title: "Skills", lines });
        break;
      }
      case "certifications":
        break;
    }
  }

  const spans = groups.flatMap((group) => group.lines.flatMap((item) => item.spans));
  return {
    groups,
    figures: spans.filter((span) => NUMERIC.has(span.kind)).length,
    claims: spans.filter((span) => !NUMERIC.has(span.kind)).length,
  };
}

/**
 * The checklist as plain text, for notes or a printout: each line under its
 * group, with its questions indented beneath.
 */
export function claimsAsText(report: ClaimReport): string {
  return report.groups
    .map((group) =>
      [
        group.title,
        ...group.lines.flatMap((item) => [
          `  [ ] ${item.text}`,
          ...item.questions.map((question) => `        ${question}`),
        ]),
      ].join("\n"),
    )
    .join("\n\n");
}
