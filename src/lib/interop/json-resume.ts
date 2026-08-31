/**
 * JSON Resume interop (M2-T6).
 *
 * Exporting in a published, third-party format is four things at once:
 * portability, a trust signal, a GDPR data export, and — because the format
 * is not ours — a standing promise that leaving is possible. A product whose
 * position is "we do not hold your work hostage" needs the door to actually
 * open.
 *
 * Mapped against the v1.0.0 schema:
 * https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json
 *
 * ## Where the parts that do not map go
 *
 * The schema sets `additionalProperties: false` **at the root and nowhere
 * else**, which decides the whole design. A top-level `x_ours` key would
 * make the file invalid, so everything JSON Resume has no place for —
 * section order, section visibility, custom sections, our rendering settings
 * — lives under `meta.x_atsResumeBuilder`, and per-entry extras live on the
 * entries themselves as `x_`-prefixed keys. Both nest inside objects the
 * schema leaves open.
 *
 * The result is a file any JSON Resume consumer reads correctly, and that we
 * can re-import without losing anything. `fromJsonResume` works on a foreign
 * file too — it just falls back to default settings and section order, which
 * is the right answer when the source genuinely had none.
 *
 * ## Dates
 *
 * The schema's `iso8601` allows `YYYY-MM-DD`, `YYYY-MM`, or `YYYY`. Our
 * `PartialDate` is year plus optional month, so it maps onto the second and
 * third forms exactly. An ongoing entry omits `endDate`, which is the
 * convention the format already uses.
 */

import { createId } from "@/lib/resume/factory";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  customSectionSchema,
  resumeDocumentSchema,
} from "@/lib/resume/schema";
import type { DateRange, PartialDate } from "@/lib/resume/dates";
import type {
  CertificationEntry,
  Contact,
  CustomEntry,
  CustomSection,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeDocument,
  Section,
  Settings,
  SkillGroup,
} from "@/lib/resume/schema";

export const JSON_RESUME_SCHEMA_URL =
  "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";

export const JSON_RESUME_VERSION = "v1.0.0";

/** Where everything JSON Resume has no field for is kept. */
export const EXTENSION_KEY = "x_atsResumeBuilder";

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

export interface JsonResume {
  $schema: string;
  basics: {
    name: string;
    email?: string;
    phone?: string;
    summary?: string;
    location?: { city?: string; region?: string };
    profiles?: { network: string; url: string }[];
  };
  work?: Record<string, unknown>[];
  education?: Record<string, unknown>[];
  skills?: Record<string, unknown>[];
  projects?: Record<string, unknown>[];
  certificates?: Record<string, unknown>[];
  meta: Record<string, unknown>;
}

/** One resume in an account export. */
export interface AccountExportEntry {
  id: string;
  title: string;
  updatedAt: string;
  resume: JsonResume;
}

/**
 * The whole-account export.
 *
 * A wrapper, because JSON Resume describes exactly one resume and an account
 * holds several. Each `resume` inside is a standalone, valid JSON Resume
 * document that can be lifted out and used on its own.
 */
export interface AccountExport {
  format: "ats-resume-builder/account-export";
  version: 1;
  exportedAt: string;
  resumes: AccountExportEntry[];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatDate(date: PartialDate): string {
  const year = String(date.year).padStart(4, "0");
  return date.month === null ? year : `${year}-${String(date.month).padStart(2, "0")}`;
}

/** Parses `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Day precision is discarded. */
export function parseDate(value: unknown): PartialDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] === undefined ? null : Number(match[2]);
  if (year < 1900 || year > 2100) return null;
  if (month !== null && (month < 1 || month > 12)) return null;
  return { year, month };
}

function dateFields(range: DateRange | null): Record<string, string> {
  if (!range) return {};
  const fields: Record<string, string> = { startDate: formatDate(range.start) };
  // An ongoing entry omits `endDate` — the format's own convention, and the
  // reason `current` needs no field of its own.
  if (range.end) fields.endDate = formatDate(range.end);
  return fields;
}

function readRange(item: Record<string, unknown>): DateRange | null {
  const start = parseDate(item.startDate);
  if (!start) return null;
  const end = parseDate(item.endDate);
  return { start, end, current: end === null };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function nonEmpty(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

/** Drops keys whose value is an empty string or an empty array. */
function compact(item: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === "" || value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Splits "Berlin, Germany" into city and region.
 *
 * Our contact holds one string because that is what a resume prints, but
 * JSON Resume models the parts. Splitting on the **last** comma and rejoining
 * with ", " round-trips every location that has at most one comma, which is
 * the shape the builder's own guidance asks for (city plus region). A city
 * whose own name contains a comma is the documented lossy case.
 */
export function splitLocation(value: string): { city?: string; region?: string } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const index = trimmed.lastIndexOf(",");
  if (index === -1) return { city: trimmed };
  const city = trimmed.slice(0, index).trim();
  const region = trimmed.slice(index + 1).trim();
  if (!city || !region) return { city: trimmed };
  return { city, region };
}

export function joinLocation(location: unknown): string {
  if (typeof location !== "object" || location === null) return "";
  const { city, region } = location as { city?: unknown; region?: unknown };
  return [str(city).trim(), str(region).trim()].filter(Boolean).join(", ");
}

function sectionOf<T extends Section["type"]>(
  doc: ResumeDocument,
  type: T,
): Extract<Section, { type: T }> | undefined {
  return doc.sections.find((section) => section.type === type) as
    Extract<Section, { type: T }> | undefined;
}

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

export interface ToJsonResumeOptions {
  /** Clock seam — `meta.lastModified` would otherwise make exports differ run to run. */
  now?: Date;
}

export function toJsonResume(doc: ResumeDocument, options: ToJsonResumeOptions = {}): JsonResume {
  const { now = new Date() } = options;

  const summary = sectionOf(doc, "summary");
  const experience = sectionOf(doc, "experience");
  const education = sectionOf(doc, "education");
  const skills = sectionOf(doc, "skills");
  const projects = sectionOf(doc, "projects");
  const certifications = sectionOf(doc, "certifications");
  const custom = doc.sections.filter(
    (section): section is CustomSection => section.type === "custom",
  );

  const basics = compact({
    name: doc.contact.fullName,
    email: doc.contact.email,
    phone: doc.contact.phone,
    summary: summary?.content ?? "",
    location: splitLocation(doc.contact.location),
    profiles: doc.contact.links.map((link) =>
      compact({ network: link.label, url: link.url, x_id: link.id }),
    ),
  }) as JsonResume["basics"];

  return {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics,
    work: experience?.entries.map((entry) =>
      compact({
        name: entry.organization,
        position: entry.title,
        location: entry.location,
        ...dateFields(entry.dates),
        highlights: nonEmpty(entry.bullets),
        x_id: entry.id,
      }),
    ),
    education: education?.entries.map((entry) =>
      compact({
        institution: entry.institution,
        studyType: entry.credential,
        area: entry.field,
        score: entry.result,
        location: entry.location,
        ...dateFields(entry.dates),
        // Not a standard education field. JSON Resume offers `courses`, which
        // these are not — a bullet describes what someone did, a course is a
        // subject they sat. Better a clearly-named extra than a wrong fit.
        highlights: nonEmpty(entry.bullets),
        x_id: entry.id,
      }),
    ),
    skills: skills?.groups.map((group) =>
      compact({ name: group.label, keywords: nonEmpty(group.skills), x_id: group.id }),
    ),
    projects: projects?.entries.map((entry) =>
      compact({
        name: entry.name,
        roles: entry.role ? [entry.role] : [],
        url: entry.url,
        ...dateFields(entry.dates),
        highlights: nonEmpty(entry.bullets),
        x_id: entry.id,
      }),
    ),
    certificates: certifications?.entries.map((entry) =>
      compact({
        name: entry.name,
        issuer: entry.issuer,
        date: entry.issued ? formatDate(entry.issued) : "",
        url: entry.url,
        x_credentialId: entry.credentialId,
        x_id: entry.id,
      }),
    ),
    meta: {
      version: JSON_RESUME_VERSION,
      lastModified: now.toISOString(),
      [EXTENSION_KEY]: {
        schemaVersion: doc.schemaVersion,
        settings: doc.settings,
        // Order, ids, and visibility have no representation in JSON Resume at
        // all — it is a data format, not a layout. Without these, re-importing
        // your own file would silently reorder your resume.
        sections: doc.sections.map((section) => ({
          id: section.id,
          type: section.type,
          visible: section.visible,
        })),
        custom: custom.map((section) => ({
          id: section.id,
          label: section.label,
          visible: section.visible,
          entries: section.entries,
        })),
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Import                                                                      */
/* -------------------------------------------------------------------------- */

export type FromJsonResumeResult =
  { ok: true; document: ResumeDocument } | { ok: false; error: string };

interface Extension {
  schemaVersion?: unknown;
  settings?: unknown;
  sections?: { id?: unknown; type?: unknown; visible?: unknown }[];
  custom?: { id?: unknown; label?: unknown; visible?: unknown; entries?: unknown }[];
}

function readExtension(meta: unknown): Extension | null {
  if (typeof meta !== "object" || meta === null) return null;
  const value = (meta as Record<string, unknown>)[EXTENSION_KEY];
  return typeof value === "object" && value !== null ? (value as Extension) : null;
}

function items(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : [];
}

function idOf(item: Record<string, unknown>): string {
  // Preserved when we wrote the file, generated when someone else did.
  return typeof item.x_id === "string" && item.x_id ? item.x_id : createId();
}

function readContact(basics: Record<string, unknown>): Contact {
  return {
    fullName: str(basics.name),
    email: str(basics.email),
    phone: str(basics.phone),
    location: joinLocation(basics.location),
    links: items(basics.profiles)
      .map((profile) => ({
        id: idOf(profile),
        label: str(profile.network),
        url: str(profile.url),
      }))
      .filter((link) => link.label || link.url)
      .slice(0, 8),
  };
}

/**
 * A range for an entry whose file gave no usable dates.
 *
 * Our schema requires one on work and education; JSON Resume does not, so a
 * foreign file can legitimately omit it. Something has to be invented, and
 * "started this year, ongoing" is the least misleading available — it is
 * also what the lint engine's date rules will flag for the user to correct.
 */
function fallbackRange(now: Date): DateRange {
  return { start: { year: now.getFullYear(), month: null }, end: null, current: true };
}

function readExperience(item: Record<string, unknown>, now: Date): ExperienceEntry {
  return {
    id: idOf(item),
    title: str(item.position),
    organization: str(item.name),
    location: str(item.location),
    dates: readRange(item) ?? fallbackRange(now),
    bullets: strings(item.highlights),
  };
}

function readEducation(item: Record<string, unknown>, now: Date): EducationEntry {
  return {
    id: idOf(item),
    institution: str(item.institution),
    credential: str(item.studyType),
    field: str(item.area),
    location: str(item.location),
    dates: readRange(item) ?? fallbackRange(now),
    result: str(item.score),
    // `courses` is read as a fallback so a foreign file's data is not simply
    // dropped, even though we never write it.
    bullets: strings(item.highlights).length > 0 ? strings(item.highlights) : strings(item.courses),
  };
}

function readSkillGroup(item: Record<string, unknown>): SkillGroup {
  return { id: idOf(item), label: str(item.name), skills: strings(item.keywords).slice(0, 60) };
}

function readProject(item: Record<string, unknown>): ProjectEntry {
  return {
    id: idOf(item),
    name: str(item.name),
    role: strings(item.roles)[0] ?? "",
    url: str(item.url),
    dates: readRange(item),
    bullets: strings(item.highlights),
  };
}

function readCertificate(item: Record<string, unknown>): CertificationEntry {
  return {
    id: idOf(item),
    name: str(item.name),
    issuer: str(item.issuer),
    issued: parseDate(item.date),
    credentialId: str(item.x_credentialId),
    url: str(item.url),
  };
}

function readSettings(value: unknown): Settings {
  // Parsed rather than trusted: settings drive geometry, and an out-of-range
  // font size or margin from a hand-edited file would render a broken PDF.
  const parsed = resumeDocumentSchema.safeParse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: { fullName: "", email: "", phone: "", location: "", links: [] },
    sections: [],
    settings: value,
  });
  return parsed.success ? parsed.data.settings : DEFAULT_SETTINGS;
}

/**
 * Custom sections come back out of our own extension block.
 *
 * Validated with the section's real schema first: the block was written by
 * this app, so the common case is an exact match and there is nothing to
 * translate. The field-by-field fallback exists for a hand-edited file, and
 * deliberately loses dates rather than guessing at a malformed range.
 */
function readCustomSections(extension: Extension | null): CustomSection[] {
  if (!extension?.custom) return [];
  return extension.custom.map((section) => {
    const parsed = customSectionSchema.safeParse({ ...section, type: "custom" });
    if (parsed.success) return parsed.data;

    return {
      id: typeof section.id === "string" && section.id ? section.id : createId(),
      type: "custom" as const,
      visible: section.visible !== false,
      label: str(section.label),
      entries: items(section.entries).map((entry): CustomEntry => ({
        id: idOf(entry),
        title: str(entry.title),
        subtitle: str(entry.subtitle),
        dates: null,
        bullets: strings(entry.bullets),
      })),
    };
  });
}

/** Section order and visibility for a file that carries no extension block. */
const DEFAULT_ORDER: Exclude<Section["type"], "custom">[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
];

export interface FromJsonResumeOptions {
  /** Clock seam for the invented fallback date above. */
  now?: Date;
}

export function fromJsonResume(
  value: unknown,
  options: FromJsonResumeOptions = {},
): FromJsonResumeResult {
  const { now = new Date() } = options;

  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "That file does not contain a JSON object." };
  }

  const root = value as Record<string, unknown>;
  const basics =
    typeof root.basics === "object" && root.basics !== null
      ? (root.basics as Record<string, unknown>)
      : null;

  if (!basics && !Array.isArray(root.work) && !Array.isArray(root.education)) {
    return {
      ok: false,
      error: "That file is not a JSON Resume — it has no basics, work, or education.",
    };
  }

  const extension = readExtension(root.meta);

  const built: Record<Exclude<Section["type"], "custom">, Section> = {
    summary: {
      id: createId(),
      type: "summary",
      visible: true,
      content: str(basics?.summary),
    },
    experience: {
      id: createId(),
      type: "experience",
      visible: true,
      entries: items(root.work).map((item) => readExperience(item, now)),
    },
    education: {
      id: createId(),
      type: "education",
      visible: true,
      entries: items(root.education).map((item) => readEducation(item, now)),
    },
    skills: {
      id: createId(),
      type: "skills",
      visible: true,
      groups: items(root.skills).map(readSkillGroup),
    },
    projects: {
      id: createId(),
      type: "projects",
      visible: true,
      entries: items(root.projects).map(readProject),
    },
    certifications: {
      id: createId(),
      type: "certifications",
      visible: true,
      entries: items(root.certificates).map(readCertificate),
    },
  };

  const customSections = readCustomSections(extension);
  const customById = new Map(customSections.map((section) => [section.id, section]));

  let sections: Section[];
  if (extension?.sections && extension.sections.length > 0) {
    // A hand-edited file can name the same standard section twice, which the
    // document schema rejects outright. Taking the first occurrence keeps a
    // recoverable file recoverable.
    const used = new Set<string>();
    sections = extension.sections.flatMap((entry): Section[] => {
      const type = entry.type;
      const visible = entry.visible !== false;
      if (type === "custom") {
        const found = typeof entry.id === "string" ? customById.get(entry.id) : undefined;
        return found ? [{ ...found, visible }] : [];
      }
      if (typeof type !== "string" || !(type in built) || used.has(type)) return [];
      used.add(type);
      const section = built[type as Exclude<Section["type"], "custom">];
      return [
        {
          ...section,
          ...(typeof entry.id === "string" && entry.id ? { id: entry.id } : {}),
          visible,
        } as Section,
      ];
    });
  } else {
    sections = [...DEFAULT_ORDER.map((type) => built[type]), ...customSections];
  }

  const document: ResumeDocument = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: basics
      ? readContact(basics)
      : { fullName: "", email: "", phone: "", location: "", links: [] },
    sections,
    settings: readSettings(extension?.settings),
  };

  // The final gate: whatever the file claimed, what comes out of here is a
  // document the rest of the app can rely on unconditionally.
  const parsed = resumeDocumentSchema.safeParse(document);
  if (!parsed.success) {
    return { ok: false, error: `That file could not be read as a resume: ${parsed.error.message}` };
  }
  return { ok: true, document: parsed.data };
}
