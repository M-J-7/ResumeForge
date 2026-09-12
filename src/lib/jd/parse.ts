/**
 * Job-description structure (M3-T3).
 *
 * Real postings are structured, and the structure carries most of the
 * meaning. "Kubernetes" under **Requirements** is a bar to clear;
 * "Kubernetes" under **Nice to have** is a preference; "Kubernetes" in
 * *About us* is a company describing its stack and asking nothing of you at
 * all. A scorer that treats those three as the same word is why naive
 * keyword tools tell people to add skills the posting never asked for.
 *
 * So this splits a posting into sections before any keyword is counted, and
 * attaches a weight to each. §6 of the plan sets the ratio: required counts
 * about 3× preferred, and boilerplate counts nothing.
 *
 * ## Why heading detection is not a regex over known words
 *
 * "Requirements" appears in the middle of sentences. Postings use "What
 * you'll need", "Who you are", "Basic Qualifications", and "You should have"
 * for the same section. Some use markdown, some ALL CAPS, some a bare line
 * with a colon. A line is treated as a heading only when it *looks* like one
 * — short, unpunctuated or colon-terminated, not a bullet — and only then is
 * it classified by phrase. Getting that order wrong is what makes a parser
 * split a posting in the middle of a sentence.
 *
 * ## What this deliberately does not do
 *
 * No keyword extraction, no scoring, no skill matching. Those need the
 * taxonomy and the IDF corpus (M3-T1, M3-T2), which are blocked on a
 * licensing decision. This module is the part that needs nothing external,
 * and it is useful on its own: it is what makes "found under Requirements"
 * sayable later.
 */

/** What a section is for, which is what decides how much it counts. */
export type JdSectionKind =
  /** Stated bars: "Requirements", "Basic Qualifications", "You must have". */
  | "required"
  /** Stated preferences: "Nice to have", "Bonus points", "Preferred". */
  | "preferred"
  /** The work itself: "Responsibilities", "What you'll do". */
  | "responsibilities"
  /** The opening paragraphs, before any heading. Real signal, but not a bar. */
  | "intro"
  /** Company blurb. Describes them, asks nothing of you. */
  | "about"
  /** Salary, perks, holiday. */
  | "benefits"
  /** Equal-opportunity statements, visa notes, legal boilerplate. */
  | "legal"
  /** How to apply, interview process. */
  | "process"
  /** A heading we recognised as a heading but not as anything in particular. */
  | "unknown";

/**
 * How much a section's content counts, relative to preferred = 1.
 *
 * `required: 3` is the ratio §6 specifies. `responsibilities: 2` sits between
 * because a duty listed there is what the job actually *is* — stronger
 * evidence than a preference — while still not being stated as a bar.
 * Everything at 0 is ignored outright rather than counted faintly: a company
 * listing its own tech stack under "About us" must not make a candidate look
 * like a match for having read it.
 */
export const SECTION_WEIGHTS: Record<JdSectionKind, number> = {
  required: 3,
  responsibilities: 2,
  preferred: 1,
  intro: 1,
  unknown: 1,
  about: 0,
  benefits: 0,
  legal: 0,
  process: 0,
};

export interface JdLine {
  text: string;
  /** True when the source line was a bullet, numbered or otherwise. */
  bullet: boolean;
  /** 0-based index in the original text, so a finding can point at it. */
  sourceLine: number;
  /**
   * Set when the line itself overrides its section — "…(nice to have)" inside
   * a Requirements list. Real postings do this constantly.
   */
  kindOverride?: JdSectionKind;
}

export interface JdSection {
  kind: JdSectionKind;
  /** The line that named it, or null for the pre-heading intro. */
  heading: string | null;
  lines: JdLine[];
  weight: number;
  sourceLine: number;
}

export interface ParsedJd {
  /** The posting's own title, when the first line looks like one. */
  title: string | null;
  sections: JdSection[];
}

/* -------------------------------------------------------------------------- */
/* Heading classification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ordered most specific first, and the order is load-bearing.
 *
 * "Preferred Qualifications" contains "Qualifications". Test the general
 * pattern first and every posting that separates the two collapses into one
 * required block — losing the preferred/required distinction, which is the
 * whole point of this module. The same applies to boilerplate: "Perks &
 * Benefits" has to be reached before anything that could read "benefits" as
 * something being asked of the candidate.
 *
 * Both apostrophes appear because postings are pasted out of web pages, and
 * a page styled with smart quotes gives "What you’ll do" with U+2019. A
 * pattern written with only the ASCII form silently fails on the commonest
 * heading shape there is, and the section quietly becomes `unknown`.
 */
const HEADING_PATTERNS: readonly { pattern: RegExp; kind: JdSectionKind }[] = [
  // --- preferred, before anything that could swallow it -------------------
  { pattern: /\b(nice|good)\s+to\s+have/i, kind: "preferred" },
  { pattern: /\bbonus\b/i, kind: "preferred" },
  { pattern: /\bpreferred\b/i, kind: "preferred" },
  { pattern: /\bdesirable\b/i, kind: "preferred" },
  { pattern: /\bicing\s+on\s+the\s+cake\b/i, kind: "preferred" },
  { pattern: /\bstand\s+out\b/i, kind: "preferred" },
  { pattern: /\bextra\s+credit\b/i, kind: "preferred" },
  { pattern: /\bit['’]?d\s+be\s+great\b|\bgreat\s+if\b/i, kind: "preferred" },
  { pattern: /\b(a\s+)?plus(es)?\b/i, kind: "preferred" },

  // --- boilerplate, before "requirements"-ish words can reach it ----------
  { pattern: /\bequal\s+(opportunity|employment)/i, kind: "legal" },
  { pattern: /\b(eeo|e\.e\.o\.)\b/i, kind: "legal" },
  { pattern: /\b(diversity|inclusion|accommodations?)\b/i, kind: "legal" },
  { pattern: /\b(visa|sponsorship|work\s+authori[sz]ation|right\s+to\s+work)\b/i, kind: "legal" },
  { pattern: /\b(privacy|data\s+protection|gdpr)\b/i, kind: "legal" },

  { pattern: /\b(benefits?|perks?|compensation|salary|what\s+we\s+offer)\b/i, kind: "benefits" },
  { pattern: /\bwhy\s+(join|work|you['’]?ll\s+love)\b/i, kind: "benefits" },
  { pattern: /\b(pay|package|total\s+rewards?)\b/i, kind: "benefits" },

  {
    pattern:
      /\b(about\s+(us|the\s+(company|team))|who\s+we\s+are|our\s+(story|mission|values|culture))\b/i,
    kind: "about",
  },
  { pattern: /\bthe\s+company\b/i, kind: "about" },

  {
    pattern:
      /\b(how\s+to\s+apply|application\s+process|interview\s+process|hiring\s+process|next\s+steps)\b/i,
    kind: "process",
  },

  // --- required ----------------------------------------------------------
  { pattern: /\b(must|should)\s+have\b/i, kind: "required" },
  { pattern: /\brequire(d|ments?)\b/i, kind: "required" },
  {
    pattern: /\b(basic|minimum|essential|core)\s+(qualifications?|requirements?|skills?)\b/i,
    kind: "required",
  },
  { pattern: /\bqualifications?\b/i, kind: "required" },
  {
    // `(?:'ll|will)` rather than just the contraction: postings write both,
    // and matching only one silently drops the section to `unknown`.
    pattern:
      /\bwhat\s+(you\s*(?:['’]?ll|will)\s+need|you\s+need|we['’]?re\s+looking\s+for|we\s+need)\b/i,
    kind: "required",
  },
  { pattern: /\bwhat\s+you\s+bring\b/i, kind: "required" },
  { pattern: /\bwho\s+you\s+are\b/i, kind: "required" },
  { pattern: /\b(your\s+)?(background|experience|skills)\b/i, kind: "required" },
  { pattern: /\byou\s+(have|are|will\s+have)\b/i, kind: "required" },

  // --- responsibilities --------------------------------------------------
  {
    pattern: /\b(responsibilities|duties|the\s+job|the\s+role|role\s+overview)\b/i,
    kind: "responsibilities",
  },
  {
    pattern: /\bwhat\s+you\s*(?:['’]?ll|will)\s+(do|be\s+doing|own|work\s+on|drive|build)\b/i,
    kind: "responsibilities",
  },
  {
    pattern: /\b(day[-\s]?to[-\s]?day|in\s+this\s+role|your\s+impact)\b/i,
    kind: "responsibilities",
  },
  { pattern: /\bthe\s+opportunity\b/i, kind: "responsibilities" },
];

/** Classifies heading text. Returns `unknown` when nothing matches. */
export function classifyHeading(heading: string): JdSectionKind {
  const text = heading.trim();
  for (const { pattern, kind } of HEADING_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return "unknown";
}

/* -------------------------------------------------------------------------- */
/* Line shapes                                                                 */
/* -------------------------------------------------------------------------- */

const BULLET_PREFIX = /^\s*(?:[-*•·▪◦‣–—>]+|\(?\d{1,2}[.)]|[a-z][.)])\s+/i;
const MARKDOWN_HEADING = /^\s*#{1,6}\s+/;
const EMPHASIS = /^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*:?\s*$/;

/** Longest a line can be and still plausibly be a heading. */
const MAX_HEADING_LENGTH = 70;

/** Short enough that an unmarked line needs no further evidence. */
const SHORT_HEADING_WORDS = 4;

/** Longer than this and it is prose, whatever else it looks like. */
const MAX_HEADING_WORDS = 8;

function stripBullet(line: string): { text: string; bullet: boolean } {
  const match = BULLET_PREFIX.exec(line);
  if (!match) return { text: line.trim(), bullet: false };
  return { text: line.slice(match[0].length).trim(), bullet: true };
}

/** Removes markdown decoration and a trailing colon, leaving the words. */
export function normalizeHeading(line: string): string {
  return line
    .replace(MARKDOWN_HEADING, "")
    .replace(EMPHASIS, "$1")
    .replace(/^\s*\*\*|\*\*\s*$/g, "")
    .trim()
    .replace(/[:：]\s*$/, "")
    .trim();
}

/**
 * Whether a line is a heading, judged on shape before meaning.
 *
 * A heading is short, is not a bullet, and either ends with a colon, is
 * markdown-marked, or carries no sentence punctuation at all. Checking the
 * shape first is what stops "…depending on requirements." from splitting a
 * paragraph in half.
 */
export function looksLikeHeading(rawLine: string, nextNonEmpty?: string): boolean {
  const line = rawLine.trim();
  if (line.length === 0) return false;
  if (MARKDOWN_HEADING.test(line)) return true;
  if (BULLET_PREFIX.test(rawLine)) return false;

  const text = normalizeHeading(line);
  if (text.length === 0 || text.length > MAX_HEADING_LENGTH) return false;

  // A trailing colon is the strongest single signal a posting gives.
  if (/[:：]\s*$/.test(line)) return true;
  // Bold on its own line is the markdown equivalent of the same thing.
  if (EMPHASIS.test(line)) return true;

  // Unmarked from here on: no colon, no markdown. Sentence punctuation rules
  // it out, and after that length decides.
  if (/[.!?,;]/.test(text)) return false;

  const words = text.split(/\s+/).length;
  if (words <= SHORT_HEADING_WORDS) return true;
  if (words > MAX_HEADING_WORDS) return false;

  // Five to eight unmarked words is genuinely ambiguous — "Who we are" and
  // "The final scope will vary depending on requirements" have the same
  // shape. What separates them is what comes next: a heading of that length
  // introduces a list. Deciding on length alone splits paragraphs in half.
  return nextNonEmpty !== undefined && BULLET_PREFIX.test(nextNonEmpty);
}

/**
 * Per-line overrides.
 *
 * Postings routinely mark one item in a required list as optional —
 * "Experience with Terraform (nice to have)" — and a section-level
 * classification alone would score it as a hard requirement.
 */
const INLINE_PREFERRED =
  /\((?:nice\s+to\s+have|preferred|optional|bonus|a\s+plus|desirable)\)|\b(?:is\s+)?a\s+plus\b|(?:^|\s)(?:bonus|nice\s+to\s+have|preferred)\s*[:—-]/i;
const INLINE_REQUIRED =
  /\((?:required|must[-\s]have|mandatory)\)|(?:^|\s)(?:required|must\s+have)\s*[:—-]/i;

function inlineOverride(text: string): JdSectionKind | undefined {
  if (INLINE_PREFERRED.test(text)) return "preferred";
  if (INLINE_REQUIRED.test(text)) return "required";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A first line that names the job, when it looks like one.
 *
 * Pasted postings usually begin with the title. Taken only when it is short,
 * unpunctuated, and not itself a recognised section heading — otherwise a
 * posting that opens with "Responsibilities" would lose its first section.
 */
/** The next line with content, which is what disambiguates a long heading. */
function nextNonEmpty(lines: string[], after: number): string | undefined {
  for (let index = after + 1; index < lines.length; index += 1) {
    if (lines[index]!.trim().length > 0) return lines[index];
  }
  return undefined;
}

function readTitle(lines: string[]): { title: string | null; from: number } {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.trim().length === 0) continue;

    const text = normalizeHeading(line);
    if (looksLikeHeading(line, nextNonEmpty(lines, index)) && classifyHeading(text) !== "unknown") {
      return { title: null, from: index };
    }
    if (text.length > 0 && text.length <= MAX_HEADING_LENGTH && !/[.!?]/.test(text)) {
      return { title: text, from: index + 1 };
    }
    return { title: null, from: index };
  }
  return { title: null, from: lines.length };
}

export function parseJobDescription(source: string): ParsedJd {
  const rawLines = source.replace(/\r\n?/g, "\n").split("\n");
  const { title, from } = readTitle(rawLines);

  const sections: JdSection[] = [];
  let current: JdSection = {
    kind: "intro",
    heading: null,
    lines: [],
    weight: SECTION_WEIGHTS.intro,
    sourceLine: from,
  };

  const push = () => {
    // A heading with nothing under it is a heading that was misread, or an
    // empty section. Either way it contributes nothing, and keeping it would
    // put an empty category into "found under X".
    if (current.lines.length > 0) sections.push(current);
  };

  for (let index = from; index < rawLines.length; index += 1) {
    const raw = rawLines[index]!;
    if (raw.trim().length === 0) continue;

    if (looksLikeHeading(raw, nextNonEmpty(rawLines, index))) {
      const heading = normalizeHeading(raw);
      push();
      const kind = classifyHeading(heading);
      current = { kind, heading, lines: [], weight: SECTION_WEIGHTS[kind], sourceLine: index };
      continue;
    }

    const { text, bullet } = stripBullet(raw);
    if (text.length === 0) continue;
    const override = inlineOverride(text);
    current.lines.push({
      text,
      bullet,
      sourceLine: index,
      ...(override ? { kindOverride: override } : {}),
    });
  }
  push();

  return { title, sections };
}

/* -------------------------------------------------------------------------- */
/* Using the result                                                            */
/* -------------------------------------------------------------------------- */

export interface WeightedLine extends JdLine {
  kind: JdSectionKind;
  weight: number;
}

/**
 * Every line that carries signal, with the weight it carries.
 *
 * Zero-weight sections are dropped entirely rather than returned with a
 * weight of 0 — "ignore boilerplate sections entirely" (§6) means a
 * company's own tech stack under *About us* cannot contribute to a match at
 * all, not even faintly.
 */
export function weightedLines(parsed: ParsedJd): WeightedLine[] {
  const result: WeightedLine[] = [];
  for (const section of parsed.sections) {
    if (section.weight === 0) continue;
    for (const line of section.lines) {
      const kind = line.kindOverride ?? section.kind;
      const weight = SECTION_WEIGHTS[kind];
      if (weight === 0) continue;
      result.push({ ...line, kind, weight });
    }
  }
  return result;
}

/** How many lines landed in each kind. The quickest way to eyeball a split. */
export function sectionSummary(parsed: ParsedJd): Record<JdSectionKind, number> {
  const counts = Object.fromEntries(
    Object.keys(SECTION_WEIGHTS).map((kind) => [kind, 0]),
  ) as Record<JdSectionKind, number>;
  for (const section of parsed.sections) counts[section.kind] += section.lines.length;
  return counts;
}
