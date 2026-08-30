/**
 * The document model (M0-T3).
 *
 * Per D3, we do not compute pagination ourselves. `buildDocument` turns a
 * `ResumeDocument` into a flat, ordered list of semantic `DocumentBlock`s
 * carrying keep-together hints; each emitter (PDF, DOCX, TXT) maps those
 * hints onto its own native break-control primitives. This module is the
 * only place the four break rules are encoded — emitters must not
 * reinterpret or add to them.
 *
 * The plan sketches a block as `{ type, content, keepWithNext?, keepTogether?,
 * minPresenceAhead? }`. We use a discriminated union with one concrete shape
 * per block kind instead of a generic `content` bag: it keeps every field
 * traceable 1:1 to its schema source (no lossy string concatenation of e.g.
 * education's `credential` + `field`), and lets each emitter decide its own
 * textual composition, which is a rendering concern.
 *
 * ## The four break rules
 *
 * 1. A section heading is `keepWithNext` — never ends a page alone.
 * 2. A role header (title + company + dates) plus its first bullet is
 *    `keepTogether` — never split. We realize this by embedding the first
 *    bullet's text directly on the header block, so "header + first bullet"
 *    is literally one atomic block rather than two blocks an emitter must
 *    remember to group.
 * 3. A bullet is `keepTogether` — never splits mid-bullet across pages.
 * 4. A role's final bullet must not land alone on the next page. The plan
 *    describes this as "the final bullet gets minPresenceAhead", but
 *    `minPresenceAhead` reserves space *after* the node it is set on — set on
 *    the final bullet itself it would guard whatever comes *after* the role,
 *    not the bullet itself. So the hint actually goes on the block
 *    immediately *before* the final bullet (the header, when there is only
 *    one remaining bullet; otherwise the second-to-last bullet), sized to the
 *    resume's own font metrics so it scales with density/settings.
 */

import { formatDateRange, formatPartialDate } from "@/lib/resume/dates";
import type {
  CertificationEntry,
  Contact,
  CustomEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeDocument,
  Section,
  SectionType,
  Settings,
  SkillGroup,
  StandardSectionType,
} from "@/lib/resume/schema";

/* -------------------------------------------------------------------------- */
/* Block types                                                                 */
/* -------------------------------------------------------------------------- */

interface BlockHints {
  /** Never let this block be the last thing on a page — pull it toward what follows. */
  keepWithNext?: boolean;
  /** Never split this block's own content across a page boundary. */
  keepTogether?: boolean;
  /** Points of trailing content this block should reserve room for. */
  minPresenceAhead?: number;
}

export interface ContactBlock extends BlockHints {
  type: "contact";
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
}

export interface SectionHeadingBlock extends BlockHints {
  type: "sectionHeading";
  sectionId: string;
  sectionType: SectionType;
  label: string;
}

export interface SummaryBlock extends BlockHints {
  type: "summary";
  sectionId: string;
  text: string;
}

export interface ExperienceEntryBlock extends BlockHints {
  type: "experienceEntry";
  sectionId: string;
  entryId: string;
  title: string;
  organization: string;
  location: string;
  dateLabel: string;
  /** Embedded so header + first bullet form one atomic block (rule 2). */
  firstBullet: string | null;
}

export interface EducationEntryBlock extends BlockHints {
  type: "educationEntry";
  sectionId: string;
  entryId: string;
  institution: string;
  credential: string;
  field: string;
  location: string;
  dateLabel: string;
  result: string;
  firstBullet: string | null;
}

export interface ProjectEntryBlock extends BlockHints {
  type: "projectEntry";
  sectionId: string;
  entryId: string;
  name: string;
  role: string;
  url: string;
  dateLabel: string | null;
  firstBullet: string | null;
}

export interface CertificationEntryBlock extends BlockHints {
  type: "certificationEntry";
  sectionId: string;
  entryId: string;
  name: string;
  issuer: string;
  dateLabel: string | null;
  credentialId: string;
  url: string;
}

export interface CustomEntryBlock extends BlockHints {
  type: "customEntry";
  sectionId: string;
  entryId: string;
  title: string;
  subtitle: string;
  dateLabel: string | null;
  firstBullet: string | null;
}

export interface SkillGroupBlock extends BlockHints {
  type: "skillGroup";
  sectionId: string;
  groupId: string;
  label: string;
  skills: string[];
}

export interface BulletBlock extends BlockHints {
  type: "bullet";
  sectionId: string;
  entryId: string;
  text: string;
}

export type DocumentBlock =
  | ContactBlock
  | SectionHeadingBlock
  | SummaryBlock
  | ExperienceEntryBlock
  | EducationEntryBlock
  | ProjectEntryBlock
  | CertificationEntryBlock
  | CustomEntryBlock
  | SkillGroupBlock
  | BulletBlock;

/** Section headings emit these exact strings — the ones ATS parsers pattern-match on. */
export const STANDARD_SECTION_LABELS: Readonly<Record<StandardSectionType, string>> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

/* -------------------------------------------------------------------------- */
/* Bullet splitting — rules 2, 3, 4                                           */
/* -------------------------------------------------------------------------- */

/**
 * Space (in points) reserved ahead of the block preceding a role's final
 * bullet, so the wrapping algorithm keeps them together rather than
 * stranding the final bullet alone on the next page. Scaled to the resume's
 * own text metrics so it tracks density/font-size settings; the multiplier
 * is a deliberately generous single-line estimate; M4-T3 owns precise fit.
 */
function orphanGuardPoints(settings: Settings): number {
  return settings.fontSizePt * settings.lineHeight * 1.5;
}

interface BulletSplit {
  /** Embedded into the header block per rule 2; null when the entry has no bullets. */
  firstBullet: string | null;
  /** Every bullet after the first, as standalone keepTogether blocks. */
  bulletBlocks: BulletBlock[];
  /** Set on the header block when there is exactly one remaining bullet (rule 4). */
  headerMinPresenceAhead?: number;
}

/**
 * Blank bullets are a normal editing state in the schema (a fresh entry
 * starts with one empty string), but rendering an empty bullet line in an
 * export is never correct — it would emit a bare "•" with nothing after it.
 * Filtering happens here, once, so every emitter sees only real content.
 */
function splitBullets(
  sectionId: string,
  entryId: string,
  rawBullets: readonly string[],
  settings: Settings,
): BulletSplit {
  const bullets = rawBullets.map((b) => b.trim()).filter((b) => b.length > 0);
  if (bullets.length === 0) return { firstBullet: null, bulletBlocks: [] };

  const [first, ...rest] = bullets;
  // Unreachable given the length check above; narrows `first` from
  // `string | undefined` under noUncheckedIndexedAccess.
  if (first === undefined) return { firstBullet: null, bulletBlocks: [] };

  const bulletBlocks: BulletBlock[] = rest.map((text) => ({
    type: "bullet",
    sectionId,
    entryId,
    text,
    keepTogether: true,
  }));

  if (bulletBlocks.length === 0) {
    // The only bullet is already fused into the header block — nothing
    // further can orphan within this entry.
    return { firstBullet: first, bulletBlocks };
  }

  if (bulletBlocks.length === 1) {
    // One bullet stands between the header-group and the page break; guard
    // the header-group itself so the pair moves together.
    return {
      firstBullet: first,
      bulletBlocks,
      headerMinPresenceAhead: orphanGuardPoints(settings),
    };
  }

  const penultimate = bulletBlocks[bulletBlocks.length - 2];
  if (penultimate) penultimate.minPresenceAhead = orphanGuardPoints(settings);
  return { firstBullet: first, bulletBlocks };
}

/* -------------------------------------------------------------------------- */
/* Per-entry block builders                                                   */
/* -------------------------------------------------------------------------- */

function buildExperienceEntry(
  sectionId: string,
  entry: ExperienceEntry,
  settings: Settings,
): DocumentBlock[] {
  const { firstBullet, bulletBlocks, headerMinPresenceAhead } = splitBullets(
    sectionId,
    entry.id,
    entry.bullets,
    settings,
  );
  const header: ExperienceEntryBlock = {
    type: "experienceEntry",
    sectionId,
    entryId: entry.id,
    title: entry.title,
    organization: entry.organization,
    location: entry.location,
    dateLabel: formatDateRange(entry.dates),
    firstBullet,
    keepTogether: true,
    ...(headerMinPresenceAhead !== undefined ? { minPresenceAhead: headerMinPresenceAhead } : {}),
  };
  return [header, ...bulletBlocks];
}

function buildEducationEntry(
  sectionId: string,
  entry: EducationEntry,
  settings: Settings,
): DocumentBlock[] {
  const { firstBullet, bulletBlocks, headerMinPresenceAhead } = splitBullets(
    sectionId,
    entry.id,
    entry.bullets,
    settings,
  );
  const header: EducationEntryBlock = {
    type: "educationEntry",
    sectionId,
    entryId: entry.id,
    institution: entry.institution,
    credential: entry.credential,
    field: entry.field,
    location: entry.location,
    dateLabel: formatDateRange(entry.dates),
    result: entry.result,
    firstBullet,
    keepTogether: true,
    ...(headerMinPresenceAhead !== undefined ? { minPresenceAhead: headerMinPresenceAhead } : {}),
  };
  return [header, ...bulletBlocks];
}

function buildProjectEntry(
  sectionId: string,
  entry: ProjectEntry,
  settings: Settings,
): DocumentBlock[] {
  const { firstBullet, bulletBlocks, headerMinPresenceAhead } = splitBullets(
    sectionId,
    entry.id,
    entry.bullets,
    settings,
  );
  const header: ProjectEntryBlock = {
    type: "projectEntry",
    sectionId,
    entryId: entry.id,
    name: entry.name,
    role: entry.role,
    url: entry.url,
    dateLabel: entry.dates ? formatDateRange(entry.dates) : null,
    firstBullet,
    keepTogether: true,
    ...(headerMinPresenceAhead !== undefined ? { minPresenceAhead: headerMinPresenceAhead } : {}),
  };
  return [header, ...bulletBlocks];
}

function buildCustomEntry(
  sectionId: string,
  entry: CustomEntry,
  settings: Settings,
): DocumentBlock[] {
  const { firstBullet, bulletBlocks, headerMinPresenceAhead } = splitBullets(
    sectionId,
    entry.id,
    entry.bullets,
    settings,
  );
  const header: CustomEntryBlock = {
    type: "customEntry",
    sectionId,
    entryId: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    dateLabel: entry.dates ? formatDateRange(entry.dates) : null,
    firstBullet,
    keepTogether: true,
    ...(headerMinPresenceAhead !== undefined ? { minPresenceAhead: headerMinPresenceAhead } : {}),
  };
  return [header, ...bulletBlocks];
}

function buildCertificationEntry(
  sectionId: string,
  entry: CertificationEntry,
): CertificationEntryBlock {
  return {
    type: "certificationEntry",
    sectionId,
    entryId: entry.id,
    name: entry.name,
    issuer: entry.issuer,
    dateLabel: entry.issued ? formatPartialDate(entry.issued) : null,
    credentialId: entry.credentialId,
    url: entry.url,
    keepTogether: true,
  };
}

function buildSkillGroup(sectionId: string, group: SkillGroup): SkillGroupBlock | null {
  const skills = group.skills.map((s) => s.trim()).filter((s) => s.length > 0);
  const label = group.label.trim();
  if (skills.length === 0 && label.length === 0) return null;
  return {
    type: "skillGroup",
    sectionId,
    groupId: group.id,
    label: group.label,
    skills,
    keepTogether: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Section and document assembly                                              */
/* -------------------------------------------------------------------------- */

function sectionHeadingLabel(section: Section): string {
  return section.type === "custom" ? section.label : STANDARD_SECTION_LABELS[section.type];
}

function sectionBodyBlocks(section: Section, settings: Settings): DocumentBlock[] {
  switch (section.type) {
    case "summary": {
      const text = section.content.trim();
      if (text.length === 0) return [];
      const body: SummaryBlock = { type: "summary", sectionId: section.id, text };
      return [body];
    }
    case "experience":
      return section.entries.flatMap((e) => buildExperienceEntry(section.id, e, settings));
    case "education":
      return section.entries.flatMap((e) => buildEducationEntry(section.id, e, settings));
    case "skills":
      return section.groups.map((g) => buildSkillGroup(section.id, g)).filter((b) => b !== null);
    case "projects":
      return section.entries.flatMap((e) => buildProjectEntry(section.id, e, settings));
    case "certifications":
      return section.entries.map((e) => buildCertificationEntry(section.id, e));
    case "custom":
      return section.entries.flatMap((e) => buildCustomEntry(section.id, e, settings));
  }
}

/**
 * A visible section with no content emits nothing at all — not even its
 * heading. A bare heading with nothing beneath it is wrong in the output on
 * its own terms, and it also breaks rule 1: with no following block to be
 * kept with, the heading can end a page. Telling the user their section is
 * empty is the lint engine's job (M0-T11, "empty visible section"), not the
 * renderer's.
 */
function buildSectionBlocks(section: Section, settings: Settings): DocumentBlock[] {
  const body = sectionBodyBlocks(section, settings);
  if (body.length === 0) return [];

  const heading: SectionHeadingBlock = {
    type: "sectionHeading",
    sectionId: section.id,
    sectionType: section.type,
    label: sectionHeadingLabel(section),
    keepWithNext: true,
  };
  return [heading, ...body];
}

function buildContactBlock(contact: Contact): ContactBlock {
  return {
    type: "contact",
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    links: contact.links.map((l) => ({ label: l.label, url: l.url })),
  };
}

/** Turns a resume into the flat, ordered block list every emitter renders from. */
export function buildDocument(resume: ResumeDocument): DocumentBlock[] {
  const blocks: DocumentBlock[] = [buildContactBlock(resume.contact)];
  for (const section of resume.sections) {
    if (section.visible) blocks.push(...buildSectionBlocks(section, resume.settings));
  }
  return blocks;
}
