/**
 * Resolving a written term to a known skill (M3-T1).
 *
 * The matcher's whole credibility rests on this file. A resume says "k8s",
 * a posting says "Kubernetes", and if these do not resolve to the same
 * thing the user is told they are missing a skill printed on their own
 * resume — which is the fastest possible way to lose their trust, because
 * they can see the counter-evidence.
 *
 * ## Normalisation, and where it deliberately stops
 *
 * Lowercase, collapse whitespace, strip punctuation *except* the characters
 * that carry meaning in technology names. `C++`, `C#`, `.NET`, `Node.js`
 * and `CI/CD` are all distinct from what they become if you strip symbols
 * naively, and three of them collapse into each other or into nothing.
 *
 * Singularisation is the other trap. Stripping a trailing "s" turns "AWS"
 * into "AW" and "Kubernetes" into "Kubernete". It is applied only when the
 * singular form is itself a known skill, which makes it safe by
 * construction rather than by a list of exceptions.
 */

import { CURATED_SKILLS } from "./curated";

export interface SkillEntry {
  /** Stable slug: "kubernetes". */
  id: string;
  /** What the UI displays, with the casing users expect: "PostgreSQL". */
  canonical: string;
  aliases: string[];
  category: string;
  /** Where the entry came from, so attribution can be checked per entry. */
  source: "onet" | "curated";
}

/** The shape `data/skills.json` is written in by `scripts/build-skills.mjs`. */
export interface SkillsData {
  generatedAt: string;
  /** Recorded here as well as in docs/ATTRIBUTION.md — CC BY 4.0 requires it. */
  sources: { name: string; licence: string; url: string }[];
  skills: SkillEntry[];
}

/**
 * Characters kept during normalisation.
 *
 * `+` for C++, `#` for C#, `.` for .NET and Node.js, `/` for CI/CD and A/B.
 * Everything else — commas, parentheses, quotes, en dashes — is separator
 * noise from prose and goes.
 */
const KEEP = /[^a-z0-9+#./\s-]/g;

export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(KEEP, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
}

export class SkillIndex {
  /** Normalised term to entry. Built once; every lookup is a map hit. */
  private readonly byTerm = new Map<string, SkillEntry>();
  private readonly byId = new Map<string, SkillEntry>();

  constructor(entries: readonly SkillEntry[]) {
    for (const entry of entries) {
      this.byId.set(entry.id, entry);
      // Canonical first, then aliases. An earlier entry wins a collision, so
      // curated entries must be registered before ingested ones — see
      // `buildSkillIndex`.
      for (const term of [entry.canonical, ...entry.aliases]) {
        const key = normalizeTerm(term);
        if (key && !this.byTerm.has(key)) this.byTerm.set(key, entry);
      }
    }
  }

  get size(): number {
    return this.byId.size;
  }

  byIdOrNull(id: string): SkillEntry | null {
    return this.byId.get(id) ?? null;
  }

  /**
   * Resolves a written term, or null.
   *
   * Null is a real answer, not a failure: most words in a job description
   * are not skills, and the scorer needs "this is not a skill" far more
   * often than it needs a match.
   */
  resolve(term: string): SkillEntry | null {
    const key = normalizeTerm(term);
    if (!key) return null;

    const direct = this.byTerm.get(key);
    if (direct) return direct;

    // Safe singularisation: only when dropping the "s" lands on something
    // real. "AWS" has no entry for "aw", so it stays "aws" and resolves.
    if (key.endsWith("s") && key.length > 3) {
      const singular = this.byTerm.get(key.slice(0, -1));
      if (singular) return singular;
    }

    return null;
  }
}

/**
 * Builds the index, curated entries first.
 *
 * Order is the whole point. O*NET has an entry literally named "Python" and
 * another named "Go"; ours carry the aliases and the casing we want shown.
 * Registering curated first means a collision resolves to the entry we
 * control, and the ingested one is dropped rather than shadowing it.
 */
export function buildSkillIndex(ingested: readonly SkillEntry[] = []): SkillIndex {
  const curated: SkillEntry[] = CURATED_SKILLS.map((skill) => ({
    id: skill.id,
    canonical: skill.canonical,
    aliases: [...skill.aliases],
    category: skill.category,
    source: "curated",
  }));

  const curatedIds = new Set(curated.map((entry) => entry.id));
  const rest = ingested.filter((entry) => !curatedIds.has(entry.id));

  return new SkillIndex([...curated, ...rest]);
}
