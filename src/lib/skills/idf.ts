/**
 * Inverse document frequency for a term in a job posting (M3-T2).
 *
 * The whole reason this module exists: without it, "Kubernetes" and "team"
 * weigh the same, and the matcher's advice becomes "add the word team to
 * your resume". M3-T2's acceptance is exactly that ratio.
 *
 * IDF here is the real formula — `ln(1 / documentFrequencyShare)` — applied
 * to the estimated tiers in `common-words.ts` rather than to counts from a
 * corpus we do not have. See that file for why the corpus is written rather
 * than ingested.
 */

import { COMMON_WORD_TIERS, TIER_SHARE } from "./common-words";
import { normalizeTerm, type SkillIndex } from "./lookup";

/**
 * Assumed share of postings containing a word we have never seen.
 *
 * Unknown means "not among the words job postings reach for by default",
 * which for a proper noun like *Terraform* or *Snowflake* is the common
 * case. One posting in two hundred is deliberately conservative: it makes an
 * unknown term valuable without making it overwhelming, and it is the number
 * to revisit first if scores start looking gameable by inventing words.
 */
const UNKNOWN_SHARE = 0.005;

/**
 * The floor a recognised skill cannot fall below, as a share.
 *
 * Some real skills are also ordinary English — *Excel*, *Go*, *Rust*, and
 * anything written as an initialism. Being in the skill vocabulary is itself
 * evidence the term is meaningful in a hiring context, so a match against a
 * known skill is never weighed as though it were furniture. Without this,
 * "Go" would score like the verb.
 */
const KNOWN_SKILL_MAX_SHARE = 0.08;

function idfFromShare(share: number): number {
  return Math.log(1 / share);
}

/** The value every unknown term gets. Exported so tests can name it. */
export const UNKNOWN_IDF = idfFromShare(UNKNOWN_SHARE);

/**
 * IDF for a raw term.
 *
 * `skills` is optional so this stays usable — and testable — without loading
 * the skill vocabulary. Pass it wherever the floor above should apply, which
 * is everywhere the scorer runs.
 */
export function idf(term: string, skills?: SkillIndex): number {
  const key = normalizeTerm(term);
  if (!key) return 0;

  const known = skills?.resolve(key) ?? null;

  // A multi-word term is not in the common list by construction, and phrases
  // like "machine learning" are exactly the terms worth weighting. Treated
  // as unknown unless the skill floor raises it.
  const tier = COMMON_WORD_TIERS.get(key);
  const share = tier ? TIER_SHARE[tier] : UNKNOWN_SHARE;
  const effective = known ? Math.min(share, KNOWN_SKILL_MAX_SHARE) : share;

  return idfFromShare(effective);
}
