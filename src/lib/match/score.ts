/**
 * Scoring a resume against a job description (M3-T4).
 *
 * The acceptance criterion is one sentence and it is the whole design:
 * **a stuffed resume must score lower than an honest one against the same
 * JD.** Every rule below exists to make that structurally true rather than
 * true on the examples that were tried.
 *
 * Four rules, and three of the four are not enough:
 *
 * 1. **Section-weighted evidence.** A skill shown in an experience bullet
 *    counts far more than the same word in a comma-separated list. Without
 *    this, adding words to a list is the cheapest way to raise a score, and
 *    the tool teaches exactly the behaviour it should discourage.
 * 2. **Per-keyword caps.** The eighth "Python" earns nothing, so repetition
 *    is not a strategy.
 * 3. **An explicit density penalty.** Rules 1 and 2 make stuffing *futile*;
 *    only this makes it *counterproductive*. Without it the stuffed resume
 *    ties the honest one rather than losing to it, and the acceptance test
 *    fails.
 * 4. **Provenance on everything.** Not a scoring rule, but the reason the
 *    number is defensible: M3-T5 requires every component to trace back to
 *    specific resume text.
 *
 * Per D12 this returns a breakdown rather than a single number, and the UI
 * shows it on demand rather than live. A live 0–100 badge gets optimised
 * instead of the resume.
 */

import type { ParsedJd } from "@/lib/jd/parse";
import type { ResumeDocument } from "@/lib/resume/schema";
import { normalizeTerm, type SkillEntry, type SkillIndex } from "@/lib/skills/lookup";
import { COMMON_WORD_TIERS } from "@/lib/skills/common-words";
import { lint } from "@/lib/lint/engine";
import {
  EVIDENCE_WEIGHT,
  isDemonstration,
  resumeFragments,
  resumeWordCount,
  type EvidenceKind,
  type ResumeFragment,
} from "./evidence";
import { extractRequirements, skillsInLine, type JdRequirement } from "./requirements";

export interface KeywordEvidence {
  kind: EvidenceKind;
  sectionId: string;
  entryId?: string;
  /** Verbatim, so the UI can quote it and scroll to it. */
  text: string;
}

export type KeywordStatus = "demonstrated" | "listed-only" | "missing";

export interface KeywordFinding {
  skill: SkillEntry;
  /** Mentions in the *job description*. */
  jdMentions: number;
  jdSections: JdRequirement["sections"];
  /** The posting's own words, for "found under Requirements". */
  jdQuote: string;
  /** Σ (section weight × idf), capped. Drives ranking. */
  jdWeight: number;
  resumeEvidence: KeywordEvidence[];
  status: KeywordStatus;
}

export type Recommendation =
  | { kind: "missing"; skill: SkillEntry; whereAsked: JdRequirement["sections"]; why: string }
  | { kind: "listed-only"; skill: SkillEntry; suggestion: string }
  | { kind: "stuffing"; skill: SkillEntry; detail: string };

export interface MatchResult {
  keywords: KeywordFinding[];
  /** 0–100: weighted share of the posting's requirements met at all. */
  coverage: number;
  /** 0–100: of what is matched, how much is shown rather than listed. */
  evidence: number;
  /** 0–100: from the existing lint engine, so formatting is not re-derived. */
  formatting: number;
  stuffingPenalty: { applied: number; reasons: string[] };
  recommendations: Recommendation[];
  /** Set when the posting names nothing we recognise — see `scoreResume`. */
  unmatchedJd: boolean;
}

/**
 * Mentions of one skill beyond this, per hundred words, read as stuffing.
 *
 * Three mentions of a genuine specialism in a 600-word resume is 0.5 — well
 * clear. Ten mentions in the same resume is 1.67 and is not writing anybody
 * does by accident.
 */
const DENSITY_THRESHOLD_PER_100 = 1.2;

/**
 * No skill is stuffing below this many mentions, whatever the density.
 *
 * Density alone is wrong on short resumes, and wrong in the direction that
 * matters: a fresher's one-page resume naming Kubernetes exactly once in
 * eighty words is 1.25 per hundred, over the threshold, and would be accused
 * of keyword stuffing for mentioning a skill a single time. Stuffing is
 * repetition; two mentions is writing.
 */
const MIN_MENTIONS_FOR_STUFFING = 3;

/**
 * When a "bullet" is really a keyword list.
 *
 * The obvious way around section-weighted evidence is to paste the keyword
 * dump *into* an experience bullet, where it scores as a demonstration. A
 * line is treated as a list rather than an accomplishment when it names
 * several skills and consists mostly of them — which is true of
 * "Kubernetes, Terraform, AWS, Go, Python" and false of any sentence
 * describing work.
 */
const LIST_MIN_SKILLS = 3;
const LIST_SKILL_WORD_SHARE = 0.5;

/** Points deducted per unit of excess density, summed across skills. */
const DENSITY_PENALTY_SCALE = 22;

/** Deduction ceiling. A stuffed resume should score badly, not negatively. */
const MAX_PENALTY = 45;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * The strength of the best evidence for a skill.
 *
 * Best rather than sum, deliberately: a skill shown once in a real
 * accomplishment is demonstrated, and repeating it does not make it more so.
 * Summing here would reintroduce repetition as a strategy through the back
 * door, after rule 2 removed it from the JD side.
 */
function evidenceStrength(evidence: readonly KeywordEvidence[]): number {
  let best = 0;
  for (const item of evidence) best = Math.max(best, EVIDENCE_WEIGHT[item.kind]);
  return best;
}

/**
 * True when a fragment is a keyword list wearing a bullet's clothes.
 *
 * Without this, the cheapest defeat of section-weighted evidence is to paste
 * the skills list into an experience bullet — the words are identical, and
 * the bullet is worth four times the list.
 *
 * The share is measured against *content* words, not all words. Padding a
 * list with filler — "Kubernetes and Terraform and AWS and Kubernetes" — is
 * still a list, and counting the conjunctions in the denominator is exactly
 * how it would slip through. `COMMON_WORD_TIERS`' ubiquitous tier is the
 * stopword set built for the IDF corpus, reused here rather than duplicated.
 */
function looksLikeKeywordList(text: string, skills: SkillIndex): boolean {
  const contentWords = normalizeTerm(text)
    .split(" ")
    .filter((word) => word && COMMON_WORD_TIERS.get(word) !== "ubiquitous").length;
  if (contentWords === 0) return false;

  const found = skillsInLine(text, skills);
  if (found.length < LIST_MIN_SKILLS) return false;

  return found.length / contentWords >= LIST_SKILL_WORD_SHARE;
}

function findEvidence(
  skill: SkillEntry,
  fragments: readonly ResumeFragment[],
  skills: SkillIndex,
): KeywordEvidence[] {
  const found: KeywordEvidence[] = [];
  for (const fragment of fragments) {
    if (!skillsInLine(fragment.text, skills).some((s) => s.id === skill.id)) continue;

    // Demoted rather than dropped: the mention is real and the user should
    // still see it, it simply does not count as having *shown* the skill.
    const kind: EvidenceKind =
      isDemonstration(fragment.kind) && looksLikeKeywordList(fragment.text, skills)
        ? "skillsList"
        : fragment.kind;

    found.push({
      kind,
      sectionId: fragment.sectionId,
      entryId: fragment.entryId,
      text: fragment.text,
    });
  }
  return found;
}

/**
 * The density penalty — rule 3, and the one that makes the acceptance test
 * pass.
 *
 * Counts every mention of every skill across the resume, not only the ones
 * the posting asked for: padding with adjacent technologies is the same
 * behaviour and should cost the same.
 */
function stuffingPenalty(
  fragments: readonly ResumeFragment[],
  skills: SkillIndex,
): { applied: number; reasons: string[]; perSkill: Map<string, number> } {
  const counts = new Map<string, { skill: SkillEntry; count: number }>();
  for (const fragment of fragments) {
    for (const skill of skillsInLine(fragment.text, skills)) {
      const entry = counts.get(skill.id) ?? { skill, count: 0 };
      entry.count += 1;
      counts.set(skill.id, entry);
    }
  }

  const words = Math.max(resumeWordCount(fragments), 1);
  const per100 = 100 / words;

  let raw = 0;
  const reasons: string[] = [];
  const perSkill = new Map<string, number>();

  for (const { skill, count } of counts.values()) {
    // Repetition first, density second. See MIN_MENTIONS_FOR_STUFFING: a
    // short resume naming a skill once clears the density threshold on
    // arithmetic alone, and accusing it of stuffing would be absurd.
    if (count < MIN_MENTIONS_FOR_STUFFING) continue;

    const density = count * per100;
    const excess = density - DENSITY_THRESHOLD_PER_100;
    if (excess <= 0) continue;

    raw += excess * DENSITY_PENALTY_SCALE;
    perSkill.set(skill.id, count);
    reasons.push(
      `"${skill.canonical}" appears ${count} times in ${words} words — ` +
        `dense enough to read as keyword stuffing rather than experience.`,
    );
  }

  return { applied: Math.min(raw, MAX_PENALTY), reasons, perSkill };
}

/** Formatting, borrowed from the lint engine rather than re-derived. */
function formattingScore(resume: ResumeDocument): number {
  const { findings } = lint(resume, []);
  const counted = findings.filter((finding) => finding.severity !== "info");
  // Each outstanding issue costs 8 points, floored at 0. Deliberately coarse:
  // D12 warns against a precise-looking number built out of heuristics.
  return clamp(100 - counted.length * 8);
}

export interface ScoreOptions {
  /** Overridable so a test can score against a fixed vocabulary. */
  skills: SkillIndex;
}

export function scoreResume(
  resume: ResumeDocument,
  jd: ParsedJd,
  { skills }: ScoreOptions,
): MatchResult {
  const fragments = resumeFragments(resume);
  const requirements = extractRequirements(jd, skills);
  const penalty = stuffingPenalty(fragments, skills);

  const keywords: KeywordFinding[] = requirements.map((requirement) => {
    const evidence = findEvidence(requirement.skill, fragments, skills);
    const demonstrated = evidence.some((item) => isDemonstration(item.kind));
    const status: KeywordStatus =
      evidence.length === 0 ? "missing" : demonstrated ? "demonstrated" : "listed-only";

    return {
      skill: requirement.skill,
      jdMentions: requirement.mentions,
      jdSections: requirement.sections,
      jdQuote: requirement.quote,
      jdWeight: requirement.weight,
      resumeEvidence: evidence,
      status,
    };
  });

  const totalWeight = keywords.reduce((sum, k) => sum + k.jdWeight, 0);

  /**
   * A posting naming nothing we recognise scores 0 on both gauges, which
   * would read as "your resume is terrible" when it means "we did not
   * understand this posting". Flagged so the UI can say the honest thing.
   */
  const unmatchedJd = keywords.length === 0 || totalWeight === 0;

  let coverage = 0;
  let evidence = 0;

  if (!unmatchedJd) {
    let matchedWeight = 0;
    let evidenceWeighted = 0;

    for (const keyword of keywords) {
      if (keyword.status === "missing") continue;
      matchedWeight += keyword.jdWeight;
      // Normalised against the strongest possible evidence, so "shown in a
      // bullet" is 100% and "in a skills list" is a quarter of it.
      evidenceWeighted +=
        keyword.jdWeight *
        (evidenceStrength(keyword.resumeEvidence) / EVIDENCE_WEIGHT.experienceBullet);
    }

    coverage = clamp((matchedWeight / totalWeight) * 100 - penalty.applied);
    evidence = matchedWeight > 0 ? clamp((evidenceWeighted / matchedWeight) * 100) : 0;
  }

  const recommendations: Recommendation[] = [];

  for (const keyword of keywords) {
    if (keyword.status === "missing") {
      recommendations.push({
        kind: "missing",
        skill: keyword.skill,
        whereAsked: keyword.jdSections,
        // Names the gap and asks a question. It never writes the bullet —
        // D8, and the same discipline as the Bullet Coach.
        why:
          `The posting mentions ${keyword.skill.canonical} ${keyword.jdMentions} ` +
          `time${keyword.jdMentions === 1 ? "" : "s"}` +
          `${keyword.jdSections.includes("required") ? ", including under its requirements" : ""}. ` +
          `Nothing in your resume mentions it. If you have used it, which piece of work was that?`,
      });
    } else if (keyword.status === "listed-only") {
      recommendations.push({
        kind: "listed-only",
        skill: keyword.skill,
        suggestion:
          `${keyword.skill.canonical} is in your skills list but no bullet shows you using it. ` +
          `A line describing what you built with it counts for far more than the list entry does.`,
      });
    }
  }

  for (const [skillId, count] of penalty.perSkill) {
    const skill = skills.byIdOrNull(skillId);
    if (!skill) continue;
    recommendations.push({
      kind: "stuffing",
      skill,
      detail:
        `${skill.canonical} appears ${count} times. Density this high reads as keyword stuffing ` +
        `to a human reader, and it is deducted here rather than rewarded.`,
    });
  }

  return {
    keywords,
    coverage: Math.round(coverage),
    evidence: Math.round(evidence),
    formatting: formattingScore(resume),
    stuffingPenalty: { applied: Math.round(penalty.applied), reasons: penalty.reasons },
    recommendations,
    unmatchedJd,
  };
}
