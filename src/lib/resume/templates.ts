/**
 * Template presets (P32-B2).
 *
 * ## What a template is here, and what it deliberately is not
 *
 * A template is a **named `Settings` object plus a section order**. It is not
 * a layout, not a component, not a second rendering path. D2 says there is
 * one layout engine and D3 says page counts are measured from the artifact
 * rather than estimated; a template that owned its own markup would break
 * both, and would double the surface every pagination and extraction test
 * has to cover.
 *
 * That constraint is not a compromise — it is why every template here is
 * still single-column, still real text, still standard-headed, and still
 * parses exactly as well as every other one. A competitor's "creative"
 * template is a two-column table that an ATS reads column-wise into nonsense.
 * Ours cannot be, because there is nothing in this file capable of expressing
 * one.
 *
 * ## Why they exist at all
 *
 * The gap being closed is perception, not capability. Five font pairs behind
 * a "Design" dialog reads as *no templates* beside a competitor's thumbnailed
 * gallery, and a visitor comparison-shopping leaves in ten seconds. Naming
 * the combinations and showing them is the entire fix.
 *
 * ## `forWho`, and the line it must not cross
 *
 * Every preset says who it suits and why. None claims an outcome — no
 * "recruiter-approved", no "gets more interviews". D14 forbids that, and it
 * is also the one thing about a font choice nobody can substantiate. A test
 * asserts the absence.
 */

import { DEFAULT_SETTINGS, type SectionType, type Settings } from "./schema";

/**
 * The three kinds of reason a person picks one of these.
 *
 * Deliberately not "popular / new / premium". There is nothing premium here
 * — every template is free on every plan — and ranking typographic choices
 * by imagined effectiveness is inventing information we do not have (D14).
 * These three say what a template is *for*, which is a claim about the
 * reader's situation and one we can actually stand behind.
 */
export const TEMPLATE_GROUPS = [
  {
    id: "general",
    title: "General purpose",
    blurb:
      "Pick on how it looks to a person. They differ in typeface, in where the header sits, in how section headings are set, and in how much fits on a page.",
  },
  {
    id: "region",
    title: "Where you are applying",
    blurb:
      "Paper size and length, which is where hiring conventions genuinely differ. The United States and Canada use Letter paper and expect one page; most of the rest of the world uses A4, and several markets read two or three pages as normal.",
  },
  {
    id: "field",
    title: "What you do",
    blurb:
      "The same document, reordered. What a reader meets first is the one thing a template can change that actually matters, and in some fields there is a right answer — a licence is checked before a job history, a publication list is the work rather than a footnote.",
  },
] as const;

export type TemplateGroupId = (typeof TEMPLATE_GROUPS)[number]["id"];

export interface TemplateDefinition {
  readonly id: string;
  /** Shown in the gallery. */
  readonly name: string;
  /**
   * Which of the three groups this belongs to.
   *
   * Twenty-four undifferentiated cards is a wall, and the thing a visitor is
   * actually deciding — "is this for my country, my field, or neither?" —
   * is not readable off a thumbnail. Lives on the definition rather than in
   * a separate list of ids so a new preset cannot be added to one and
   * forgotten in the other.
   */
  readonly group: TemplateGroupId;
  /** One honest line: who this suits and why. Never an outcome claim. */
  readonly forWho: string;
  /** A complete, valid `Settings` object — applied wholesale. */
  readonly settings: Settings;
  /** The order sections are arranged into when the template is applied. */
  readonly sectionOrder: readonly SectionType[];
}

/** Experience-first: the universally expected order for anyone with a job history. */
const EXPERIENCE_FIRST: readonly SectionType[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
];

/** Evidence-first: for a candidate whose work is not yet a job title. */
const PROJECTS_FIRST: readonly SectionType[] = [
  "summary",
  "education",
  "projects",
  "skills",
  "experience",
  "certifications",
];

/** Skills-first: for a career changer, or a contractor with many short engagements. */
const SKILLS_FIRST: readonly SectionType[] = [
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
];

/**
 * Credentials-first: a licence is a gate, not a footnote.
 *
 * Nursing, allied health, aviation and the licensed trades screen on the
 * credential before the history — BLS/ACLS, an RN licence and the state that
 * issued it, a type rating. Guidance for those fields is unusually consistent
 * about putting certifications *above* work experience for exactly that
 * reason, and it is the one section order no other preset here offers.
 */
const CREDENTIALS_FIRST: readonly SectionType[] = [
  "summary",
  "certifications",
  "skills",
  "experience",
  "education",
  "projects",
];

/**
 * Academic: education leads and the publication list gets room.
 *
 * `projects` is where a publication list lives in this schema, so it sits
 * directly under experience rather than near the bottom, and skills fall to
 * last — which is where a technical-skills block belongs on a research CV.
 */
const ACADEMIC_FIRST: readonly SectionType[] = [
  "summary",
  "education",
  "experience",
  "projects",
  "certifications",
  "skills",
];

/**
 * Education-first, with experience still above projects.
 *
 * The consulting, banking and graduate-scheme convention. Distinct from
 * `PROJECTS_FIRST`, which is for a candidate whose projects *are* the
 * evidence; here the institution is the signal being read first and the job
 * history still comes next.
 */
const EDUCATION_FIRST: readonly SectionType[] = [
  "summary",
  "education",
  "experience",
  "skills",
  "certifications",
  "projects",
];

function settings(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * Twenty-four presets, in three groups, ordered so the group a visitor is
 * most likely to want is the one they scroll past first.
 *
 * 1. **General purpose** — the original twelve. Chosen on typeface, header
 *    placement and how much fits.
 * 2. **Where you are applying** — paper size and length, which is the part
 *    of a regional convention this engine can honestly express. A US resume
 *    is on Letter and wants one page; a UK CV is on A4 and is allowed two;
 *    an Australian application routinely runs to three.
 * 3. **What you do** — section order, which is the axis that decides what a
 *    reader meets first. A nurse's licence is a gate; a researcher's
 *    publication list is the work; a service leaver's skills need reading
 *    before their rank.
 *
 * No two are a near-duplicate at thumbnail size, which is the size at which
 * they are actually compared — `templates.test.ts` asserts it on the four
 * axes a thumbnail can show apart, so a thirteenth font permutation that
 * happened to collide with an existing one fails the build rather than
 * shipping as a preset with two names.
 *
 * ## What none of them is
 *
 * There is still no two-column preset, no sidebar, no skills bar and no
 * photo — not because they were left out of this batch, but because nothing
 * in this file is capable of expressing one. That is the point: every
 * template added here inherits the parse guarantee rather than being
 * separately audited for it.
 */
export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    id: "atlas",
    name: "Atlas",
    group: "general",
    forWho:
      "The default, and the one to keep if you are unsure. Neutral sans-serif, everything where a reader expects it.",
    settings: settings({ fontPair: "modern", headerStyle: "left", headingStyle: "rule" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "chancery",
    name: "Chancery",
    group: "general",
    forWho:
      "Law, finance, academia and government — fields where a serif is the convention and departing from it is the thing people notice.",
    settings: settings({ fontPair: "classic", headerStyle: "centered", headingStyle: "rule" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "ledger",
    name: "Ledger",
    group: "general",
    forWho:
      "A long career that has to fit. Compact spacing and a quieter heading, so ten years take the room eight used to.",
    settings: settings({
      fontPair: "classic",
      density: "compact",
      fontSizePt: 10,
      margins: 0.6,
      headerStyle: "left",
      headingStyle: "caps",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "campus",
    name: "Campus",
    group: "general",
    forWho:
      "Students and recent graduates. Education and projects lead, because that is where the evidence is before there is a job history.",
    settings: settings({ fontPair: "clean", headerStyle: "centered", headingStyle: "accent-bar" }),
    sectionOrder: PROJECTS_FIRST,
  },
  {
    id: "workbench",
    name: "Workbench",
    group: "general",
    forWho:
      "Software and hardware roles. A precise sans-serif and an accent bar that survives being read on a phone.",
    settings: settings({ fontPair: "technical", headerStyle: "left", headingStyle: "accent-bar" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "quarto",
    name: "Quarto",
    group: "general",
    forWho:
      "Writing, design and editorial work, where the document itself is a sample of your judgement.",
    settings: settings({ fontPair: "editorial", headerStyle: "centered", headingStyle: "caps" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "plainspoken",
    name: "Plainspoken",
    group: "general",
    forWho:
      "The least decorated option. No rules, no bars, nothing between the reader and the words.",
    settings: settings({ fontPair: "modern", headerStyle: "left", headingStyle: "caps" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "pivot",
    name: "Pivot",
    group: "general",
    forWho: "Changing field. Skills lead, so what you can do is read before where you did it.",
    settings: settings({ fontPair: "clean", headerStyle: "left", headingStyle: "rule" }),
    sectionOrder: SKILLS_FIRST,
  },
  {
    id: "meridian",
    name: "Meridian",
    group: "general",
    forWho:
      "Senior and executive roles. Centred header, generous spacing, and a summary that is expected to be read rather than skipped.",
    settings: settings({
      fontPair: "editorial",
      density: "comfortable",
      fontSizePt: 11,
      headerStyle: "centered",
      headingStyle: "rule",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "foundry",
    name: "Foundry",
    group: "general",
    forWho:
      "Trades, operations and logistics. Larger body text and wide margins, because these are printed and read on paper more often than most.",
    settings: settings({
      fontPair: "clean",
      fontSizePt: 11,
      margins: 0.9,
      headerStyle: "left",
      headingStyle: "caps",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "lattice",
    name: "Lattice",
    group: "general",
    forWho:
      "Research and engineering with a long publication or project list. Compact, technical, and built to carry a lot of entries.",
    settings: settings({
      fontPair: "technical",
      density: "compact",
      fontSizePt: 10,
      margins: 0.6,
      headerStyle: "left",
      headingStyle: "rule",
    }),
    sectionOrder: PROJECTS_FIRST,
  },
  {
    id: "beacon",
    name: "Beacon",
    group: "general",
    forWho:
      "A first resume with very little on it yet. Centred, roomy, and shaped so a short document does not look like an empty one.",
    settings: settings({
      fontPair: "modern",
      density: "comfortable",
      fontSizePt: 11,
      margins: 0.9,
      headerStyle: "centered",
      headingStyle: "accent-bar",
    }),
    sectionOrder: PROJECTS_FIRST,
  },
  {
    id: "clarion",
    name: "Clarion",
    group: "general",
    forWho:
      "Large type and open spacing, for anyone who wants this readable at arm's length — including the person who prints it out. The most legible option here.",
    settings: settings({
      fontPair: "clean",
      fontSizePt: 12,
      lineHeight: 1.35,
      margins: 0.9,
      headerStyle: "centered",
      headingStyle: "caps",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },

  /* ------------------------------------------------------------------ */
  /* Shaped by where you are applying                                    */
  /*                                                                     */
  /* The conventions below are about paper size and length, because that */
  /* is the part of a regional convention this engine can honestly       */
  /* express. The parts it cannot — a German Lebenslauf's photo and date */
  /* of birth, a Japanese rirekisho's fixed grid — it does not pretend   */
  /* to, and `forWho` says so rather than leaving a user to discover it. */
  /* ------------------------------------------------------------------ */
  {
    id: "harbor",
    name: "Harbor",
    group: "region",
    forWho:
      "The United States and Canada. Letter paper rather than A4, and tight enough that a full career still lands on one page, which is the expectation there.",
    settings: settings({
      pageSize: "LETTER",
      fontPair: "modern",
      density: "compact",
      fontSizePt: 10.5,
      margins: 0.7,
      headerStyle: "left",
      headingStyle: "rule",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "thames",
    name: "Thames",
    group: "region",
    forWho:
      "The UK and Ireland. A4, a personal statement at the top, and spacing that assumes two pages — normal there, rather than something to squeeze out.",
    settings: settings({
      fontPair: "classic",
      fontSizePt: 11,
      margins: 0.8,
      headerStyle: "left",
      headingStyle: "rule",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "tasman",
    name: "Tasman",
    group: "region",
    forWho:
      "Australia and New Zealand. Roomy, because applications there run to two or three pages and often answer selection criteria in full.",
    settings: settings({
      fontPair: "clean",
      fontSizePt: 11,
      margins: 0.85,
      headerStyle: "left",
      headingStyle: "accent-bar",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "hansa",
    name: "Hansa",
    group: "region",
    forWho:
      "Germany, the Netherlands and the Nordics. Formal, centred and on A4. It adds no photo or date of birth — some employers there still expect both, and this will not put them on for you.",
    settings: settings({
      fontPair: "classic",
      fontSizePt: 10.5,
      margins: 0.8,
      headerStyle: "centered",
      headingStyle: "caps",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "monsoon",
    name: "Monsoon",
    group: "region",
    forWho:
      "India, the Gulf and Southeast Asia. A4, and dense enough to carry the two or three pages of detail those markets ask for without becoming four.",
    settings: settings({
      fontPair: "modern",
      fontSizePt: 10.5,
      margins: 0.7,
      headerStyle: "left",
      headingStyle: "accent-bar",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },

  /* ------------------------------------------------------------------ */
  /* Shaped by what you do                                              */
  /*                                                                    */
  /* Mostly section order — the axis that decides what a reader meets    */
  /* first — with density behind it where a field is known for long      */
  /* documents. Nothing else about them differs: same single column,     */
  /* same real text, same standard headings.                            */
  /* ------------------------------------------------------------------ */
  {
    id: "vitals",
    name: "Vitals",
    group: "field",
    forWho:
      "Nursing, allied health, aviation and the licensed trades. Certifications sit above your work history, because in those fields they are a requirement to be checked rather than a footnote.",
    settings: settings({ fontPair: "clean", headerStyle: "centered", headingStyle: "rule" }),
    sectionOrder: CREDENTIALS_FIRST,
  },
  {
    id: "scholar",
    name: "Scholar",
    group: "field",
    forWho:
      "Academic and research posts. Education leads, publications and projects get room, and compact spacing keeps a long list from running to five pages.",
    settings: settings({
      fontPair: "editorial",
      density: "compact",
      fontSizePt: 10,
      margins: 0.65,
      headerStyle: "left",
      headingStyle: "caps",
    }),
    sectionOrder: ACADEMIC_FIRST,
  },
  {
    id: "cohort",
    name: "Cohort",
    group: "field",
    forWho:
      "Consulting, banking and graduate schemes, where the institution is read before the job history and one page is the unwritten rule. Serif, centred, tight.",
    settings: settings({
      fontPair: "classic",
      density: "compact",
      fontSizePt: 10,
      margins: 0.65,
      headerStyle: "centered",
      headingStyle: "rule",
    }),
    sectionOrder: EDUCATION_FIRST,
  },
  {
    id: "civic",
    name: "Civic",
    group: "field",
    forWho:
      "Government and public sector applications, which are read against a written specification. Plain and dense, so the detail those forms ask for actually fits.",
    settings: settings({
      fontPair: "modern",
      density: "compact",
      fontSizePt: 10,
      margins: 0.7,
      headerStyle: "left",
      headingStyle: "caps",
    }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "ensign",
    name: "Ensign",
    group: "field",
    forWho:
      "Leaving the armed forces or another uniformed service. Skills lead, so what you can do is read before a rank and a unit name a civilian reader may not decode.",
    settings: settings({ fontPair: "modern", headerStyle: "centered", headingStyle: "rule" }),
    sectionOrder: SKILLS_FIRST,
  },
  {
    id: "relay",
    name: "Relay",
    group: "field",
    forWho:
      "Contract and freelance work. Skills lead and the type is small, because ten short engagements need more room than three long ones.",
    settings: settings({
      fontPair: "technical",
      fontSizePt: 10,
      margins: 0.7,
      headerStyle: "left",
      headingStyle: "caps",
    }),
    sectionOrder: SKILLS_FIRST,
  },
];

export const DEFAULT_TEMPLATE_ID = "atlas";

/**
 * How many there are, for the copy that says so.
 *
 * Derived rather than written down twice: the page title, the meta
 * description and the pricing bullet all quoted "twelve" as a literal, and
 * three separate places to remember is how a gallery ends up advertising a
 * number it no longer ships.
 */
export const TEMPLATE_COUNT = TEMPLATES.length;

export function getTemplate(id: string): TemplateDefinition | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

/**
 * The template whose settings a document currently matches, or null.
 *
 * Compares only the axes a template actually sets, so a user who nudged the
 * font size with the fit assistant is still recognisably "on" a template
 * rather than silently falling off it. Accent colour is excluded for the same
 * reason: it is a personal choice layered over a template, not part of one.
 *
 * **`pageSize` is excluded too, deliberately**, even though Harbor exists
 * precisely to set it. Including it would mean switching a document from A4
 * to Letter silently deselects whatever template it is on — no preset has
 * Atlas's typography on Letter paper, so the gallery would go blank and the
 * user would have no way back short of guessing. Somebody who wants Harbor's
 * density on A4 is still on Harbor, the same way somebody who nudged the
 * margins is.
 */
export function matchTemplate(current: Settings): TemplateDefinition | null {
  return (
    TEMPLATES.find(
      (template) =>
        template.settings.fontPair === current.fontPair &&
        template.settings.headerStyle === current.headerStyle &&
        template.settings.headingStyle === current.headingStyle &&
        template.settings.density === current.density,
    ) ?? null
  );
}
