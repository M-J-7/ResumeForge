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

export interface TemplateDefinition {
  readonly id: string;
  /** Shown in the gallery. */
  readonly name: string;
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

function settings(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * Twelve presets across five font pairs, two header styles and three heading
 * styles — chosen so that no two are a near-duplicate of each other at
 * thumbnail size, which is the size at which they are actually compared.
 */
export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    id: "atlas",
    name: "Atlas",
    forWho:
      "The default, and the one to keep if you are unsure. Neutral sans-serif, everything where a reader expects it.",
    settings: settings({ fontPair: "modern", headerStyle: "left", headingStyle: "rule" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "chancery",
    name: "Chancery",
    forWho:
      "Law, finance, academia and government — fields where a serif is the convention and departing from it is the thing people notice.",
    settings: settings({ fontPair: "classic", headerStyle: "centered", headingStyle: "rule" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "ledger",
    name: "Ledger",
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
    forWho:
      "Students and recent graduates. Education and projects lead, because that is where the evidence is before there is a job history.",
    settings: settings({ fontPair: "clean", headerStyle: "centered", headingStyle: "accent-bar" }),
    sectionOrder: PROJECTS_FIRST,
  },
  {
    id: "workbench",
    name: "Workbench",
    forWho:
      "Software and hardware roles. A precise sans-serif and an accent bar that survives being read on a phone.",
    settings: settings({ fontPair: "technical", headerStyle: "left", headingStyle: "accent-bar" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "quarto",
    name: "Quarto",
    forWho:
      "Writing, design and editorial work, where the document itself is a sample of your judgement.",
    settings: settings({ fontPair: "editorial", headerStyle: "centered", headingStyle: "caps" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "plainspoken",
    name: "Plainspoken",
    forWho:
      "The least decorated option. No rules, no bars, nothing between the reader and the words.",
    settings: settings({ fontPair: "modern", headerStyle: "left", headingStyle: "caps" }),
    sectionOrder: EXPERIENCE_FIRST,
  },
  {
    id: "pivot",
    name: "Pivot",
    forWho: "Changing field. Skills lead, so what you can do is read before where you did it.",
    settings: settings({ fontPair: "clean", headerStyle: "left", headingStyle: "rule" }),
    sectionOrder: SKILLS_FIRST,
  },
  {
    id: "meridian",
    name: "Meridian",
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
];

export const DEFAULT_TEMPLATE_ID = "atlas";

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
