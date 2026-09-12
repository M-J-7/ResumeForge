/**
 * The composer (P28-I3).
 *
 * **D8 — deterministic composition.** Every sentence in a composed letter is either the
 * user's own text, copied without alteration, or a template from
 * `./phrasing.ts` that contains no claim. There is no third source. That is
 * the product position and it is also the only reason a generated cover
 * letter is defensible at all: the failure mode of every LLM cover letter
 * tool is a fluent paragraph asserting something the candidate never said.
 *
 * ## Four guarantees, each with a test
 *
 * 1. **Pure and deterministic.** No `Date.now()`, no `Math.random()`, no
 *    `Intl` (whose output varies with the runtime's ICU build). Paragraph ids
 *    are the roles themselves, so the same input yields a byte-identical
 *    document. `dateISO: null` — "stamp today at export" — is why the date
 *    does not break this.
 * 2. **Evidence is verbatim.** A sentence in the evidence paragraph contains
 *    a resume bullet altered in exactly two documented ways: its first
 *    character may be lowercased, and a sentence-final period may be
 *    appended. Nothing else. Both are reversible, which is how the test
 *    checks it — it undoes them and searches the resume for the result.
 * 3. **No undemonstrated claim.** The alignment paragraph names only skills
 *    whose `status` is `demonstrated`. A skill that is merely listed in the
 *    resume's Skills section never appears in the letter, because the letter
 *    would then be asserting experience the resume does not show.
 * 4. **Gaps are visible, never filled.** Composing against an empty resume
 *    produces a scaffold with bracketed prompts, not invented content.
 *
 * ## Why `ParsedJd` is not an argument
 *
 * The plan's sketch passes both the parsed posting and the `MatchResult`.
 * `MatchResult` is derived from that exact posting and already carries
 * everything the composer needs from it — the ranked requirements, the
 * section each was asked under, and a verbatim quote. Taking both would
 * create a pair that can silently disagree (a match computed against one
 * posting, rendered beside another), and there is nothing the second argument
 * would be used for. One source of truth about the posting.
 */

import type { MatchResult } from "@/lib/match/score";
import type { ResumeDocument } from "@/lib/resume/schema";
import { findEntry } from "./provenance";
import {
  ALIGNMENT_FRAME,
  ALIGNMENT_LISTED_FRAME,
  ALIGNMENT_LISTED_ONLY_FRAME,
  AVAILABILITY_FRAME,
  CLOSING,
  EVIDENCE_CONNECTORS,
  EVIDENCE_FRAME,
  DIAGNOSTIC_NO_BULLETS,
  DIAGNOSTIC_NO_REQUIREMENT_MATCHED,
  DIAGNOSTIC_POSTING_UNRECOGNISED,
  diagnosticSkillsListOnly,
  EVIDENCE_WITHOUT_BULLETS,
  fill,
  joinList,
  OPENING_ANGLE,
  OPENING_LEAD,
  OPENING_WITHOUT_ROLE,
  type Angle,
  type Tone,
} from "./phrasing";
import {
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  CURRENT_COVER_LETTER_SCHEMA_VERSION,
  EMPTY_RECIPIENT,
  type CoverLetterDocument,
  type CoverLetterParagraph,
  type CoverLetterRecipient,
  type ParagraphRole,
} from "./schema";

/** How many resume bullets the evidence paragraph draws on. */
export const EVIDENCE_BULLET_COUNT = 2;

/** How many demonstrated skills the alignment paragraph names. */
export const ALIGNMENT_SKILL_COUNT = 3;

export interface ComposeInput {
  resume: ResumeDocument;
  /** From P26. The single source of truth about the posting. */
  match: MatchResult;
  company: string;
  roleTitle: string;
  tone: Tone;
  angle: Angle;
  /** The user's own words about when they can start. Inserted verbatim. */
  availability?: string;
  recipient?: Partial<CoverLetterRecipient>;
  salutation?: string;
  signOff?: string;
}

/* -------------------------------------------------------------------------- */
/* Reading the resume                                                          */
/* -------------------------------------------------------------------------- */

interface CurrentRole {
  title: string;
  organization: string;
  entryId: string;
}

/**
 * The user's most recent role, or null.
 *
 * "First experience entry with a title" rather than a date comparison: the
 * builder's Experience step is explicitly reverse-chronological and the
 * document order is what the reader of the resume sees. Sorting by date here
 * would let the letter name a role the resume lists third.
 */
function currentRole(resume: ResumeDocument): CurrentRole | null {
  for (const section of resume.sections) {
    if (section.type !== "experience" || !section.visible) continue;
    for (const entry of section.entries) {
      const title = entry.title.trim();
      if (title) {
        return { title, organization: entry.organization.trim(), entryId: entry.id };
      }
    }
  }
  return null;
}

/**
 * Where an entry id sits, so an evidence sentence can name the employer.
 *
 * Built on `findEntry` from `./provenance.ts` rather than walking the resume
 * again, so the attribution written *into* a sentence and the source label
 * shown *beside* it can never name different entries (§10.2, 2.1).
 *
 * That shared traversal is also what fixed the custom-section case.
 * `evidence.ts` tags a **custom** section's bullets as `projectBullet`,
 * deliberately — a custom section is where volunteering, publications and
 * open source land, and those are demonstrations rather than lists — so they
 * can be selected. This function searched experience and projects only, and a
 * selected custom bullet fell through to the bare `"I …"` frame with the
 * user's own attribution silently dropped.
 */
function organizationForEntry(resume: ResumeDocument, entryId: string | undefined): string {
  if (!entryId) return "";
  const entry = findEntry(resume, entryId);
  if (!entry) return "";

  switch (entry.kind) {
    case "experience":
      return entry.organization;
    // A project's "organization" is its name — "At Wayfinder, I …" reads
    // correctly for a project as well as for an employer.
    case "projects":
      return entry.name;
    // Title first: a custom entry's title is the specific thing ("RFC 9114
    // review", "Trustee, Camden Foodbank") and the subtitle is usually the
    // period or the place. Either is the user's own text; neither is
    // invented, which is the only property that matters here.
    case "custom":
      return entry.name || entry.organization;
    default:
      return entry.organization || entry.name;
  }
}

/* -------------------------------------------------------------------------- */
/* The two documented transformations                                          */
/* -------------------------------------------------------------------------- */

/**
 * True when the bullet's first word is an ordinary capitalised word.
 *
 * `"Led a team"` qualifies; `"AWS migration"` and `"40 services"` do not.
 * Lowercasing an acronym would corrupt it, and "At Acme, I 40 services" is
 * not a sentence — both fall through to the colon form instead.
 */
export function startsWithCapitalisedWord(bullet: string): boolean {
  const word = bullet.trim().split(/\s+/)[0] ?? "";
  if (word.length < 2) return false;
  const [first, ...rest] = word;
  if (!first || !/\p{Lu}/u.test(first)) return false;
  const tail = rest.join("");
  // An all-caps or mixed-caps word is an acronym or a product name, not a verb.
  return tail === tail.toLowerCase();
}

/** Transformation 1 — documented, reversible, and the only case change made. */
export function lowercaseLead(bullet: string): string {
  const trimmed = bullet.trim();
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** Transformation 2 — a sentence-final period, only where there is none. */
export function terminate(sentence: string): string {
  const trimmed = sentence.trimEnd();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Lowercases a sentence that has been demoted to a clause by a connector.
 *
 * "More recently, At Acme, I…" is wrong; so is "More recently, i led…" and
 * "More recently, aWS migration…". Three cases, one rule: lowercase the lead
 * only where it is an ordinary capitalised word, which excludes the pronoun
 * "I" (one letter, so `startsWithCapitalisedWord` rejects it) and every
 * acronym. This touches the *frame*, never the bullet inside it.
 */
function demoteToClause(sentence: string): string {
  return startsWithCapitalisedWord(sentence) ? lowercaseLead(sentence) : sentence;
}

/* -------------------------------------------------------------------------- */
/* Evidence selection                                                          */
/* -------------------------------------------------------------------------- */

export interface EvidenceChoice {
  /** The resume bullet, exactly as the user wrote it. */
  bullet: string;
  organization: string;
  /** The entry it belongs to — recorded as the paragraph's source. */
  entryId?: string;
  /**
   * True when the posting is why this bullet was chosen.
   *
   * False means it is a top-up: a strong bullet quoted because the posting
   * matched nothing, not because it answers anything. The paragraph reads the
   * same either way — both are the user's own sentences — but the difference
   * is what `composeDiagnostics` reports, and it must not be inferred later
   * from the text.
   */
  matched: boolean;
}

/**
 * The strongest bullets the posting gives a reason to mention.
 *
 * Ranked by `jdWeight`, so the bullet that answers the requirement the
 * posting leans on hardest leads the paragraph. Only real demonstrations
 * qualify: a `skillsList` hit is a comma-separated fragment, not a sentence,
 * and quoting one would produce "At Acme, I kubernetes."
 */
export function selectEvidence(
  resume: ResumeDocument,
  match: MatchResult,
  limit = EVIDENCE_BULLET_COUNT,
): EvidenceChoice[] {
  const ranked = [...match.keywords].sort((a, b) => b.jdWeight - a.jdWeight);
  const chosen: EvidenceChoice[] = [];
  const seen = new Set<string>();

  const take = (bullet: string, entryId: string | undefined, matched: boolean): void => {
    const text = bullet.trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    chosen.push({
      bullet: text,
      organization: organizationForEntry(resume, entryId),
      entryId,
      matched,
    });
  };

  for (const keyword of ranked) {
    if (chosen.length >= limit) break;
    for (const evidence of keyword.resumeEvidence) {
      if (chosen.length >= limit) break;
      if (evidence.kind !== "experienceBullet" && evidence.kind !== "projectBullet") continue;
      take(evidence.text, evidence.entryId, true);
    }
  }

  /*
   * ## Topping up with bullets the posting did not match (the §12 gap)
   *
   * A requirement counts as matched only when a bullet names a term the skill
   * vocabulary knows, and that is a narrow gate: measured across the ten
   * example resumes in `docs/QA.md` §11, exactly two bullets anywhere pass it.
   * Everywhere else this function returned nothing and the letter got a
   * bracketed placeholder where its evidence should be — for a resume full of
   * perfectly good bullets, written the way this product tells people to write
   * them.
   *
   * A letter quoting the candidate's strongest work is better than a letter
   * quoting an error message, and it is not less honest: the evidence
   * paragraph's contract is "these sentences are verbatim from the resume, and
   * here are the entries they came from". It never claimed they answered the
   * posting — that is the alignment paragraph's job, and the alignment
   * paragraph still refuses to say anything the match engine did not support.
   *
   * What the user loses is the *knowledge* that the tailoring did not happen,
   * so that moves to `composeDiagnostics` and is shown beside the letter.
   * Matched bullets always come first, so a partial match still leads with the
   * part that matched.
   */
  if (chosen.length < limit) {
    for (const bullet of quotableBullets(resume)) {
      if (chosen.length >= limit) break;
      take(bullet.text, bullet.entryId, false);
    }
  }

  return chosen;
}

/**
 * The skills the resume *lists* but no bullet shows, strongest first.
 *
 * Deliberately excludes anything already selected as demonstrated: a skill
 * named in both sentences would read as two separate claims about the same
 * thing, and the weaker one would undercut the stronger. Asserted by a test.
 */
export function selectListedSkills(match: MatchResult, limit = ALIGNMENT_SKILL_COUNT): string[] {
  const demonstrated = new Set(selectAlignmentSkills(match, limit));
  return [...match.keywords]
    .filter((keyword) => keyword.status === "listed-only")
    .filter((keyword) => !demonstrated.has(keyword.skill.canonical))
    .sort((a, b) => b.jdWeight - a.jdWeight)
    .slice(0, limit)
    .map((keyword) => keyword.skill.canonical);
}

/** The demonstrated skills worth naming, strongest first, in correct casing. */
export function selectAlignmentSkills(match: MatchResult, limit = ALIGNMENT_SKILL_COUNT): string[] {
  return (
    [...match.keywords]
      .filter((keyword) => keyword.status === "demonstrated")
      .sort((a, b) => b.jdWeight - a.jdWeight)
      .slice(0, limit)
      // `canonical` rather than the matched text, so casing is the taxonomy's:
      // "Kubernetes", never "kubernetes" or "KUBERNETES".
      .map((keyword) => keyword.skill.canonical)
  );
}

/* -------------------------------------------------------------------------- */
/* Paragraph builders                                                          */
/* -------------------------------------------------------------------------- */

function buildOpening(input: ComposeInput): CoverLetterParagraph {
  const { tone, angle } = input;
  const company = input.company.trim();
  const role = input.roleTitle.trim();

  const leads = OPENING_LEAD[tone];
  const template =
    company && role
      ? leads.full
      : role
        ? leads.withoutCompany
        : company
          ? leads.withoutRole
          : leads.neither;

  const sentences = [fill(template, { role, company })];

  const held = currentRole(input.resume);
  const sources: string[] = [];
  if (held) {
    const angleTemplate = OPENING_ANGLE[angle][tone];
    sentences.push(
      fill(held.organization ? angleTemplate.full : angleTemplate.withoutOrganization, {
        title: held.title,
        organization: held.organization,
      }),
    );
    sources.push(held.entryId);
  } else {
    sentences.push(OPENING_WITHOUT_ROLE);
  }

  return {
    id: "opening",
    role: "opening",
    text: sentences.filter(Boolean).join(" "),
    sources,
  };
}

/**
 * Every bullet the evidence paragraph could quote, in document order.
 *
 * Pure, and it reads the same sections `selectEvidence` accepts a bullet from
 * — experience, projects and custom, the three `evidence.ts` tags as
 * `experienceBullet` or `projectBullet`. Education bullets are excluded for
 * the same reason `selectEvidence` skips them.
 *
 * Document order is the ranking, and it is the right one: a resume is written
 * most-recent-first, and the top of it is what its author wants read first.
 * There is no better signal available once the posting has stopped supplying
 * one — and inventing a cleverer ranking here would be this module guessing at
 * relevance, which is precisely what it does not do.
 */
function quotableBullets(resume: ResumeDocument): { text: string; entryId: string }[] {
  const bullets: { text: string; entryId: string }[] = [];
  for (const section of resume.sections) {
    if (!section.visible) continue;
    if (section.type !== "experience" && section.type !== "projects" && section.type !== "custom") {
      continue;
    }
    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (bullet.trim()) bullets.push({ text: bullet, entryId: entry.id });
      }
    }
  }
  return bullets;
}

function buildEvidence(input: ComposeInput): CoverLetterParagraph {
  const chosen = selectEvidence(input.resume, input.match);
  if (chosen.length === 0) {
    /*
     * One reason left, and it is the only one that was ever about the letter.
     *
     * There used to be three (§10.2, 2.2): no bullets, no match, and an
     * unrecognised posting. `selectEvidence` now falls back to the resume's
     * own bullets, so the middle two cannot empty this paragraph any more —
     * they produce a letter *and* a diagnostic. What is left is a resume with
     * nothing to quote, where there is genuinely no sentence to write and
     * "add a bullet" is the right and only advice.
     */
    return { id: "evidence", role: "evidence", text: EVIDENCE_WITHOUT_BULLETS, sources: [] };
  }

  const frames = EVIDENCE_FRAME[input.tone];
  const connectors = EVIDENCE_CONNECTORS[input.tone];

  const sentences = chosen.map((choice, index) => {
    const usable = startsWithCapitalisedWord(choice.bullet);
    /**
     * Naming the same employer twice in consecutive sentences reads as a
     * template filling a slot, which is exactly the impression this whole
     * module exists to avoid. Two bullets from one role are one story, so
     * the second one drops the lead-in and simply continues.
     */
    const repeatsOrganization =
      index > 0 && chosen[index - 1]?.organization === choice.organization;

    let sentence: string;
    if (choice.organization && !repeatsOrganization && usable) {
      sentence = fill(frames.atOrganization, {
        organization: choice.organization,
        bullet: lowercaseLead(choice.bullet),
      });
    } else if (choice.organization && !repeatsOrganization) {
      sentence = fill(frames.colonForm, {
        organization: choice.organization,
        bullet: choice.bullet,
      });
    } else if (usable) {
      sentence = fill(frames.bare, { bullet: lowercaseLead(choice.bullet) });
    } else {
      // No employer to attach it to and no safe lead-in: the bullet stands
      // on its own, still untouched.
      sentence = choice.bullet;
    }

    sentence = terminate(sentence);

    // Indexed, never random — the composer is pure. Index 0 is the second
    // sentence, because the first needs no connective.
    if (index === 0) return sentence;
    const connector = connectors[(index - 1) % connectors.length] ?? "";
    return connector ? `${connector}${demoteToClause(sentence)}` : sentence;
  });

  return {
    id: "evidence",
    role: "evidence",
    text: sentences.join(" "),
    sources: chosen.map((choice) => choice.entryId).filter((id): id is string => Boolean(id)),
  };
}

/** Returns null when there is nothing demonstrated to align — a gap, not a claim. */
/**
 * The entries behind the skills the alignment paragraph names (§10.2, 2.1).
 *
 * A skill reaches that paragraph only when its `status` is `demonstrated`,
 * which by definition means a bullet in the resume shows it. So the sources
 * are not an approximation — they are the specific entries that earned the
 * skill its place in the sentence, and the reader can be shown them.
 *
 * Order follows the skills, so the chips read in the same order as the
 * sentence. Deduplicated, because three skills demonstrated at one job is one
 * source to a reader.
 */
function alignmentSources(
  input: ComposeInput,
  skills: readonly string[],
  listed: readonly string[] = [],
): string[] {
  const named = new Set(skills);
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    for (const keyword of input.match.keywords) {
      if (keyword.status !== "demonstrated") continue;
      if (keyword.skill.canonical !== skill || !named.has(keyword.skill.canonical)) continue;
      for (const evidence of keyword.resumeEvidence) {
        // Only bullets. An `entryHeading` match means the skill appears in a
        // job title, and a `skillsList` match belongs to the listed sentence
        // below rather than to this one.
        if (evidence.kind !== "experienceBullet" && evidence.kind !== "projectBullet") continue;
        const id = evidence.entryId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }

  /*
   * The skills groups behind the listed sentence.
   *
   * `resumeFragments` tags a skills-group entry with the *group* id, so these
   * resolve to "Languages" or "Infrastructure" rather than to a job — which
   * is exactly the provenance a reader should see. Opening the Sources
   * disclosure on this paragraph then answers the question that matters: did
   * this come from my work, or from my skills list?
   */
  const listedNames = new Set(listed);
  for (const skill of listed) {
    for (const keyword of input.match.keywords) {
      if (keyword.status !== "listed-only") continue;
      if (keyword.skill.canonical !== skill || !listedNames.has(keyword.skill.canonical)) continue;
      for (const evidence of keyword.resumeEvidence) {
        if (evidence.kind !== "skillsList") continue;
        const id = evidence.entryId;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return ids;
}

function buildAlignment(input: ComposeInput): CoverLetterParagraph | null {
  const skills = selectAlignmentSkills(input.match);
  const listed = selectListedSkills(input.match);
  if (skills.length === 0 && listed.length === 0) return null;

  /*
   * Two sentences at most, and never one clause.
   *
   * The demonstrated sentence says the work above shows these skills. The
   * listed sentence says the candidate has worked with these others — the
   * claim their resume already makes, no stronger. Keeping them as separate
   * sentences with separate frames is what stops a reader taking the second
   * for the first, and it is the whole reason a listed skill is allowed in
   * the letter at all. See `ALIGNMENT_LISTED_FRAME`.
   */
  const sentences: string[] = [];

  if (skills.length > 0) {
    const frame = ALIGNMENT_FRAME[input.tone];
    sentences.push(
      fill(skills.length === 1 ? frame.one : frame.many, { skills: joinList(skills) }),
    );
  }

  if (listed.length > 0) {
    // "You *also* ask for" only makes sense after the demonstrated sentence.
    const frame =
      skills.length > 0
        ? ALIGNMENT_LISTED_FRAME[input.tone]
        : ALIGNMENT_LISTED_ONLY_FRAME[input.tone];
    sentences.push(
      fill(listed.length === 1 ? frame.one : frame.many, { skills: joinList(listed) }),
    );
  }

  return {
    id: "alignment",
    role: "alignment",
    text: sentences.join(" "),
    // This used to be `[]`, which made the one paragraph that most *looks*
    // like an assertion the only one carrying no provenance at all.
    sources: alignmentSources(input, skills, listed),
  };
}

function buildClosing(input: ComposeInput): CoverLetterParagraph {
  const sentences: string[] = [];

  const availability = input.availability?.trim();
  // The user's words first, then ours. Their sentence is the one carrying
  // information; the closing is punctuation on the letter.
  if (availability) {
    sentences.push(terminate(fill(AVAILABILITY_FRAME[input.tone], { availability })));
  }
  sentences.push(CLOSING[input.tone]);

  return { id: "closing", role: "closing", text: sentences.join(" "), sources: [] };
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rebuilds one paragraph, for the UI's per-paragraph Recompose.
 *
 * `custom` returns null: a paragraph the user wrote has no composed form to
 * regenerate, and quietly replacing it with a template would destroy their
 * writing. The UI hides Recompose on those.
 */
export function composeParagraph(
  role: ParagraphRole,
  input: ComposeInput,
): CoverLetterParagraph | null {
  switch (role) {
    case "opening":
      return buildOpening(input);
    case "evidence":
      return buildEvidence(input);
    case "alignment":
      return buildAlignment(input);
    case "closing":
      return buildClosing(input);
    case "custom":
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Diagnostics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Something the user should know about the letter, which is not in the letter.
 *
 * ## Why this is separate from the document
 *
 * "Your resume has bullets, but none of them matched this posting" is advice.
 * It used to be the evidence *paragraph*, which meant the only way the product
 * could tell somebody their tailoring had failed was to put a bracketed
 * message where their letter should be — and then rely on them not sending
 * it. That is a warning wearing a document's clothes.
 *
 * Now the letter is a letter and the warning is a warning. Nothing here is
 * persisted: it is derived from the same `ComposeInput` the letter is, so it
 * cannot drift from the letter it describes, and it needs no schema version.
 */
export type ComposeDiagnosticKind =
  "posting-unrecognised" | "no-requirement-matched" | "skills-list-only" | "no-bullets";

export interface ComposeDiagnostic {
  kind: ComposeDiagnosticKind;
  /** Shown to the user verbatim. */
  message: string;
  /** True where the letter is still sendable and this is a note, not a block. */
  advisory: boolean;
}

/**
 * What is worth saying about this letter, in the order it is worth saying it.
 *
 * Pure and deterministic, like everything else in this module: the same input
 * produces the same notes, and a test asserts it.
 */
export function composeDiagnostics(input: ComposeInput): ComposeDiagnostic[] {
  const notes: ComposeDiagnostic[] = [];
  const chosen = selectEvidence(input.resume, input.match);

  if (chosen.length === 0) {
    notes.push({ kind: "no-bullets", message: DIAGNOSTIC_NO_BULLETS, advisory: false });
    return notes;
  }

  if (!chosen.some((choice) => choice.matched)) {
    /*
     * Whose problem it is decides which of the two is shown, and the
     * distinction is worth keeping: `unmatchedJd` means our vocabulary did not
     * recognise the posting, which is a statement about us and never about
     * the candidate's resume.
     */
    notes.push(
      input.match.unmatchedJd
        ? {
            kind: "posting-unrecognised",
            message: DIAGNOSTIC_POSTING_UNRECOGNISED,
            advisory: true,
          }
        : {
            kind: "no-requirement-matched",
            message: DIAGNOSTIC_NO_REQUIREMENT_MATCHED,
            advisory: true,
          },
    );
  }

  const listed = selectListedSkills(input.match);
  if (listed.length > 0) {
    notes.push({
      kind: "skills-list-only",
      message: diagnosticSkillsListOnly(listed),
      advisory: true,
    });
  }

  return notes;
}

export function composeCoverLetter(input: ComposeInput): CoverLetterDocument {
  const alignment = buildAlignment(input);
  const paragraphs: CoverLetterParagraph[] = [
    buildOpening(input),
    buildEvidence(input),
    ...(alignment ? [alignment] : []),
    buildClosing(input),
  ];

  return {
    schemaVersion: CURRENT_COVER_LETTER_SCHEMA_VERSION,
    // The letter's own contact block is the resume's, so the two documents
    // agree on how to reach the candidate. There is no second place to keep
    // an address up to date.
    contact: input.resume.contact,
    recipient: {
      ...EMPTY_RECIPIENT,
      company: input.company.trim(),
      ...input.recipient,
    },
    // Stamped at export, not here — see the purity note in the header.
    dateISO: null,
    salutation: input.salutation ?? DEFAULT_SALUTATION,
    paragraphs,
    signOff: input.signOff ?? DEFAULT_SIGN_OFF,
    // Same settings as the resume, so the pair looks like one application.
    settings: input.resume.settings,
  };
}
