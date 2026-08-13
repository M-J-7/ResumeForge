/**
 * The resume document schema — the foundation every other module reads.
 *
 * ## What this schema does and does not enforce
 *
 * It enforces *structural* integrity: field types, length ceilings, unique
 * ids, one instance of each standard section, and internally consistent date
 * ranges. It deliberately permits empty content — a half-typed resume must be
 * representable, because the store persists on every keystroke and because
 * "missing email" is a lint rule (M0-T11), not a parse failure. If the schema
 * rejected incomplete documents, that rule could never fire.
 *
 * Content quality is therefore the lint engine's job, not the schema's.
 *
 * ## Deliberate omissions
 *
 * There is no field for a photo, date of birth, marital status, gender, or
 * nationality. Their absence is a product position, not an oversight. Regions
 * where such fields are conventional are handled by the regional convention
 * engine (M4-T6).
 *
 * Per D10 the document carries a `schemaVersion`, and `./migrate.ts` is the
 * only supported way to load a document of unknown age.
 */

import { z } from "zod";
import { FONT_PAIR_IDS, DEFAULT_FONT_PAIR_ID } from "@/lib/fonts/pairs";
import { isValidRange } from "./dates";

/**
 * Bump this whenever the shape of a persisted document changes, and add the
 * matching migration in `./migrate.ts`. Never renumber existing versions.
 */
export const CURRENT_SCHEMA_VERSION = 1;

const MAX_BULLETS = 50;
const MAX_BULLET_LENGTH = 1000;
const MAX_ENTRIES = 100;

/** Ids are system-generated, so unlike user content they must be present. */
const idSchema = z.string().min(1, "Every entry needs a stable id.");

/** User-entered text: trimmed and length-capped, but may be empty while editing. */
const text = (max: number) => z.string().trim().max(max);

/** Optional-format fields accept "" so a partially-typed value can persist. */
const emailField = z.union([z.literal(""), z.email("Enter a valid email address.")]);
const urlField = z.union([z.literal(""), z.url("Enter a full URL, including https://")]);

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

export const partialDateSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12).nullable(),
});

export const dateRangeSchema = z
  .object({
    start: partialDateSchema,
    end: partialDateSchema.nullable(),
    current: z.boolean(),
  })
  .refine((r) => (r.current ? r.end === null : r.end !== null), {
    message: "An ongoing entry must have no end date; a finished one requires it.",
    path: ["end"],
  })
  .refine(isValidRange, {
    message: "End date cannot fall before the start date.",
    path: ["end"],
  });

/* -------------------------------------------------------------------------- */
/* Contact                                                                     */
/* -------------------------------------------------------------------------- */

export const contactLinkSchema = z.object({
  id: idSchema,
  /** Shown before the URL, e.g. "LinkedIn". */
  label: text(40),
  url: urlField,
});

/**
 * `fullName` is one field on purpose. Splitting into first/last breaks for a
 * large share of the world's names, and a global audience makes that a
 * correctness issue rather than a nicety. The export filename derives from the
 * whole string (M0-T12).
 */
export const contactSchema = z.object({
  fullName: text(120),
  email: emailField,
  phone: text(40),
  /** Never more precise than city + region. */
  location: text(120),
  links: z.array(contactLinkSchema).max(8),
});

/* -------------------------------------------------------------------------- */
/* Entries                                                                     */
/* -------------------------------------------------------------------------- */

/** Empty bullets are a normal editing state — the user just pressed "add". */
const bulletsSchema = z.array(text(MAX_BULLET_LENGTH)).max(MAX_BULLETS);

export const experienceEntrySchema = z.object({
  id: idSchema,
  title: text(140),
  organization: text(140),
  location: text(120),
  dates: dateRangeSchema,
  bullets: bulletsSchema,
});

export const educationEntrySchema = z.object({
  id: idSchema,
  institution: text(160),
  credential: text(160),
  field: text(160),
  location: text(120),
  dates: dateRangeSchema,
  /** Free text so "8.7 CGPA", "First Class", and "3.9/4.0" all work. */
  result: text(60),
  bullets: bulletsSchema,
});

export const skillGroupSchema = z.object({
  id: idSchema,
  label: text(60),
  /** Plain strings — no proficiency levels. A parser cannot read a slider. */
  skills: z.array(text(80)).max(60),
});

export const projectEntrySchema = z.object({
  id: idSchema,
  name: text(140),
  role: text(120),
  url: urlField,
  dates: dateRangeSchema.nullable(),
  bullets: bulletsSchema,
});

export const certificationEntrySchema = z.object({
  id: idSchema,
  name: text(180),
  issuer: text(140),
  issued: partialDateSchema.nullable(),
  credentialId: text(120),
  url: urlField,
});

export const customEntrySchema = z.object({
  id: idSchema,
  title: text(160),
  subtitle: text(160),
  dates: dateRangeSchema.nullable(),
  bullets: bulletsSchema,
});

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Standard section types map to the exact headings ATS parsers pattern-match
 * on. The heading strings themselves are a render concern (M0-T3); only the
 * type lives here.
 */
export const STANDARD_SECTION_TYPES = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
] as const;

export type StandardSectionType = (typeof STANDARD_SECTION_TYPES)[number];

const sectionBase = { id: idSchema, visible: z.boolean() };

export const summarySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("summary"),
  content: text(1200),
});

export const experienceSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("experience"),
  entries: z.array(experienceEntrySchema).max(MAX_ENTRIES),
});

export const educationSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("education"),
  entries: z.array(educationEntrySchema).max(MAX_ENTRIES),
});

export const skillsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("skills"),
  groups: z.array(skillGroupSchema).max(12),
});

export const projectsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("projects"),
  entries: z.array(projectEntrySchema).max(MAX_ENTRIES),
});

export const certificationsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("certifications"),
  entries: z.array(certificationEntrySchema).max(MAX_ENTRIES),
});

export const customSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("custom"),
  /** User-supplied heading, e.g. "Languages" or "Volunteering". */
  label: text(60),
  entries: z.array(customEntrySchema).max(MAX_ENTRIES),
});

export const sectionSchema = z.discriminatedUnion("type", [
  summarySectionSchema,
  experienceSectionSchema,
  educationSectionSchema,
  skillsSectionSchema,
  projectsSectionSchema,
  certificationsSectionSchema,
  customSectionSchema,
]);

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export const PAGE_SIZES = ["A4", "LETTER"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const DENSITIES = ["compact", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour, e.g. #1F2937.");

/**
 * `density` is the user-facing control; it presets `fontSizePt` and
 * `lineHeight`. The fit assistant (M4-T3) then nudges those two within a
 * narrow safe band to win or lose a page. All three persist so a tuned
 * document reopens exactly as it was rendered.
 */
export const settingsSchema = z.object({
  pageSize: z.enum(PAGE_SIZES),
  fontPair: z.enum(FONT_PAIR_IDS),
  accent: hexColor,
  density: z.enum(DENSITIES),
  /** Page margin in inches. */
  margins: z.number().min(0.4).max(1),
  /** Body text size in points. */
  fontSizePt: z.number().min(9).max(12),
  /** Unitless multiplier of font size. */
  lineHeight: z.number().min(1).max(1.6),
});

/* -------------------------------------------------------------------------- */
/* Root document                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `schemaVersion` is a literal, so a document of any other version fails to
 * parse. That is intentional: it forces callers through `migrate()` rather
 * than letting a stale document through unnoticed.
 */
export const resumeDocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    contact: contactSchema,
    sections: z.array(sectionSchema).max(24),
    settings: settingsSchema,
  })
  .refine(
    (doc) => {
      const standard = doc.sections.filter((s) => s.type !== "custom").map((s) => s.type);
      return new Set(standard).size === standard.length;
    },
    { message: "Each standard section may appear only once.", path: ["sections"] },
  )
  .refine((doc) => new Set(doc.sections.map((s) => s.id)).size === doc.sections.length, {
    message: "Section ids must be unique.",
    path: ["sections"],
  });

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type ContactLink = z.infer<typeof contactLinkSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type CertificationEntry = z.infer<typeof certificationEntrySchema>;
export type CustomEntry = z.infer<typeof customEntrySchema>;

export type SummarySection = z.infer<typeof summarySectionSchema>;
export type ExperienceSection = z.infer<typeof experienceSectionSchema>;
export type EducationSection = z.infer<typeof educationSectionSchema>;
export type SkillsSection = z.infer<typeof skillsSectionSchema>;
export type ProjectsSection = z.infer<typeof projectsSectionSchema>;
export type CertificationsSection = z.infer<typeof certificationsSectionSchema>;
export type CustomSection = z.infer<typeof customSectionSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];

export type Settings = z.infer<typeof settingsSchema>;
export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

export const DEFAULT_SETTINGS: Settings = {
  pageSize: "A4",
  fontPair: DEFAULT_FONT_PAIR_ID,
  accent: "#1F2937",
  density: "comfortable",
  margins: 0.75,
  fontSizePt: 10.5,
  lineHeight: 1.2,
};
