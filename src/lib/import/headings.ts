/**
 * Section headings in somebody else's resume (P31-A2).
 *
 * ## Same problem as `lib/jd/parse.ts`, so the same solution
 *
 * A resume is an unheaded pile of lines until something decides which of
 * them name a section. That is the identical problem the JD parser solves,
 * and it earned two lessons there that are re-applied here rather than
 * re-learned:
 *
 * 1. **Shape before meaning.** A line is considered a heading only when it
 *    *looks* like one — short, not a bullet, no sentence punctuation or a
 *    trailing colon. "…with experience in distributed systems." contains
 *    "experience"; classifying by phrase first splits a bullet in half and
 *    the rest of the role's content lands in a section it never belonged to.
 *
 * 2. **Pattern order is load-bearing.** "Technical Skills" contains
 *    "Skills" and "Academic Projects" contains "Projects"; the specific
 *    pattern has to be tested before the general one or the specific one is
 *    unreachable. Here the collision that bites is "Volunteer Experience",
 *    which contains "Experience" but is not the work history, and
 *    "Courses & Certifications", which contains "Courses" but is not
 *    education.
 *
 * ## Strength, and why an unrecognised line is usually not a heading
 *
 * The loosest positive signal — a short line with no sentence punctuation —
 * matches things that are emphatically not headings. `Author` and
 * `Team Lead` are project roles set on their own line, and both pass it.
 * Treating them as headings splits a section in the middle and moves the
 * rest of an entry somewhere it never was.
 *
 * So shape detection returns a *strength*. Only a **strong** heading — set
 * in capitals, or ending in a colon — may name a section we do not
 * recognise. A **weak** one has to classify to a known section type to count
 * at all. That asymmetry is the whole reason this is not one boolean.
 *
 * ## DOCX skips the heuristic entirely
 *
 * A heading paragraph style is the document *stating* that the line is a
 * heading. There is nothing to infer, and inferring anyway would mean a
 * correctly styled DOCX could be read worse than a PDF — which inverts D4.
 */

import type { SectionType } from "@/lib/resume/schema";

/**
 * What a heading turned out to name.
 *
 * `custom` is a real answer, not a failure: "Volunteering" and "Publications"
 * are sections a resume genuinely has, and dropping their content because we
 * have no dedicated type for them would lose the user's work. `null` means
 * the line is not a heading at all.
 */
export type HeadingKind = SectionType | "contact";

/** How much evidence the line's *shape* gives. See the docblock. */
export type HeadingStrength = "strong" | "weak" | null;

const BULLET_PREFIX = /^\s*(?:[-*•·▪◦‣–—>]+|\(?\d{1,2}[.)]|[a-z][.)])\s+/i;

/** Longest a line can be and still plausibly be a heading. */
const MAX_HEADING_LENGTH = 48;

/** Longer than this and it is prose, whatever else it looks like. */
const MAX_HEADING_WORDS = 5;

/**
 * Ordered most specific first. See the docblock: the order is the module.
 *
 * Every pattern is anchored to the start of the heading rather than searching
 * inside it, because a heading is short by the time it reaches here and a
 * free search re-introduces exactly the substring collision the ordering
 * exists to prevent.
 */
const HEADING_PATTERNS: readonly { pattern: RegExp; kind: HeadingKind }[] = [
  // --- things that read as experience but are not the work history --------
  { pattern: /^(volunteer|community|extra[-\s]?curricular)/i, kind: "custom" },
  { pattern: /^(publications?|research|patents?)\b/i, kind: "custom" },
  { pattern: /^(awards?|honou?rs?|achievements?|scholarships?)\b/i, kind: "custom" },
  { pattern: /^(languages?|interests?|hobbies|activities|references?)\b/i, kind: "custom" },
  { pattern: /^(positions? of responsibility|leadership roles?)\b/i, kind: "custom" },
  { pattern: /^(conferences?|talks?|speaking|memberships?)\b/i, kind: "custom" },

  // --- certifications, before "courses" can be read as education ----------
  { pattern: /^(courses?|training)\s*(&|and)\s*certificat/i, kind: "certifications" },
  { pattern: /^(certificat(es?|ions?)|licen[cs]es?|credentials?)\b/i, kind: "certifications" },
  { pattern: /^(online\s+)?(courses?|training|moocs?)\b/i, kind: "certifications" },

  // --- projects, before education can swallow "academic projects" ---------
  { pattern: /^(academic|personal|side|selected|key|major)?\s*projects?\b/i, kind: "projects" },
  { pattern: /^portfolio\b/i, kind: "projects" },

  // --- education ----------------------------------------------------------
  { pattern: /^(education|academics?|academic background)\b/i, kind: "education" },
  {
    pattern: /^(degrees?|schooling|(relevant\s+)?coursework|qualifications?)\b/i,
    kind: "education",
  },

  // --- skills -------------------------------------------------------------
  {
    pattern: /^((technical|core|key|professional|it)\s+)?(skills?|competenc(y|ies)|proficienc)/i,
    kind: "skills",
  },
  { pattern: /^(technolog(y|ies)|tools?|tech\s+stack|technical\s+summary)\b/i, kind: "skills" },
  { pattern: /^areas?\s+of\s+expertise\b/i, kind: "skills" },

  // --- experience ---------------------------------------------------------
  {
    pattern: /^((work|professional|relevant|industry|employment)\s+)?experience\b/i,
    kind: "experience",
  },
  { pattern: /^(employment|work)\s+history\b/i, kind: "experience" },
  {
    pattern: /^(internships?|positions?\s+held|career\s+(history|summary))\b/i,
    kind: "experience",
  },

  // --- summary ------------------------------------------------------------
  {
    pattern: /^(professional|career|executive)?\s*(summary|profile|objective)\b/i,
    kind: "summary",
  },
  { pattern: /^about(\s+me)?\b/i, kind: "summary" },

  // --- contact ------------------------------------------------------------
  { pattern: /^(contact|personal\s+(details|information))\b/i, kind: "contact" },
];

/** Strips decoration a resume heading picks up: colons, rules, bullet glyphs. */
export function normalizeHeading(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^[\s*_•·▪—–-]+/, "")
    .replace(/[\s*_•·▪—–-]+$/, "")
    .trim()
    .replace(/[:：]\s*$/, "")
    .trim();
}

/**
 * How strongly a line's shape says "heading", judged before any meaning.
 *
 * The two strong signals are the two a resume actually uses deliberately:
 * setting the heading in capitals, or ending it with a colon. Everything
 * else is weak by construction — see the docblock for why that distinction
 * carries the module.
 */
export function headingStrength(rawLine: string): HeadingStrength {
  const line = rawLine.trim();
  if (line.length === 0) return null;
  if (BULLET_PREFIX.test(rawLine)) return null;

  const text = normalizeHeading(line);
  if (text.length === 0 || text.length > MAX_HEADING_LENGTH) return null;
  if (text.split(/\s+/).length > MAX_HEADING_WORDS) return null;

  // A year is a role header or a graduation line, never a section heading —
  // and those are short and unpunctuated, so they pass everything below.
  if (/\b(19|20)\d{2}\b/.test(text)) return null;
  // An email or a URL is the contact block, whatever else it looks like.
  if (/@|https?:\/\/|www\./i.test(text)) return null;

  if (/[:：]\s*$/.test(line)) return "strong";
  if (text === text.toUpperCase() && /\p{L}/u.test(text)) return "strong";

  // Anything left has to at least carry no sentence punctuation.
  return /[.,;!?]/.test(text) ? null : "weak";
}

/** Classifies heading text. Returns null when nothing matches. */
export function classifyHeading(heading: string): HeadingKind | null {
  const text = normalizeHeading(heading);
  if (text.length === 0) return null;
  for (const { pattern, kind } of HEADING_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return null;
}

/**
 * Shape and meaning together, for the PDF path where nothing states the
 * structure.
 *
 * A strong heading we do not recognise becomes `custom` — a section the
 * resume has and we have no type for. Dropping what follows it would lose
 * the user's work, and a lossy import that says so beats one that does not.
 * A weak heading we do not recognise is not treated as a heading at all.
 */
export function headingKindOf(rawLine: string): HeadingKind | null {
  const strength = headingStrength(rawLine);
  if (strength === null) return null;
  const kind = classifyHeading(rawLine);
  if (kind) return kind;
  return strength === "strong" ? "custom" : null;
}

/**
 * The heading level a DOCX paragraph style declares, or null for a style
 * that is not a heading at all.
 *
 * Word's built-in heading styles arrive with several spellings depending on
 * what produced the file — `Heading1`, `heading 1`, `Heading1Char` from a
 * converted document — and templates add their own `SectionHeading`. All
 * mean the same thing, and none should have to pass the shape test.
 *
 * The level matters because our own DOCX sets *section* headings as
 * `Heading1` and *entry* headings as `Heading2`. Treating every heading
 * style as a section boundary would make each job title start a new section.
 * The caller resolves this by taking the shallowest level present as the
 * section level, which also handles a foreign document that uses `Heading2`
 * throughout and no `Heading1` at all.
 */
export function docxHeadingLevel(style: string): number | null {
  const compact = style.replace(/\s+/g, "");
  const numbered = compact.match(/^heading([1-6])/i);
  if (numbered) return Number(numbered[1]);
  if (/^(section|resume|cv)?heading/i.test(compact)) return 1;
  return null;
}
