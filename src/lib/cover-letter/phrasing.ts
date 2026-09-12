/**
 * The phrase bank (P28-I3).
 *
 * Every string a composed letter contains that the user did not write
 * themselves is in this file. That is the whole point of it existing:
 * **D8 — no LLM, ever.** The composer assembles a letter from the user's own
 * resume text plus connective tissue from here, and "is anything invented?"
 * is answerable by reading one file.
 *
 * ## The rule every template obeys
 *
 * **No template contains a claim.** Not "I am excited about", not "I would
 * be a great fit", not "your innovative team" — we know nothing about the
 * company, and a template that asserts enthusiasm is putting words in the
 * user's mouth about their own feelings. What is left is grammar: the
 * sentence frames that join facts the user supplied.
 *
 * Templates therefore hold placeholders and connectives only. Scan the
 * literals below and you will find no adjective describing the employer, the
 * role, or the writer.
 *
 * ## Tone and angle
 *
 * `tone` changes register: how formally the same sentence is put.
 * `angle` changes emphasis: which of "results", "the field" or "the work
 * itself" the opening points at.
 *
 * Neither adds content. A `warm` letter and a `formal` letter about the same
 * resume make exactly the same claims.
 */

export const TONES = ["direct", "warm", "formal"] as const;
export const ANGLES = ["impact", "domain", "craft"] as const;

export type Tone = (typeof TONES)[number];
export type Angle = (typeof ANGLES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  direct: "Direct",
  warm: "Warm",
  formal: "Formal",
};

export const ANGLE_LABELS: Record<Angle, string> = {
  impact: "Impact",
  domain: "Domain",
  craft: "Craft",
};

export const TONE_DESCRIPTIONS: Record<Tone, string> = {
  direct: "Short sentences, no throat-clearing.",
  warm: "Plainer and a little more conversational.",
  formal: "The register a bank or a law firm expects.",
};

export const ANGLE_DESCRIPTIONS: Record<Angle, string> = {
  impact: "Points at outcomes — what the work changed.",
  domain: "Points at the field the role sits in.",
  craft: "Points at how the work is done.",
};

/* -------------------------------------------------------------------------- */
/* Opening                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The first sentence. Names the role and the company and nothing else.
 *
 * `{role}` and `{company}` are the user's own inputs. When either is blank
 * the composer uses the `withoutCompany` / `withoutRole` variants rather than
 * emitting "the role at ." — a letter with a hole in the first sentence is
 * worse than one that is slightly less specific.
 */
export const OPENING_LEAD: Record<
  Tone,
  { full: string; withoutCompany: string; withoutRole: string; neither: string }
> = {
  direct: {
    full: "I am writing about the {role} role at {company}.",
    withoutCompany: "I am writing about the {role} role.",
    withoutRole: "I am writing about the open role at {company}.",
    neither: "I am writing about the open role.",
  },
  warm: {
    full: "I am writing about the {role} role at {company}.",
    withoutCompany: "I am writing about the {role} role.",
    withoutRole: "I am writing about the role you have open at {company}.",
    neither: "I am writing about the role you have open.",
  },
  formal: {
    full: "I am writing to apply for the position of {role} at {company}.",
    withoutCompany: "I am writing to apply for the position of {role}.",
    withoutRole: "I am writing to apply for the open position at {company}.",
    neither: "I am writing to apply for the open position.",
  },
};

/**
 * The second clause of the opening, keyed by angle.
 *
 * `{title}` is the user's actual most recent job title, taken verbatim from
 * their resume; `{organization}` is where they hold it. When the resume has
 * no experience entry, the composer omits this clause entirely rather than
 * substituting something generic — see `OPENING_WITHOUT_ROLE`.
 */
export const OPENING_ANGLE: Record<
  Angle,
  Record<Tone, { full: string; withoutOrganization: string }>
> = {
  impact: {
    direct: {
      full: "I am currently {title} at {organization}; the work below is what I have to show for it.",
      withoutOrganization: "I am currently {title}; the work below is what I have to show for it.",
    },
    warm: {
      full: "I am currently {title} at {organization}, and the work below is what has come of it.",
      withoutOrganization: "I am currently {title}, and the work below is what has come of it.",
    },
    formal: {
      full: "I currently hold the position of {title} at {organization}. The work described below reflects that experience.",
      withoutOrganization:
        "I currently hold the position of {title}. The work described below reflects that experience.",
    },
  },
  domain: {
    direct: {
      full: "I have been working as {title} at {organization}, in the same field this role sits in.",
      withoutOrganization: "I have been working as {title}, in the same field this role sits in.",
    },
    warm: {
      full: "I have been working as {title} at {organization}, which sits in the same field as this role.",
      withoutOrganization:
        "I have been working as {title}, which sits in the same field as this role.",
    },
    formal: {
      full: "I currently hold the position of {title} at {organization}, within the field to which this role belongs.",
      withoutOrganization:
        "I currently hold the position of {title}, within the field to which this role belongs.",
    },
  },
  craft: {
    direct: {
      full: "I am currently {title} at {organization}. How the work gets done is the part I care about.",
      withoutOrganization:
        "I am currently {title}. How the work gets done is the part I care about.",
    },
    warm: {
      full: "I am currently {title} at {organization}, and how the work gets done is what I pay attention to.",
      withoutOrganization:
        "I am currently {title}, and how the work gets done is what I pay attention to.",
    },
    formal: {
      full: "I currently hold the position of {title} at {organization}, where my focus is the practice of the work itself.",
      withoutOrganization:
        "I currently hold the position of {title}, where my focus is the practice of the work itself.",
    },
  },
};

/**
 * Used when the resume has no experience entries to name.
 *
 * A gap left visible rather than filled. Composing against an empty resume
 * must yield a scaffold with explicit gaps, never invented content — the
 * bracketed text is a prompt to the user, and it is deliberately conspicuous
 * so it cannot be sent by accident.
 */
export const OPENING_WITHOUT_ROLE =
  "[Add your current or most recent role in the Experience step — this sentence will fill in from it.]";

/**
 * The greeting when the user has typed a name (§10.2, 2.3).
 *
 * `{name}` is filled with **exactly** what they typed and nothing else. No
 * honorific is ever added: "Mr.", "Ms." and "Dr." are all facts about a
 * person, and a product whose entire position is that it invents nothing has
 * no business guessing at any of them from a name. Anyone who wants one types
 * it into the field themselves.
 */
export const SALUTATION_WITH_NAME = "Dear {name},";

/* -------------------------------------------------------------------------- */
/* Evidence                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The frame around a resume bullet.
 *
 * `{bullet}` is inserted **verbatim**, with at most its first character
 * lowercased — a transformation documented in `compose.ts` and asserted by a
 * test that searches the source resume for every sentence produced here.
 *
 * `atOrganization` is used when the bullet's entry names an employer, so the
 * claim stays attached to where it happened. `bare` is the fallback.
 * `colonForm` handles a bullet that does not begin with a word the lowercase
 * rule can safely touch — a number, an acronym, a proper noun — where
 * "At Acme, I 40 services…" would be gibberish.
 */
export const EVIDENCE_FRAME: Record<
  Tone,
  { atOrganization: string; bare: string; colonForm: string }
> = {
  direct: {
    atOrganization: "At {organization}, I {bullet}",
    bare: "I {bullet}",
    colonForm: "At {organization}: {bullet}",
  },
  warm: {
    atOrganization: "At {organization}, I {bullet}",
    bare: "I {bullet}",
    colonForm: "At {organization}: {bullet}",
  },
  formal: {
    atOrganization: "During my time at {organization}, I {bullet}",
    bare: "I {bullet}",
    colonForm: "During my time at {organization}: {bullet}",
  },
};

/**
 * Joins the second piece of evidence to the first.
 *
 * A fixed list indexed by position, never chosen at random — the composer is
 * pure, and a random connective would make the same inputs produce different
 * letters. Index 0 is used for the second sentence, index 1 for a third, and
 * so on; the list is longer than the composer currently needs so adding a
 * fourth evidence sentence later does not require touching this file.
 */
export const EVIDENCE_CONNECTORS: Record<Tone, readonly string[]> = {
  direct: ["More recently, ", "Separately, ", "Also, "],
  warm: ["More recently, ", "Alongside that, ", "And ", "Separately, "],
  formal: ["Furthermore, ", "In addition, ", "Likewise, "],
};

/**
 * Shown in place of the evidence paragraph when nothing could be quoted.
 *
 * Three constants, not one (§10.2, 2.2). There are three reasons the evidence
 * paragraph can come up empty, and they call for three different actions from
 * the user — but all three used to produce the "add a bullet" text, which
 * blames the resume for what is very often a problem with the posting. Being
 * wrong about whose fault it is, in a message telling somebody their resume is
 * inadequate, is worse than saying less.
 *
 * All three keep the conspicuous bracketed style: they are prompts to the
 * user, and they must be impossible to send by accident.
 *
 * ## Two of the three are no longer paragraphs
 *
 * Since the §12 gap fix, "the posting matched nothing" and "the posting was
 * not recognised" do not empty the paragraph — the letter quotes the
 * candidate's strongest bullets instead, which is a better letter than a
 * bracket and claims nothing about the posting. What those two cases produce
 * now is a **diagnostic** (`composeDiagnostics`), shown beside the letter
 * rather than inside it, because "your posting and your resume use different
 * words" is advice to the user and was never a sentence to send an employer.
 *
 * They are still exported and still tested for conspicuousness: they are the
 * text of those diagnostics, and `EVIDENCE_WITHOUT_BULLETS` is still a
 * paragraph, because a letter with no bullets to quote genuinely has nothing
 * to put there.
 */
export const EVIDENCE_WITHOUT_BULLETS =
  "[Add a bullet or two to your Experience or Projects steps. This paragraph is assembled from them — it is never written for you.]";

/**
 * The resume has bullets; the posting matched none of them.
 *
 * The honest reading is usually that the two describe the same work in
 * different words, not that the work is missing. Says what to do about it
 * without conceding a claim about the candidate.
 */
export const EVIDENCE_WITHOUT_MATCH =
  "[Your resume has bullets, but none of them matched this posting. Check the Match tab for the wording it looked for — or paste a posting that describes this role more fully.]";

/**
 * The same situation, said as a note beside a letter that now exists (§12).
 *
 * Not bracketed, because it is not a paragraph and cannot be sent by
 * accident. It is also not an apology: the usual reason a resume and a
 * posting fail to meet is that they describe the same work in different
 * words, and saying so is more useful than implying the resume is thin.
 */
export const DIAGNOSTIC_NO_REQUIREMENT_MATCHED =
  "None of your bullets matched this posting, so the letter quotes your strongest ones instead. " +
  "Usually the two describe the same work in different words — the Match tab shows the wording " +
  "it looked for.";

/**
 * Nothing in the posting was recognised at all.
 *
 * `match.unmatchedJd` is already computed for exactly this. This is a
 * statement about the posting and about our vocabulary, and it must not be
 * dressed up as a statement about the resume.
 */
export const EVIDENCE_WITHOUT_POSTING =
  "[Nothing in that posting was recognised, so there was nothing to match your bullets against. That is about the posting and our vocabulary, not about your resume — try a fuller posting, or write this paragraph yourself.]";

/** The same, as a note (§12). Still a statement about us, never about them. */
export const DIAGNOSTIC_POSTING_UNRECOGNISED =
  "Nothing in that posting was recognised, so the letter quotes your strongest bullets rather " +
  "than the ones that answer it. That is about the posting and our vocabulary, not about your " +
  "resume — try a fuller posting, or edit the paragraph.";

/** A resume with nothing to quote. The one case that is still a paragraph. */
export const DIAGNOSTIC_NO_BULLETS =
  "This letter has no evidence paragraph because the resume has no bullets to quote. Add a " +
  "bullet or two to Experience or Projects and recompose.";

/**
 * Says which skills the letter leaned on the skills list for, and what fixes it.
 *
 * A function because it names them, and naming them is the point: "some of
 * your skills" would leave the user hunting. The advice at the end is the
 * same advice the Match tab gives, phrased for somebody looking at a letter.
 */
export function diagnosticSkillsListOnly(skills: readonly string[]): string {
  const one = skills.length === 1;
  return (
    `${joinList(skills)} ${one ? "is" : "are"} on your skills list but no bullet shows you ` +
    `using ${one ? "it" : "them"}, so the letter says you have worked with ` +
    `${one ? "it" : "them"} and claims no more than that. A bullet that shows the work would ` +
    "let it say more."
  );
}

/* -------------------------------------------------------------------------- */
/* Alignment                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Names the skills the posting asked for that the resume *demonstrates*.
 *
 * Never a skill whose status is `listed-only` or `missing` — asserted by a
 * test. That restriction is the difference between a letter that summarises
 * your resume and one that overstates it, and overstating it is precisely
 * what a generated cover letter is expected to do and must not.
 */
export const ALIGNMENT_FRAME: Record<Tone, { one: string; many: string }> = {
  direct: {
    one: "Your posting asks for {skills}. That is in the work above.",
    many: "Your posting asks for {skills}. All of them are in the work above.",
  },
  warm: {
    one: "Your posting asks for {skills}, which is what the work above is made of.",
    many: "Your posting asks for {skills} — all of which the work above is made of.",
  },
  formal: {
    one: "Your posting specifies {skills}, which the experience described above addresses.",
    many: "Your posting specifies {skills}, each of which the experience described above addresses.",
  },
};

/**
 * Names the skills the posting asked for that the resume *lists* (§12 gap).
 *
 * ## Why a listed skill may be named at all
 *
 * The rule this product holds to is not "only demonstrated skills may be
 * mentioned". It is: **the letter may make any claim the resume already
 * makes, and must never present a weaker claim as a stronger one.** A skills
 * list is a claim — a weak one, weighted 0.25 against a bullet's 1.0 in
 * `EVIDENCE_WEIGHT` — but it is the candidate's own, already sitting in the
 * document the employer is reading. Repeating it in the letter adds nothing
 * the resume did not already assert.
 *
 * Refusing to name it did not make the letter more honest. It made the letter
 * *empty*: measured across the ten example resumes in `docs/QA.md` §11,
 * exactly two bullets anywhere name a term the vocabulary knows, so eight of
 * ten letters had no alignment paragraph and a bracketed placeholder where
 * their evidence should be. The candidate was being punished for writing
 * bullets the way this product's own guidance tells them to — outcomes and
 * numbers, not tool names.
 *
 * ## Why it is a separate frame, and always a separate sentence
 *
 * "The work above shows Kubernetes" and "I have worked with Kubernetes" are
 * different claims, and the whole value of this feature is that it does not
 * blur them. These sentences never share a clause with `ALIGNMENT_FRAME`, no
 * skill appears in both, and a test asserts each of those.
 *
 * The wording is deliberately plainer than the demonstrated frame: no "which
 * is what the work above is made of", because the work above does not show
 * it. It says what the resume says, and stops.
 */
export const ALIGNMENT_LISTED_FRAME: Record<Tone, { one: string; many: string }> = {
  direct: {
    one: "You also ask for {skills}, which I have worked with.",
    many: "You also ask for {skills}, all of which I have worked with.",
  },
  warm: {
    one: "You also mention {skills} — something I have worked with.",
    many: "You also mention {skills} — all of which I have worked with.",
  },
  formal: {
    one: "The posting also specifies {skills}, with which I have experience.",
    many: "The posting also specifies {skills}, with each of which I have experience.",
  },
};

/**
 * The same sentence when there is nothing demonstrated to precede it.
 *
 * "You **also** ask for" is wrong as an opening — also as well as what? The
 * paragraph is then only about listed skills, so it says so from the start.
 */
export const ALIGNMENT_LISTED_ONLY_FRAME: Record<Tone, { one: string; many: string }> = {
  direct: {
    one: "Your posting asks for {skills}, which I have worked with.",
    many: "Your posting asks for {skills}, all of which I have worked with.",
  },
  warm: {
    one: "Your posting asks for {skills} — something I have worked with.",
    many: "Your posting asks for {skills} — all of which I have worked with.",
  },
  formal: {
    one: "Your posting specifies {skills}, with which I have experience.",
    many: "Your posting specifies {skills}, with each of which I have experience.",
  },
};

/** The alignment paragraph is omitted entirely rather than faked. */
export const ALIGNMENT_WITHOUT_SKILLS = "";

/* -------------------------------------------------------------------------- */
/* Closing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One clean sentence.
 *
 * Explicitly not "I look forward to hearing from you at your earliest
 * convenience" — the phrase is filler, every reader has seen it a thousand
 * times, and it is the single clearest signal that a letter was assembled
 * rather than written.
 */
export const CLOSING: Record<Tone, string> = {
  direct: "I would be glad to talk through any of it.",
  warm: "I would be happy to talk through any of this with you.",
  formal: "I would welcome the opportunity to discuss my application further.",
};

/**
 * Wraps the user's own availability text.
 *
 * `{availability}` is inserted verbatim. The frame supplies only the
 * preposition, so what is said about the user's availability is entirely
 * theirs.
 */
export const AVAILABILITY_FRAME: Record<Tone, string> = {
  direct: "On timing: {availability}",
  warm: "On timing: {availability}",
  formal: "With regard to availability: {availability}",
};

/* -------------------------------------------------------------------------- */
/* Filling                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Substitutes `{name}` placeholders.
 *
 * Unfilled placeholders are an error rather than a silent pass-through: a
 * letter containing a literal `{company}` is worse than one that fails to
 * compose, because it will be sent. Every caller in `compose.ts` supplies a
 * complete map, and the throw is what keeps that true as templates change.
 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Cover letter template placeholder "{${key}}" has no value.`);
    }
    return value;
  });
}

/**
 * "a, b and c" — an Oxford-comma-free list, because the letter is prose.
 *
 * Written out rather than using `Intl.ListFormat` deliberately: the composer
 * must be deterministic across environments, and `Intl` output varies with
 * the ICU data the runtime was built with.
 */
export function joinList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  const head = items.slice(0, -1).join(", ");
  return `${head} and ${items[items.length - 1]}`;
}
