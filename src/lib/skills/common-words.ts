/**
 * How common a word is in job postings, as document-frequency tiers (M3-T2).
 *
 * TF-IDF needs document frequency across many documents. A single pasted
 * posting supplies none, which is why a naive keyword matcher weighs "team"
 * exactly like "Kubernetes" and then tells a candidate to add the word
 * "team" to their resume.
 *
 * ## Why this list is written rather than ingested
 *
 * The plan sanctions "a general English word-frequency list used as an
 * inverse proxy". The obvious candidate — the widely-copied
 * google-10000-english list — is derived from the Google Web Trillion Word
 * Corpus, distributed by the Linguistic Data Consortium, and its own licence
 * says plainly: *"I do not recommend using this data for commercial purposes
 * without licensing it from the Linguistic Data Consortium."* This product
 * has a monetisation plan, so that is a licence we would be relying on and
 * do not have. M3-T1 says to verify licence terms before shipping; this is
 * that check coming back negative.
 *
 * Writing the list instead turns out to be the better engineering answer as
 * well as the safe one. What the scorer needs is not a precise frequency
 * ranking of English — it is "these words carry no signal about whether this
 * candidate fits this job". General-corpus frequency is a poor proxy for
 * that: "excel" is uncommon in English prose and ubiquitous in job postings,
 * and a borrowed list gets it exactly backwards.
 *
 * ## Tiers are estimated document-frequency shares
 *
 * Each tier is "roughly what fraction of job postings contain this word at
 * least once", and `idf.ts` turns that into `ln(1 / share)` — the real IDF
 * formula, not a made-up scale. The numbers are estimates and are meant to
 * be: the ranking between tiers is what the scorer depends on, and that
 * ranking is not in doubt.
 */

/** Estimated share of job postings containing the word. */
export const TIER_SHARE = {
  /** Function words and posting furniture. Present in almost every posting. */
  ubiquitous: 0.9,
  /** The vocabulary every posting reaches for regardless of the role. */
  veryCommon: 0.6,
  /** Common across postings but starting to carry a little meaning. */
  common: 0.3,
} as const;

export type CommonWordTier = keyof typeof TIER_SHARE;

/**
 * Present in nearly every posting: articles, prepositions, auxiliaries, and
 * the handful of nouns every job advert contains by construction.
 */
const UBIQUITOUS = `
a an and are as at be been being but by can do does for from had has have he
her his how i if in into is it its me my no not of on or our out she so some
such than that the their them then there these they this those to up us was
we were what when where which while who will with would you your
also any each may more most no other own same too very
job role position candidate applicant apply application company organisation
organization employer employee please note must should
`;

/**
 * The vocabulary every posting reaches for whatever the job is. This is the
 * tier that matters most: it is where "team" and "experience" live, and
 * weighting them like a technology is the specific failure this file exists
 * to prevent.
 */
const VERY_COMMON = `
work working works team teams experience experienced experiences skill skills
ability abilities able year years new help helping support supporting time
business company companies provide providing ensure ensuring include including
required require requires requirement requirements responsible responsibility
responsibilities duty duties day daily week weekly month monthly
good great strong excellent effective successful success
people person staff member members colleague colleagues client clients
customer customers user users project projects product products service
services process processes system systems tool tools task tasks
level senior junior lead leading manage managing management manager
develop developing development build building create creating design designing
deliver delivering deliverable maintain maintaining
communication communicate written verbal interpersonal
environment culture opportunity opportunities benefit benefits salary
full part flexible remote hybrid office onsite location
degree bachelor master qualification qualified education
plus preferred desirable essential minimum
`;

/**
 * Still common, but beginning to say something. Weighted low rather than
 * zero — a posting that stresses "stakeholder" and "cross-functional" is
 * describing a different job from one that does not.
 */
const COMMON = `
collaborate collaboration collaborative stakeholder stakeholders
crossfunctional partner partners partnership
improve improving improvement optimise optimize optimising optimizing
drive driving deliverables execution executing
analyse analyze analysis analytical data insight insights
strategy strategic plan planning roadmap
quality testing test tested reliability performance scale scalable
document documentation report reporting
agile scrum sprint iteration
mentor mentoring coach coaching train training
budget cost revenue growth
research problem solving solution solutions
`;

function toSet(block: string): ReadonlySet<string> {
  return new Set(block.trim().split(/\s+/).filter(Boolean));
}

export const COMMON_WORD_TIERS: ReadonlyMap<string, CommonWordTier> = (() => {
  const map = new Map<string, CommonWordTier>();
  // Assigned most-common first; an earlier tier wins, so a word listed twice
  // by mistake resolves to the lower weight rather than silently to whichever
  // block happened to be last.
  for (const word of toSet(UBIQUITOUS)) map.set(word, "ubiquitous");
  for (const word of toSet(VERY_COMMON)) if (!map.has(word)) map.set(word, "veryCommon");
  for (const word of toSet(COMMON)) if (!map.has(word)) map.set(word, "common");
  return map;
})();
