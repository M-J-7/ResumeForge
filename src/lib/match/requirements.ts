/**
 * What a posting is actually asking for (M3-T4).
 *
 * Turns a parsed job description into a weighted list of skills. Three
 * things decide how much a mention counts:
 *
 * 1. **Where it appears.** `SECTION_WEIGHTS` in the JD parser already
 *    encodes this — required ≈ 3× preferred, boilerplate 0. That work is
 *    done; this module consumes it rather than re-deriving it.
 * 2. **How rare the term is.** `idf()` is what stops "team" outweighing
 *    "Kubernetes" purely by being repeated more often.
 * 3. **How often, up to a cap.** A posting that says "Python" nine times is
 *    not asking for nine times more Python.
 *
 * ## Phrase matching, longest first
 *
 * "Machine learning" has to beat "learning", and "Google Cloud Platform" has
 * to beat "Google". Scanning word-by-word finds the shortest match and gets
 * both wrong, so this walks n-grams from longest to shortest and consumes
 * the words a match covers.
 */

import { weightedLines, type JdSectionKind, type ParsedJd } from "@/lib/jd/parse";
import { idf } from "@/lib/skills/idf";
import { normalizeTerm, type SkillEntry, type SkillIndex } from "@/lib/skills/lookup";

/**
 * Mentions beyond this add nothing.
 *
 * M3-T4 calls for per-keyword caps so "the 8th mention of Python earns
 * nothing". Three is where a posting has clearly established a requirement;
 * past that it is emphasis, not additional need.
 */
export const MENTION_CAP = 3;

/** The longest phrase considered. "Google Cloud Platform" is three. */
const MAX_PHRASE_WORDS = 4;

export interface JdRequirement {
  skill: SkillEntry;
  /** How many times the posting mentions it, uncapped — shown to the user. */
  mentions: number;
  /** The JD sections it appeared under, strongest first. */
  sections: JdSectionKind[];
  /** Σ (section weight × idf), with mentions capped. The ranking number. */
  weight: number;
  /** One line from the posting, kept verbatim for provenance. */
  quote: string;
}

/** Splits a line into comparable word tokens, preserving order. */
function tokenize(line: string): string[] {
  return normalizeTerm(line).split(" ").filter(Boolean);
}

/**
 * Every skill mentioned in one line, each counted once per occurrence.
 *
 * Consumes matched words so a phrase and its parts cannot both score — see
 * the header on why longest-first matters.
 */
export function skillsInLine(line: string, skills: SkillIndex): SkillEntry[] {
  const words = tokenize(line);
  const found: SkillEntry[] = [];

  let i = 0;
  while (i < words.length) {
    let matched: SkillEntry | null = null;
    let length = 0;

    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n -= 1) {
      const phrase = words.slice(i, i + n).join(" ");
      const skill = skills.resolve(phrase);
      if (skill) {
        matched = skill;
        length = n;
        break;
      }
    }

    if (matched) {
      found.push(matched);
      i += length;
    } else {
      i += 1;
    }
  }

  return found;
}

/** Strongest section first, so the UI can say "including under Requirements". */
const SECTION_RANK: Record<JdSectionKind, number> = {
  required: 0,
  responsibilities: 1,
  preferred: 2,
  intro: 3,
  unknown: 4,
  about: 5,
  benefits: 6,
  legal: 7,
  process: 8,
};

export function extractRequirements(jd: ParsedJd, skills: SkillIndex): JdRequirement[] {
  interface Accumulator {
    skill: SkillEntry;
    mentions: number;
    sections: Set<JdSectionKind>;
    /** Section weights in mention order, so the cap keeps the strongest. */
    weights: number[];
    quote: string;
  }

  const byId = new Map<string, Accumulator>();

  for (const line of weightedLines(jd)) {
    for (const skill of skillsInLine(line.text, skills)) {
      let entry = byId.get(skill.id);
      if (!entry) {
        entry = { skill, mentions: 0, sections: new Set(), weights: [], quote: line.text };
        byId.set(skill.id, entry);
      }
      entry.mentions += 1;
      entry.sections.add(line.kind);
      entry.weights.push(line.weight);

      // Prefer a quote from the strongest section available: "found under
      // Requirements" is the useful thing to show, not whichever line came
      // first in the file.
      if (SECTION_RANK[line.kind] < Math.min(...[...entry.sections].map((k) => SECTION_RANK[k]))) {
        entry.quote = line.text;
      }
    }
  }

  const requirements: JdRequirement[] = [];
  for (const entry of byId.values()) {
    // Cap on the strongest mentions rather than the first ones: a skill
    // named once under Requirements and five times under About us should
    // keep the Requirements weight.
    const counted = [...entry.weights].sort((a, b) => b - a).slice(0, MENTION_CAP);
    const sectionWeight = counted.reduce((sum, w) => sum + w, 0);

    requirements.push({
      skill: entry.skill,
      mentions: entry.mentions,
      sections: [...entry.sections].sort((a, b) => SECTION_RANK[a] - SECTION_RANK[b]),
      weight: sectionWeight * idf(entry.skill.canonical, skills),
      quote: entry.quote,
    });
  }

  return requirements.sort((a, b) => b.weight - a.weight);
}
