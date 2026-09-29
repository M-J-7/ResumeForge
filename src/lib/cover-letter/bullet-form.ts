/**
 * What shape is this resume bullet, grammatically?
 *
 * ## The bug this module exists to kill
 *
 * The composer splices a resume bullet into `"At {org}, I {bullet}"`. Whether
 * that produces a sentence or gibberish depends entirely on what the bullet
 * *starts with* — and until this module existed, the only test applied was
 * `startsWithCapitalisedWord`, which asks "capital letter, rest lowercase?".
 * That is a question about **casing**. The frame asks a question about
 * **syntax**. The gap between the two shipped sentences like these:
 *
 * - `Responsible for the regional ledger` → "At Acme, I responsible for …"
 * - `Managing a team of six across two sites` → "At Acme, I managing a team …"
 * - `Open dataset and notebook series on high-street footfall` →
 *   "At uk-retail-footfall, I open dataset and notebook series …"
 *
 * The third is not hypothetical: it is our own shipped example resume
 * (`src/lib/examples/roles.ts`, the data-analyst project bullet).
 *
 * ## What this module does not do
 *
 * It does not rewrite the bullet. It cannot: `compose.test.ts` proves
 * verbatimness by *inverting* the two documented transformations
 * (`lowercaseLead`, `terminate`) and searching the resume for the result, so
 * any third transformation would be a lie the test would catch. This module
 * only ever *classifies*, and the composer picks a frame that is grammatical
 * for the class. The bullet is untouched.
 *
 * ## Fail safe, and in a specific direction
 *
 * Every unrecognised shape falls through to `nounPhrase`, whose frame is the
 * colon form — `"At Acme: <anything at all>"` — which is well-formed no matter
 * what follows it. So a misclassification costs a slightly flat sentence,
 * never a broken one. That asymmetry is deliberate and it is why the ordering
 * of the checks below matters: each one must be *confident*, and anything less
 * than confident is left to fall through.
 */

import { startsWithCapitalisedWord } from "./bullet-case";

export type BulletForm =
  /** Leads with a finite past-tense verb: "Cut deploy time…". The `I` frame. */
  | "pastVerb"
  /** Leads with a duty phrase that needs a copula: "Responsible for…". */
  | "dutyPhrase"
  /** Leads with a gerund: "Managing a team…". Needs a frame that takes one. */
  | "gerund"
  /** Carries its own subject: "My team shipped…". Takes no "I". */
  | "ownSubject"
  /** A bare noun phrase: "Open dataset and notebook series…". */
  | "nounPhrase"
  /** An acronym, a digit, or a single letter — the lead cannot be lowercased. */
  | "unsafeLead";

/**
 * Past-tense verbs that open resume bullets, written out rather than derived.
 *
 * Derivation was tried and abandoned. English past tense is irregular exactly
 * where resume writing is densest — led, built, ran, wrote, spoke, rebuilt,
 * oversaw, cut — so a `-ed` rule alone misses the strongest verbs in the
 * vocabulary and a stemmer would need the same list to check its own output
 * against. Writing it out is honest about what it is: a lexicon, readable in
 * one screen, extended by adding a word.
 *
 * `-ed` still has a rule below, as a *fallback* for the regular verbs that are
 * not here. This list is what makes the irregulars work.
 */
const PAST_TENSE_VERBS = new Set([
  // Building and shipping
  "built",
  "rebuilt",
  "shipped",
  "launched",
  "delivered",
  "released",
  "deployed",
  "created",
  "designed",
  "developed",
  "engineered",
  "architected",
  "implemented",
  "wrote",
  "rewrote",
  "authored",
  "coded",
  "prototyped",
  "produced",
  // Change and improvement
  "cut",
  "reduced",
  "lowered",
  "shortened",
  "accelerated",
  "streamlined",
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
  "optimised",
  "optimized",
  "refactored",
  "modernised",
  "modernized",
  "migrated",
  "consolidated",
  "automated",
  "simplified",
  "standardised",
  "standardized",
  "replaced",
  "upgraded",
  "rescued",
  "turned",
  "transformed",
  // Leading and owning
  "led",
  "managed",
  "owned",
  "ran",
  "directed",
  "headed",
  "oversaw",
  "supervised",
  "coordinated",
  "chaired",
  "founded",
  "established",
  "drove",
  "spearheaded",
  "pioneered",
  "championed",
  "mentored",
  "coached",
  "trained",
  "taught",
  "hired",
  "recruited",
  "onboarded",
  "promoted",
  // Analysis and communication
  "analysed",
  "analyzed",
  "researched",
  "investigated",
  "diagnosed",
  "audited",
  "measured",
  "modelled",
  "modeled",
  "forecast",
  "forecasted",
  "reported",
  "presented",
  "briefed",
  "advised",
  "recommended",
  "negotiated",
  "persuaded",
  "published",
  "documented",
  "translated",
  // Operating
  "maintained",
  "monitored",
  "operated",
  "administered",
  "configured",
  "resolved",
  "fixed",
  "debugged",
  "troubleshot",
  "restored",
  "scaled",
  "secured",
  "tested",
  "validated",
  "verified",
  "reviewed",
  "approved",
  "processed",
  "handled",
  "served",
  "supported",
  "staffed",
  "scheduled",
  "planned",
  "organised",
  "organized",
  "executed",
  "completed",
  "achieved",
  "won",
  "retained",
  "closed",
  "sold",
  "generated",
  "raised",
  // Collaboration — weak openers, but grammatical ones
  "worked",
  "helped",
  "assisted",
  "partnered",
  "collaborated",
  "contributed",
  "participated",
  "volunteered",
  "liaised",
]);

/**
 * Gerunds that open resume bullets.
 *
 * A separate list rather than `PAST_TENSE_VERBS` with the suffix swapped,
 * for the same reason the past list is written out: "led" → "leading" and
 * "cut" → "cutting" are not one rule, and generating them would need the
 * doubling and silent-`e` rules to be right on every entry to avoid emitting
 * "cuting" or "managing" → "manageing" into a *classifier*, where a wrong
 * answer is a wrong sentence.
 *
 * Words that are as often nouns as gerunds are deliberately **absent** —
 * "engineering", "planning", "training", "reporting", "testing". "Engineering
 * team of six across two sites" is a noun phrase, and calling it a verb
 * produces "my work included engineering team of six". The fail-safe direction
 * settles every such case: a real gerund left out of this list still reads
 * correctly in the colon form, so when a word is ambiguous it stays out.
 *
 * Shorter than the past list on purpose. A gerund-led bullet is uncommon and
 * the frame it selects is a safe one, so coverage matters less here than in
 * `PAST_TENSE_VERBS`, where a miss routes a good verb to the colon form.
 */
const GERUND_VERBS = new Set([
  "rebuilding",
  "shipping",
  "launching",
  "delivering",
  "releasing",
  "deploying",
  "creating",
  "designing",
  "developing",
  "implementing",
  "producing",
  "cutting",
  "reducing",
  "lowering",
  "shortening",
  "accelerating",
  "streamlining",
  "increasing",
  "raising",
  "growing",
  "saving",
  "eliminating",
  "removing",
  "preventing",
  "improving",
  "optimising",
  "optimizing",
  "refactoring",
  "migrating",
  "consolidating",
  "automating",
  "simplifying",
  "replacing",
  "upgrading",
  "transforming",
  "leading",
  "managing",
  "owning",
  "directing",
  "heading",
  "overseeing",
  "supervising",
  "coordinating",
  "chairing",
  "founding",
  "establishing",
  "driving",
  "spearheading",
  "mentoring",
  "coaching",
  "hiring",
  "recruiting",
  "analysing",
  "analyzing",
  "researching",
  "investigating",
  "diagnosing",
  "measuring",
  "presenting",
  "advising",
  "recommending",
  "negotiating",
  "publishing",
  "documenting",
  "maintaining",
  "operating",
  "administering",
  "configuring",
  "resolving",
  "fixing",
  "debugging",
  "restoring",
  "scaling",
  "securing",
  "validating",
  "verifying",
  "reviewing",
  "supporting",
  "organising",
  "organizing",
  "executing",
  "completing",
  "achieving",
  "selling",
  "generating",
  "working",
  "helping",
  "assisting",
  "partnering",
  "collaborating",
  "contributing",
  "participating",
  "volunteering",
]);

/**
 * Duty phrases that need a copula — "I **was** responsible for …".
 *
 * Deliberately *not* `DUTY_PHRASES` from `src/lib/lint/rules.ts`, though the
 * two overlap and the lint list was the obvious thing to reuse. That list is
 * answering a different question — "is this bullet phrased as a job
 * description?" — and so it also contains `worked on`, `helped with` and
 * `assisted with`, which are past-tense verbs. Reusing it wholesale would
 * produce "At Acme, I was worked on the payments platform": the exact class of
 * bug this module exists to remove, reintroduced by sharing a list whose
 * meaning did not match.
 *
 * So: the copula-taking subset only, listed here, and the past-tense members
 * of the lint list are left to `PAST_TENSE_VERBS` where they belong.
 */
const COPULA_DUTY_PHRASES = [
  "responsible for",
  "accountable for",
  "in charge of",
  "tasked with",
  "part of",
  "a member of",
  "the point of contact",
  "point of contact",
];

/**
 * Duty phrases that already carry their own subject.
 *
 * "Duties included X" is a clause. "I was duties included X" is not, and
 * neither is "I duties included X" — this is why the lint list could not be
 * used as one set.
 */
const SUBJECT_DUTY_PHRASES = ["duties included", "duties involved", "responsibilities included"];

/**
 * Words ending in `-ed` that are adjectives, not verbs.
 *
 * The `-ed` fallback below is what gives regular verbs outside the lexicon a
 * chance, and it is right far more often than not. These are where it is
 * wrong: "Advanced analytics for …" and "Distributed systems work on …" are
 * noun phrases whose first word merely looks like a past tense. Short by
 * design — every entry is a word the fallback would otherwise get wrong, and
 * the cost of a miss is the colon form, not a broken sentence.
 */
const ED_ADJECTIVES = new Set([
  "advanced",
  "detailed",
  "distributed",
  "dedicated",
  "experienced",
  "skilled",
  "proven",
  "trusted",
  "qualified",
  "certified",
  "licensed",
  "licenced",
  "mixed",
  "varied",
  "limited",
  "extended",
  "combined",
  "integrated",
  "embedded",
  "applied",
  "related",
  "aged",
  "based",
  "focused",
  "focussed",
  "motivated",
  "organised",
  "organized",
  "selected",
  "specialised",
  "specialized",
]);

/** Possessives and determiners that can open a clause carrying its own subject. */
const SUBJECT_LEADS = new Set(["my", "our", "the", "this", "these", "that", "those", "their"]);

/** The opening word, stripped to letters. Mirrors `coach/parse-bullet.ts`. */
function openingWord(text: string): string {
  return (
    text
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z']/g, "") ?? ""
  );
}

/** True when the word is a past-tense verb by lexicon or by the `-ed` rule. */
function isPastTenseVerb(word: string): boolean {
  if (PAST_TENSE_VERBS.has(word)) return true;
  if (ED_ADJECTIVES.has(word)) return false;
  // The fallback that covers regular verbs the lexicon does not list.
  // `word.length > 4` keeps "used", "aged" and other short ambiguous forms out.
  return word.endsWith("ed") && word.length > 4;
}

/**
 * True when a finite verb appears early enough to make this a clause.
 *
 * This is what separates "The migration cut costs 30%" — a sentence — from
 * "The regional ledger for EMEA" — a noun phrase that happens to start with
 * the same determiner. Without it, `SUBJECT_LEADS` would route both to the
 * `ownSubject` frame and emit "At Acme, the regional ledger for EMEA." as
 * though it were a sentence.
 *
 * Four words is the window: "My team of six shipped …" reaches its verb in
 * five, but widening it starts catching verbs inside subordinate clauses,
 * where they do not make the *bullet* a clause. A miss falls through to
 * `nounPhrase` and the colon form, which reads correctly either way.
 */
function hasFiniteVerbNear(text: string, limit = 4): boolean {
  const words = text
    .trim()
    .split(/\s+/)
    .slice(1, limit + 1);
  return words.some((raw) => isPastTenseVerb(raw.toLowerCase().replace(/[^a-z']/g, "")));
}

function beginsWithPhrase(lowered: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => lowered.startsWith(phrase));
}

/**
 * Classify a bullet by what its opening does to a sentence frame.
 *
 * Order is load-bearing. Each check must be confident on its own; anything
 * unrecognised falls through to `nounPhrase`, whose frame is grammatical for
 * any input at all.
 */
export function classifyBulletForm(bullet: string): BulletForm {
  const trimmed = bullet.trim();
  if (!trimmed) return "nounPhrase";

  const lowered = trimmed.toLowerCase();

  // 1. Duty phrases, before anything else: "Responsible" would otherwise reach
  //    the `-ed` fallback and be called a verb.
  if (beginsWithPhrase(lowered, SUBJECT_DUTY_PHRASES)) return "ownSubject";
  if (beginsWithPhrase(lowered, COPULA_DUTY_PHRASES)) return "dutyPhrase";

  // 2. A lead that cannot be lowercased at all — an acronym, a number, "I".
  //    Checked early because every frame below lowercases the lead.
  if (!startsWithCapitalisedWord(trimmed)) return "unsafeLead";

  const first = openingWord(trimmed);
  if (!first) return "nounPhrase";

  // 3. Its own subject — but only where a finite verb follows soon enough to
  //    make it a clause. See `hasFiniteVerbNear`.
  if (SUBJECT_LEADS.has(first)) {
    return hasFiniteVerbNear(trimmed) ? "ownSubject" : "nounPhrase";
  }

  // 4. Gerund by lexicon. An unlisted `-ing` word is left to fall through:
  //    "Engineering team of six" is a noun phrase, and guessing it is a verb
  //    would produce "my work included engineering team of six".
  if (GERUND_VERBS.has(first)) return "gerund";

  // 5. Past-tense verb, by lexicon or by the `-ed` rule.
  if (isPastTenseVerb(first)) return "pastVerb";

  // 6. Everything else. The colon form is correct for all of it.
  return "nounPhrase";
}

/**
 * True where the form splices into a first-person sentence without a colon.
 *
 * Used by `selectEvidence` as a tiebreak: given two bullets the posting ranks
 * equally, the one that becomes prose is the better one to quote. It is only
 * ever a tiebreak — relevance is not traded for tidiness.
 */
export function readsAsProse(form: BulletForm): boolean {
  return form === "pastVerb" || form === "dutyPhrase" || form === "gerund";
}
