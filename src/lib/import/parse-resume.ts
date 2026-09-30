/**
 * Reading an existing resume into a `ResumeDocument` (P31-A2).
 *
 * The single largest onboarding gap: every competitor accepts a PDF or DOCX
 * and prefills their wizard, while we — owning the whole extraction layer
 * that solves it — accepted JSON Resume and nothing else.
 *
 * ## Everything here is reuse
 *
 * Extraction is `lib/xray/extract-browser.ts`, already written and already
 * proven against seven fixtures. Contact recovery is `recoverFields` from
 * `lib/xray/scorecard.ts` — name, email and a libphonenumber-validated phone
 * are a solved problem and re-solving them would produce a second, worse
 * answer. Heading detection is `./headings.ts`, which is the JD parser's
 * shape-first heuristic re-applied. Dates are `./dates.ts`. Entries are
 * built by the constructors in `lib/resume/factory.ts` so ids are generated
 * the one way the store expects.
 *
 * ## The result is a report, not just a document
 *
 * Import is lossy and there is no version of it that is not. A PDF does not
 * contain the URL behind a link's anchor text; a resume that writes
 * `03/04/2023` does not say whether that is March or April; a two-column
 * layout can interleave. Handing back a document alone would present every
 * one of those guesses as fact.
 *
 * So `parseResumeFile` returns a per-field confidence report beside the
 * document, and the review surface (`components/builder/ImportReview.tsx`)
 * shows it before the user trusts anything. Not overstating what we know is
 * the entire product position — it is the same argument D14 makes about ATS
 * claims, applied to our own parser.
 *
 * ## What it will not do
 *
 * No model is called and nothing is invented. A field we could not read is
 * reported empty, never filled with a plausible guess. Every string in the
 * output document came from the user's own file.
 */

import {
  extractDocxBrowser,
  extractDocxStructure,
  extractPdfGeometric,
  type ExtractedDocument,
  type ExtractionStrategy,
} from "@/lib/xray/extract-browser";
import { recoverFields } from "@/lib/xray/scorecard";
import {
  classifyHeading,
  docxHeadingLevel,
  headingKindOf,
  headingStrength,
  normalizeHeading,
} from "./headings";
import type { HeadingKind } from "./headings";
import { TRAILING_RESULT, findDateRange, findEntryDate, findSingleDate } from "./dates";
import {
  createCertificationEntry,
  createCustomEntry,
  createEducationEntry,
  createExperienceEntry,
  createId,
  createProjectEntry,
  createSkillGroup,
} from "@/lib/resume/factory";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  isValidUrl,
  type ContactLink,
  type CustomSection,
  type ResumeDocument,
  type Section,
} from "@/lib/resume/schema";

import type { ImportKind } from "./kind";
export type { ImportKind } from "./kind";

/**
 * How much the parser is willing to stand behind a field.
 *
 * `high` — the source stated it structurally, or it was validated
 * independently (an email that matches, a phone libphonenumber accepts).
 * `medium` — recovered by a heuristic that is right on the layouts we have
 * seen. `low` — recovered, but the source was genuinely ambiguous; the user
 * is being asked, not told.
 */
export type ImportConfidence = "high" | "medium" | "low";

export interface ImportFieldReport {
  /** Human-readable, e.g. "Role 1 — organisation". */
  field: string;
  /** The builder step that fixes it, so the review can link straight there. */
  stepId: string;
  confidence: ImportConfidence;
  /** What was recovered. Null means nothing was, and the field is empty. */
  value: string | null;
  /** One line saying why the confidence is what it is. */
  note: string;
}

export interface ImportResult {
  document: ResumeDocument;
  /** Per-field confidence, ordered as the builder's steps are. */
  fields: ImportFieldReport[];
  /** Whole-file observations that belong to no single field. */
  warnings: string[];
  strategy: ExtractionStrategy;
  /** The plain text the parse worked from — the evidence for all of it. */
  text: string;
}

/** One source line, from either format, after the format-specific part. */
interface SourceLine {
  text: string;
  isBullet: boolean;
  /** Set only when the *source* declared it — a DOCX heading style. */
  declared: HeadingKind | null;
}

interface SourceSection {
  kind: HeadingKind;
  label: string;
  lines: SourceLine[];
}

/* -------------------------------------------------------------------------- */
/* Entry points                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reads a resume file. Runs entirely in the caller's process — in the
 * browser that means nothing is uploaded, which is what lets `/check` promise
 * it (D6, and §2.2's privacy requirement).
 */
export async function parseResumeFile(bytes: Uint8Array, kind: ImportKind): Promise<ImportResult> {
  if (kind === "docx") {
    let paragraphs;
    try {
      paragraphs = extractDocxStructure(bytes);
    } catch {
      throw new Error(
        "That file could not be read as a Word document. A .docx is a zip archive; a renamed " +
          ".doc or .pages file is not one.",
      );
    }
    if (paragraphs.length === 0) {
      throw new Error("That Word document has no readable text in its body.");
    }
    return parseSourceLines(docxSourceLines(paragraphs), extractDocxBrowser(bytes));
  }

  // pdfjs reports a broken file with a message written for a developer
  // ("Invalid PDF structure"). The person who dropped the file in needs to
  // know what to do about it, so the low-level message is replaced rather
  // than surfaced.
  let extracted;
  try {
    extracted = await extractPdfGeometric(bytes);
  } catch {
    throw new Error(
      "That file could not be read as a PDF. If it opens elsewhere, try exporting it again from " +
        "the program that made it.",
    );
  }

  if (extracted.lines.length === 0) {
    throw new Error(
      "No text could be read from that PDF. A scanned or image-only resume has no text layer — " +
        "which is also why an applicant tracking system cannot read it.",
    );
  }
  return parseSourceLines(pdfSourceLines(extracted.lines), extracted);
}

/**
 * The parse, given plain lines rather than a file.
 *
 * Exported for the layouts neither of our emitters produces: a third-party
 * resume cannot be committed as a fixture — republishing someone else's
 * resume is the same copyright problem `QA.md` already refuses for job
 * postings — so the honest substitute is a *structural* fixture written as
 * lines. It is the same code path a real file takes, minus the extraction
 * that has its own tests.
 */
export function parseResumeLines(lines: readonly string[]): ImportResult {
  const text = lines.join("\n");
  return parseSourceLines(pdfSourceLines(lines), {
    strategy: "pdf-geometric",
    lines: [...lines],
    text,
    pageCount: 0,
  });
}

/** Moved to `kind.ts`, which costs nothing to import; re-exported here. */
export { importKindFromFilename } from "./kind";

/* -------------------------------------------------------------------------- */
/* Format-specific: lines in, `SourceLine[]` out                               */
/* -------------------------------------------------------------------------- */

/**
 * A list marker at the start of an extracted line, followed by a space.
 *
 * It was `[•·▪◦‣*]`, and every marker it missed cost the entry its first
 * bullet: an unmarked line under a role is read as the role's meta line —
 * employer, location — and the next unmarked line after it starts the
 * bullets. So a Google Docs export, whose bullets extract as "●", lost the
 * first bullet of every role, silently, and so did plain text written with
 * "-". Found by the keyword scanner reporting "Python — missing" for a resume
 * whose first bullet named it (2026-09-28).
 *
 * Added: the circles, squares and arrows word processors use, a check mark,
 * and an ASCII hyphen. **Not** the en or em dash: a date range that wraps
 * extracts as "Jan 2022" then "– Present", and reading that continuation as a
 * bullet would take the role's end date with it. Pasted text has no wrapped
 * dates, so `parseResumeText` accepts dashes there.
 */
const PDF_BULLET =
  /^\s*(?:[•·▪◦‣*●○■□►▸➢➤✓✔∙▪■⁃-]|[\u0080-\u009F-]|[xovqnly§Øü¨](?=\s+[\p{Lu}\d]))\s+/u;

/*
 * The second and third alternatives were added on 2026-09-30, from twenty
 * real resumes made in Word (QA.md §7). Word draws its default bullets in the
 * Symbol and Wingdings fonts, whose glyphs have no honest Unicode, and a PDF
 * built from them extracts each bullet as whatever the font's table says:
 * a C1 control character (U+0087, U+0099, U+0083), a private-use code point
 * (U+F0B7), or a plain letter — Wingdings' round bullet comes out as "x",
 * and it began 423 of the lines in that set. Only `•` was recognised, so
 * every one of those bullets read as a paragraph. A letter counts as a
 * bullet only when a capital or a digit follows it after a space: "x Managed
 * the rota", never "x-ray" or a sentence that happens to start with "o".
 */

/** A line that is nothing but a rule typed with underscores, dashes or equals signs. */
const RULE_LINE = /^[\s_=\-–—]{5,}$/;

/**
 * Markers a person types that a PDF never produces unambiguously: a dash, or
 * a number. Rewritten to "•" before parsing pasted text — see `PDF_BULLET`
 * for why the dashes are not accepted in extracted lines.
 */
const TYPED_MARKER = /^\s*(?:[–—]|\(?\d{1,2}[.)])\s+/;

/**
 * A resume pasted as plain text — the keyword scanner's input.
 *
 * The same parse a file gets, with the typed list markers normalised first.
 */
export function parseResumeText(text: string): ImportResult {
  return parseResumeLines(
    text
      .split(/\r?\n/)
      .map((line) => (TYPED_MARKER.test(line) ? line.replace(TYPED_MARKER, "• ") : line)),
  );
}

function pdfSourceLines(lines: readonly string[]): SourceLine[] {
  return lines
    .filter((line) => !RULE_LINE.test(line))
    .map((line) => {
      const isBullet = PDF_BULLET.test(line);
      // "Objective ______________" — a heading with its rule typed after it.
      const text = (isBullet ? line.replace(PDF_BULLET, "") : line).replace(/[\s_]{4,}$/, "");
      return { text: text.trim(), isBullet, declared: null };
    });
}

/**
 * The DOCX path, where the file states its own structure.
 *
 * The shallowest heading level present is taken as the section level. Our
 * own emitter sets sections as `Heading1` and entry headings as `Heading2`,
 * so without this every job title would start a new section; a foreign
 * document that uses `Heading2` throughout and no `Heading1` still works,
 * because "shallowest present" is relative to the document rather than to a
 * fixed number.
 */
function docxSourceLines(
  paragraphs: readonly { style: string; text: string; isListItem: boolean }[],
): SourceLine[] {
  const levels = paragraphs
    .map((p) => docxHeadingLevel(p.style))
    .filter((level): level is number => level !== null);
  const sectionLevel = levels.length > 0 ? Math.min(...levels) : null;

  return paragraphs.map((p) => {
    const level = docxHeadingLevel(p.style);
    const declared =
      level !== null && level === sectionLevel
        ? (classifyHeading(p.text) ?? "custom")
        : /^(title|name)$/i.test(p.style.replace(/\s+/g, ""))
          ? "contact"
          : null;

    return { text: p.text.trim(), isBullet: p.isListItem, declared };
  });
}

/* -------------------------------------------------------------------------- */
/* Splitting into sections                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Everything before the first section heading is the contact block. That is
 * not a guess about this document — it is where every resume format puts it,
 * and it is what our own lint engine tells users to do.
 */
function splitSections(lines: readonly SourceLine[]): {
  header: SourceLine[];
  sections: SourceSection[];
} {
  const header: SourceLine[] = [];
  const sections: SourceSection[] = [];

  lines.forEach((line, index) => {
    const declared = line.declared;
    // `contact` on a DOCX name paragraph is a label for the header block, not
    // a section of its own: starting a section there would leave the header
    // empty and the contact details inside a section nobody reads for them.
    const kind: HeadingKind | null =
      declared === "contact" ? null : (declared ?? headingKindOf(line.text));

    // A *weak* heading immediately followed by a dated line is an entry, not
    // a section: "Projects Lead" above "Acme Corp, Jan 2020 – Present" reads
    // as a heading by shape and is a job title in fact. A strong one is not
    // second-guessed — "EXPERIENCE" above a dated role is the shape our own
    // PDF emits and the commonest shape there is. And a heading the source
    // *declared* is never a guess at all.
    const next = lines[index + 1];
    const looksLikeEntry =
      declared === null &&
      headingStrength(line.text) === "weak" &&
      next !== undefined &&
      findDateRange(next.text) !== null;

    // The first line of a resume is the candidate's name, and a name set in
    // capitals passes every heading test there is. Starting a section on it
    // leaves the contact block empty and the name inside a section nobody
    // reads for it — so the first line has to *classify* to count.
    const isFirstContentLine = sections.length === 0 && header.length === 0;
    const unrecognisedFirstLine = isFirstContentLine && classifyHeading(line.text) === null;

    if (kind !== null && !looksLikeEntry && !unrecognisedFirstLine) {
      sections.push({ kind, label: normalizeHeading(line.text), lines: [] });
      return;
    }

    const current = sections[sections.length - 1];
    if (current) current.lines.push(line);
    else header.push(line);
  });

  return { header, sections };
}

/* -------------------------------------------------------------------------- */
/* Shared line surgery                                                         */
/* -------------------------------------------------------------------------- */

/** Separators a resume uses between two fields on one line. Comma is absent
 *  deliberately: "Engineer, Platform" is one title, not two fields. */
const FIELD_SEPARATOR = /\s+(?:[|·•—–]|-{1,2}|\bat\b)\s+/;

function splitFields(text: string): string[] {
  return text
    .split(FIELD_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * A trailing "City, Region", separated off from whatever precedes it.
 *
 * Both emitters put the location at the end of an entry's meta line, but
 * with different separators — DOCX joins with ", " and the PDF sets it at a
 * right tab stop, which extraction flattens to a single space. Matching the
 * *location* rather than the separator handles both, and handles the foreign
 * resumes that use neither.
 *
 * Greedy on the left on purpose: "Contoso Payments, Barcelona, Spain" must
 * split after "Payments", and a lazy left side splits after "Contoso" —
 * taking "Payments, Barcelona" as the location and the organisation with it.
 */
const TRAILING_LOCATION =
  /^(.*[^\s,])[,\s]\s*(\p{Lu}[\p{L}.'-]*(?:\s+[\p{L}.'-]+){0,2},\s*\p{Lu}[\p{L}.'-]*(?:\s+[\p{L}.'-]+){0,2})$/u;

/**
 * The same, when a comma stands before the city: "Seton Hall University, South
 * Orange, NJ". Tried first, because a comma is the one separator that says
 * where the city starts — the greedy match above, left to itself, splits
 * after "South" and takes a two-word city for a one-word one (QA.md §7).
 * Our own PDF sets the location at a tab stop with no comma before it, which
 * this does not match, so that shape still reaches the rule above.
 */
const TRAILING_LOCATION_AFTER_COMMA =
  /^(.*[^\s,])\s*,\s*(\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}[\p{L}.'-]*){0,2},\s*\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}[\p{L}.'-]*){0,2})$/u;

function splitTrailingLocation(text: string): { rest: string; location: string } {
  const match =
    TRAILING_LOCATION_AFTER_COMMA.exec(text.trim()) ?? TRAILING_LOCATION.exec(text.trim());
  if (!match) return { rest: text.trim(), location: "" };
  return { rest: (match[1] ?? "").replace(/[,\s]+$/, ""), location: (match[2] ?? "").trim() };
}

/** True for a line that names an institution rather than a credential. */
const INSTITUTION = /\b(universit\w*|college|institute|school|academy|polytechnic|iit|nit|iiit)\b/i;
/*
 * `universit\w*`, not `universit`: with a word boundary straight after it the
 * old pattern needed the word to *end* at "universit", so "University" never
 * matched and every university in every imported resume was read as
 * something else — only colleges, schools and institutes were recognised.
 * Found by QA #7 on 2026-09-30.
 */

/** True for a line that names a credential rather than an institution. */
const CREDENTIAL =
  /\b(b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|b\.?sc|m\.?sc|b\.?a\.?|m\.?a\.?|bs|ms|ba|ma|mba|bca|mca|ph\.?d|doctorate|bachelor|master|diploma|certificate|associate|hsc|ssc|high school)\b|(?:^|[\s(])(b\.s\.|m\.s\.|m\.b\.a\.?|b\.b\.a\.?|b\.?\s?com|m\.?\s?com|b\.?\s?ed|m\.?\s?ed|ms\.?\s?ed|ll\.?\s?b|ll\.?\s?m|m\.?b\.?b\.?s|b\.?d\.?s|b\.?\s?pharm|m\.?\s?pharm|b\.?\s?arch|b\.?\s?des|pgdm|pgdba|gnm|anm|(?:class|std\.?|standard)\s*(?:x|xii|10|12)(?:th)?|(?:10|12)th|sslc|puc|intermediate|matriculation)(?=[\s,.:;)]|$)/i;
/*
 * The second half, added 2026-09-30: dotted US degrees ("B.S.", "M.S.",
 * "M.B.A."), which the word-bounded half cannot see because a dot is not a
 * word character — three of twenty real resumes had their degree read as
 * the institution for it (QA.md §7) — and the Indian credentials the India
 * examples themselves use: B.Com, M.Com, B.Ed, MBBS, PGDM, GNM, Class 10 and
 * 12, SSLC, PUC.
 */

const URL_IN_TEXT = /https?:\/\/[^\s|,;]+|\bwww\.[^\s|,;]+/gi;

/* -------------------------------------------------------------------------- */
/* The parse                                                                   */
/* -------------------------------------------------------------------------- */

function parseSourceLines(lines: SourceLine[], extracted: ExtractedDocument): ImportResult {
  const { header, sections } = splitSections(lines);
  const fields: ImportFieldReport[] = [];
  const warnings: string[] = [];

  const contact = parseContact(header, fields, warnings);

  // Sections are built in the builder's own order rather than the source's,
  // so an imported resume opens looking like every other resume in the app.
  // The user reorders from `SectionManager` if they want the source's order.
  const built: Section[] = [];
  const customSections: CustomSection[] = [];

  const merged = mergeSections(sections);

  built.push({
    id: createId(),
    type: "summary",
    visible: true,
    content: parseSummary(merged.get("summary") ?? []),
  });
  built.push({
    id: createId(),
    type: "experience",
    visible: true,
    entries: parseExperience(merged.get("experience") ?? [], fields),
  });
  built.push({
    id: createId(),
    type: "education",
    visible: true,
    entries: parseEducation(merged.get("education") ?? []),
  });
  built.push({
    id: createId(),
    type: "skills",
    visible: true,
    groups: parseSkills(merged.get("skills") ?? []),
  });
  built.push({
    id: createId(),
    type: "projects",
    visible: true,
    entries: parseProjects(merged.get("projects") ?? []),
  });
  built.push({
    id: createId(),
    type: "certifications",
    visible: true,
    entries: parseCertifications(merged.get("certifications") ?? []),
  });

  for (const section of sections) {
    if (section.kind !== "custom") continue;
    const entries = parseCustomEntries(section.lines);
    if (entries.length === 0) continue;
    customSections.push({
      id: createId(),
      type: "custom",
      visible: true,
      label: section.label.slice(0, 60),
      entries,
    });
  }

  if (sections.length === 0) {
    warnings.push(
      "No section headings were found, so everything below the contact details was left " +
        "unassigned. Check the extracted text below against your file.",
    );
  }

  const document: ResumeDocument = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact,
    sections: [...built, ...customSections],
    settings: { ...DEFAULT_SETTINGS },
  };

  return { document, fields, warnings, strategy: extracted.strategy, text: extracted.text };
}

/** Two "Experience" headings in one resume are one section's worth of lines. */
function mergeSections(sections: readonly SourceSection[]): Map<HeadingKind, SourceLine[]> {
  const merged = new Map<HeadingKind, SourceLine[]>();
  for (const section of sections) {
    if (section.kind === "custom") continue;
    const existing = merged.get(section.kind);
    if (existing) existing.push(...section.lines);
    else merged.set(section.kind, [...section.lines]);
  }
  return merged;
}

/* -------------------------------------------------------------------------- */
/* Contact                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A "City, Region" closing one field of the contact block, with an optional
 * ZIP or PIN after it. Spaces only, never newlines: the pattern that allowed
 * `\s` matched across lines, and on real resumes it returned the name line
 * joined to the city beneath it — "Patricia Pediatrics\nPhiladelphia, PA"
 * (QA.md §7).
 */
const LOCATION_FIELD =
  /(\p{Lu}[\p{L}.'-]*(?:[ ]\p{Lu}[\p{L}.'-]*){0,2}),[ ]*(\p{Lu}[\p{L}.'-]*(?:[ ]\p{Lu}[\p{L}.'-]*){0,2})(?:[ ]+\d{5,6}(?:-\d{4})?)?$/u;

/** A street address ahead of the city: "4004 Helix Lane", "302 East John Street #1904". */
const STREET_PREFIX =
  /^\d+[\w/-]*\s+(?:.*?\b(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|way|court|ct|place|pl|terrace|circle|parkway|pkwy|highway|hwy|nagar|marg|colony|sector|block|layout|cross|main)\b\.?,?\s*)(?:(?:apt|apartment|suite|unit|flat)\.?\s*\S+\s*|#\s*\S+\s*)?/i;

/** "Current Address:", "Permanent address -" — a label before the place. */
const ADDRESS_LABEL = /^(?:(?:current|permanent|home|present|mailing)\s+)?address\s*[:–—-]?\s*/i;

/**
 * The candidate's city, from the contact block, field by field.
 *
 * A contact line is several fields joined by separators — "Philadelphia, PA ●
 * name@school.edu ● (215) 567-8910" — so each field is judged alone, with the
 * name, email addresses, URLs, address labels and street addresses taken out
 * first. Returns "" when nothing is shaped like a place, which the review
 * then reports as missing rather than filled with a guess.
 */
function findLocation(lines: readonly string[], name: string | null): string {
  for (const line of lines) {
    const withoutName = name && line.startsWith(name) ? line.slice(name.length) : line;
    const cleaned = withoutName.replace(/\S+@\S+/g, " ").replace(URL_IN_TEXT, " ");
    for (const raw of cleaned.split(/\s*[|•●·◆♦▪]\s*|\s{2,}/)) {
      let field = raw.trim().replace(ADDRESS_LABEL, "");
      if (field.length === 0) continue;
      if (/^\d/.test(field)) field = field.replace(STREET_PREFIX, "").trim();
      const match = LOCATION_FIELD.exec(field);
      if (match) return `${match[1]}, ${match[2]}`;
    }
  }
  return "";
}

function parseContact(
  header: readonly SourceLine[],
  fields: ImportFieldReport[],
  warnings: string[],
): ResumeDocument["contact"] {
  const lines = header.map((l) => l.text).filter((t) => t.length > 0);
  const text = lines.join("\n");

  // The one place the whole X-Ray recovery layer is reused wholesale: name,
  // email and a libphonenumber-validated phone are already solved there, and
  // a second implementation here would be a second, worse answer.
  const recovered = recoverFields({
    strategy: "pdf-geometric",
    lines,
    text,
    pageCount: 0,
  });

  const name = recovered.name ?? fallbackName(lines);
  fields.push({
    field: "Name",
    stepId: "contact",
    confidence: recovered.name ? "high" : name ? "low" : "low",
    value: name,
    note: recovered.name
      ? "Read from the first line, which is where every parser looks for it."
      : name
        ? "The first line looked like contact detail, so this is the first line that did not."
        : "No line at the top of the file looked like a name.",
  });

  fields.push({
    field: "Email",
    stepId: "contact",
    confidence: recovered.email ? "high" : "low",
    value: recovered.email,
    note: recovered.email ? "Matched an email address exactly." : "No email address was found.",
  });

  fields.push({
    field: "Phone",
    stepId: "contact",
    confidence: recovered.phone ? "high" : "low",
    value: recovered.phone,
    note: recovered.phone
      ? "Validated as a real number, not just a run of digits."
      : "No line parsed as a valid phone number.",
  });

  // The location is matched by its shape rather than its position, because
  // the two formats put it in different places on the contact line.
  const location = findLocation(lines, name);
  fields.push({
    field: "Location",
    stepId: "contact",
    confidence: location ? "medium" : "low",
    value: location || null,
    note: location
      ? "Matched a “City, Region” pair in the contact block. Check it is the right one."
      : "No “City, Region” pair was found in the contact block.",
  });

  const links = parseLinks(lines);
  if (links.length === 0 && /linkedin|github|portfolio|website/i.test(text)) {
    // A PDF stores a link's target in an annotation, not in the text layer,
    // so anchor text survives extraction and the URL behind it does not.
    warnings.push(
      "Your file mentions links but the addresses behind them are not part of the text a " +
        "parser reads. Add the URLs on the Contact step.",
    );
  }

  return {
    fullName: (name ?? "").slice(0, 120),
    email: (recovered.email ?? "").slice(0, 160),
    phone: (recovered.phone ?? "").slice(0, 40),
    location: location.slice(0, 120),
    links,
  };
}

function fallbackName(lines: readonly string[]): string | null {
  for (const line of lines) {
    if (line.length === 0 || line.length > 60) continue;
    if (/@|https?:\/\/|\d/.test(line)) continue;
    if (line.split(/\s+/).length > 5) continue;
    return line;
  }
  return null;
}

function parseLinks(lines: readonly string[]): ContactLink[] {
  const links: ContactLink[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const match of line.matchAll(URL_IN_TEXT)) {
      const raw = match[0].replace(/[.,;)]+$/, "");
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      if (!isValidUrl(url) || seen.has(url)) continue;
      seen.add(url);

      // "LinkedIn: https://…" states its own label; otherwise the host does.
      const before = line.slice(0, match.index ?? 0);
      const labelled = before.match(/([\p{L} ]{2,20})\s*:\s*$/u)?.[1]?.trim();
      links.push({
        id: createId(),
        label: (labelled ?? hostLabel(url)).slice(0, 40),
        url: url.slice(0, 400),
      });
      if (links.length === 8) return links;
    }
  }

  return links;
}

function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const name = host.split(".")[0] ?? host;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Link";
  }
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                     */
/* -------------------------------------------------------------------------- */

function parseSummary(lines: readonly SourceLine[]): string {
  return lines
    .map((l) => l.text)
    .filter((t) => t.length > 0)
    .join(" ")
    .slice(0, 1200);
}

/* -------------------------------------------------------------------------- */
/* Entry-shaped sections                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A section's lines grouped into entries, split at every dated line.
 *
 * A dated non-bullet line is the one reliable entry boundary across every
 * layout we have seen: our own emitters put the date on the entry's first
 * line, and so does essentially every resume template. Lines before the
 * first dated line are kept as a leading group, because the stream-order
 * layout puts the title *above* the date rather than beside it.
 */
interface RawEntry {
  /** The dated line, with the date removed. Empty when the date stood alone. */
  headline: string;
  dated: ReturnType<typeof findDateRange>;
  /** Non-bullet lines between this entry's headline and the next entry. */
  detail: string[];
  /** Lines immediately above the headline, when the headline held no text. */
  above: string[];
  bullets: string[];
}

/**
 * What a graduation or a start date is often introduced by, left behind on
 * the headline once the date itself is cut out of it: "Bachelor of Science in
 * Nursing, expected in May 2023" should leave "Bachelor of Science in Nursing".
 */
const DATE_LEAD_IN =
  /[\s,(]*\b(expected|anticipated|graduating|graduation|completion|completed|since|from)\b(\s+(in|on|by))?[\s,:(]*$/i;

interface GroupOptions {
  /**
   * Whether a plain line should open the *next* entry rather than add to the
   * current one. Education uses it: a second school's name under the first
   * school's degree is the start of the next degree, not a detail of this one.
   */
  leadIn?: (text: string, current: RawEntry) => boolean;
}

function groupEntries(lines: readonly SourceLine[], options: GroupOptions = {}): RawEntry[] {
  const entries: RawEntry[] = [];
  let pending: string[] = [];

  for (const line of lines) {
    if (line.text.length === 0) continue;

    const dated = line.isBullet ? null : findEntryDate(line.text);
    if (dated) {
      // A grade after the date belongs to the entry, not to its headline:
      // "…, expected December 2023 Cumulative G.P.A.: 3.88/4.00".
      const after = line.text.slice(dated.index + dated.length);
      const grade = TRAILING_RESULT.test(after) ? after.trim().replace(/^[|,–—-]\s*/, "") : "";
      const headline = (line.text.slice(0, dated.index) + (grade ? "" : after))
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s|·•—–-]+|[\s|·•—–-]+$/g, "")
        .replace(DATE_LEAD_IN, "")
        .replace(/[\s,|·•—–-]+$/g, "")
        .trim();
      entries.push({ headline, dated, detail: grade ? [grade] : [], above: pending, bullets: [] });
      pending = [];
      continue;
    }

    const current = entries[entries.length - 1];
    if (!current) {
      pending.push(line.text);
      continue;
    }
    if (line.isBullet) {
      current.bullets.push(line.text);
      continue;
    }
    // A plain line *after* an entry's bullets have started is the next
    // entry's lead-in, not more of this one: the layout that puts the date
    // on its own line writes title, employer, date, bullets — so by the time
    // bullets have been seen, everything unbulleted belongs to what comes
    // next. Before the first bullet it is this entry's own meta line.
    if (current.bullets.length > 0 || pending.length > 0 || options.leadIn?.(line.text, current)) {
      pending.push(line.text);
    } else current.detail.push(line.text);
  }

  // Lines left over after the last entry's bullets never found a date to
  // belong to. They are content, so they stay with the entry above them
  // rather than being dropped or turned into an entry that has no evidence —
  // unless they open with a line the section says starts an entry, in which
  // case they are an undated entry of their own.
  const last = entries[entries.length - 1];
  if (last && pending.length > 0) {
    if (options.leadIn?.(pending[0]!, last)) {
      const [headline, ...detail] = pending;
      entries.push({ headline: headline!, dated: null, detail, above: [], bullets: [] });
    } else {
      last.detail.push(...pending);
    }
    pending = [];
  }

  // A section whose entries carry no dates at all still has content. One
  // undated entry per line beats dropping the section, and the review
  // surface reports the dates as missing rather than inventing them.
  if (entries.length === 0 && pending.length > 0) {
    for (const text of pending) {
      entries.push({ headline: text, dated: null, detail: [], above: [], bullets: [] });
    }
  }

  return entries;
}

/**
 * The entry's title and its supporting line, whichever layout produced it.
 *
 * Geometric extraction puts the title beside the date, so `headline` holds
 * it. Stream order emits the whole left column before the right, so the date
 * stands alone and the title is the line above it — the same two layouts the
 * X-Ray scorecard already models, for the same reason.
 */
function titleAndSupport(entry: RawEntry): { title: string; support: string[] } {
  if (entry.headline.length > 0) {
    return { title: entry.headline, support: entry.detail };
  }

  // Reading order runs title, then organisation, then the date — so the line
  // *nearest* the date is the organisation and the one above it is the
  // title. Taking the nearest as the title is the mistake that hands every
  // role its employer's name as its job title, and it is the same ordering
  // `recoverRoles` in the X-Ray scorecard already models.
  const above = [...entry.above];
  const nearest = above.pop() ?? "";
  const previous = above.pop();
  if (previous === undefined) return { title: nearest, support: entry.detail };
  return { title: previous, support: [nearest, ...above, ...entry.detail] };
}

function parseExperience(
  lines: readonly SourceLine[],
  fields: ImportFieldReport[],
): Extract<Section, { type: "experience" }>["entries"] {
  return groupEntries(lines).map((raw, index) => {
    const { title, support } = titleAndSupport(raw);

    // A headline may carry both fields — "Engineer | Acme" is common — but a
    // comma is never treated as a separator here, so "Engineer, Platform"
    // stays one title.
    const parts = splitFields(title);
    const entry = createExperienceEntry();

    const supportLine = support[0] ?? "";
    const { rest, location } = splitTrailingLocation(supportLine);

    // The employer can lead: "RIVERSIDE HOSPITAL, Columbus, OH  May 2023 –
    // Present" over "Patient Care Technician". Where the city sits says which
    // is which — every layout puts it on the employer's line — so a dated
    // line that ends in a city, over a line that does not, is the employer,
    // and the line under it is the title. Read the other way round, every
    // role in that layout came back with its title and employer swapped
    // (QA.md §7). Our own layout puts the city on the line *under* the title,
    // so it never takes this branch.
    const fromHeadline = splitTrailingLocation(title);
    const employerLeads =
      raw.headline.length > 0 &&
      parts.length === 1 &&
      fromHeadline.location !== "" &&
      supportLine !== "" &&
      location === "";

    if (employerLeads) {
      entry.title = supportLine.slice(0, 140);
      entry.organization = fromHeadline.rest.slice(0, 140);
      entry.location = fromHeadline.location.slice(0, 120);
    } else {
      entry.title = (parts[0] ?? title).slice(0, 140);
      entry.organization = (parts[1] ?? splitFields(rest)[0] ?? rest).slice(0, 140);
      entry.location = location.slice(0, 120);
    }
    entry.bullets = [...support.slice(1), ...raw.bullets].map((b) => b.slice(0, 1000));
    if (raw.dated) entry.dates = raw.dated.range;

    const label = `Role ${index + 1}`;
    fields.push({
      field: `${label} — title`,
      stepId: "experience",
      confidence: entry.title ? "medium" : "low",
      value: entry.title || null,
      note: entry.title
        ? "Taken from the line the dates sit on."
        : "No title was found for this role.",
    });
    fields.push({
      field: `${label} — organisation`,
      stepId: "experience",
      confidence: entry.organization ? "medium" : "low",
      value: entry.organization || null,
      note: entry.organization
        ? "Taken from the line under the title."
        : "No employer line was found under this role.",
    });
    fields.push({
      field: `${label} — dates`,
      stepId: "experience",
      confidence: raw.dated ? (raw.dated.certain ? "high" : "low") : "low",
      value: raw.dated ? describeRange(raw.dated.range) : null,
      note: !raw.dated
        ? "No date range was found on this role."
        : raw.dated.certain
          ? "Both ends parsed as unambiguous dates."
          : "The source wrote the date in a form where the month is ambiguous, so only the " +
            "year was kept. Check it.",
    });

    return entry;
  });
}

function describeRange(range: {
  start: { year: number; month: number | null };
  current: boolean;
  end: { year: number; month: number | null } | null;
}): string {
  const format = (d: { year: number; month: number | null }) =>
    d.month === null ? String(d.year) : `${d.month}/${d.year}`;
  return `${format(range.start)} – ${range.current ? "Present" : range.end ? format(range.end) : "?"}`;
}

/**
 * Education, where the two emitters disagree about which field leads.
 *
 * Our PDF sets the institution on the entry's first line and the credential
 * beneath it; the DOCX does the opposite, because a reader scans for the
 * credential and Word's outline wants the more specific line as the heading.
 * A parser keyed on position would therefore read one of the two backwards.
 *
 * So both lines are classified by *content* — an institution names a
 * university, a credential names a degree — which also happens to be what
 * makes this work on a resume neither of our emitters produced.
 */
function parseEducation(
  lines: readonly SourceLine[],
): Extract<Section, { type: "education" }>["entries"] {
  // A school named while this entry already has one is the next degree
  // starting: "Seton Hall University" / "MS Accounting, May 2023" / "GPA 3.8" /
  // "University of South Florida" / "BS Finance" is two entries, and without
  // this the second school became a detail line of the first (QA.md §7).
  const leadIn = (text: string, current: RawEntry) =>
    INSTITUTION.test(text) &&
    [current.headline, ...current.above, ...current.detail].some((line) => INSTITUTION.test(line));

  return groupEntries(lines, { leadIn }).map((raw) => {
    const { title, support } = titleAndSupport(raw);
    const entry = createEducationEntry();

    // The lines *above* a dated headline count too. "Seton Hall University,
    // South Orange, NJ" over "Master of Science in Accounting, May 2023" is
    // the commonest shape there is: the date sits on the degree line, and
    // the school above it was dropped for not being on that line.
    const above = raw.headline.length > 0 ? raw.above : [];
    const candidates = [...above, title, ...support].filter((t) => t.length > 0);
    let institutionLine = candidates.find((t) => INSTITUTION.test(t));
    let credentialLine = candidates.find((t) => t !== institutionLine && CREDENTIAL.test(t));

    // One line carrying both: "M.B.A. Business Administration, Seton Hall
    // University, South Orange, NJ". Split at the comma before the school, so
    // the degree is the degree and the school is the school.
    if (institutionLine && !credentialLine && CREDENTIAL.test(institutionLine)) {
      const parts = institutionLine.split(/\s*,\s*/);
      const at = parts.findIndex((part) => INSTITUTION.test(part));
      if (at > 0) {
        credentialLine = parts.slice(0, at).join(", ");
        institutionLine = parts.slice(at).join(", ");
      }
    }
    const leftover = candidates.filter(
      (t) => t !== institutionLine && t !== credentialLine && !institutionLine?.startsWith(t),
    );

    const fromCredential = splitTrailingLocation(credentialLine ?? "");
    const fromInstitution = splitTrailingLocation(institutionLine ?? "");

    // "BSc, Computer Science" — the credential leads, the field follows.
    const credentialParts = fromCredential.rest.split(/\s*,\s*/).filter((p) => p.length > 0);

    entry.institution = (fromInstitution.rest || institutionLine || leftover[0] || "").slice(
      0,
      160,
    );
    entry.credential = (credentialParts[0] ?? "").slice(0, 160);
    entry.field = credentialParts.slice(1).join(", ").slice(0, 160);
    entry.location = (fromInstitution.location || fromCredential.location).slice(0, 120);
    entry.result = findResult(candidates).slice(0, 60);
    entry.bullets = raw.bullets.map((b) => b.slice(0, 1000));
    if (raw.dated) entry.dates = raw.dated.range;

    return entry;
  });
}

/** GPA, CGPA, percentage and classification, in the forms resumes write them. */
const RESULT =
  /\b(\d(?:\.\d+)?\s*\/\s*\d(?:\.\d+)?|\d(?:\.\d+)?\s*(?:CGPA|GPA)|(?:CGPA|GPA)\s*:?\s*\d(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s*%|First\s+Class(?:\s+with\s+Distinction)?|Distinction|Merit)\b/i;

function findResult(candidates: readonly string[]): string {
  for (const line of candidates) {
    const match = RESULT.exec(line);
    if (match) return match[0].trim();
  }
  return "";
}

function parseSkills(lines: readonly SourceLine[]): Extract<Section, { type: "skills" }>["groups"] {
  const groups: Extract<Section, { type: "skills" }>["groups"] = [];

  for (const line of lines) {
    if (line.text.length === 0) continue;
    // "Languages & Frameworks: Go, TypeScript" — a labelled group, which is
    // the shape both our emitter and most templates produce.
    const labelled = line.text.match(/^([^:]{1,60}):\s*(.+)$/);
    const group = createSkillGroup(labelled ? (labelled[1] ?? "").trim().slice(0, 60) : "");
    const body = labelled ? (labelled[2] ?? "") : line.text;

    group.skills = body
      .split(/\s*[,;|·•]\s*/)
      .map((s) => s.trim().slice(0, 80))
      .filter((s) => s.length > 0)
      .slice(0, 60);

    if (group.skills.length > 0) groups.push(group);
    if (groups.length === 12) break;
  }

  return groups;
}

function parseProjects(
  lines: readonly SourceLine[],
): Extract<Section, { type: "projects" }>["entries"] {
  return groupEntries(lines).map((raw) => {
    const { title, support } = titleAndSupport(raw);
    const entry = createProjectEntry();
    const parts = splitFields(title);

    const urlLine = support.find((line) => URL_IN_TEXT.test(resetRegex(line)));
    const roleLine = support.find((line) => line !== urlLine);

    entry.name = (parts[0] ?? title).slice(0, 140);
    entry.role = (parts[1] ?? roleLine ?? "").slice(0, 120);
    entry.url = extractUrl(urlLine ?? title).slice(0, 400);
    entry.dates = raw.dated ? raw.dated.range : null;
    entry.bullets = [
      ...support.filter((line) => line !== urlLine && line !== roleLine),
      ...raw.bullets,
    ].map((b) => b.slice(0, 1000));

    return entry;
  });
}

/** `URL_IN_TEXT` is global, so its `lastIndex` has to be cleared before a `test`. */
function resetRegex(line: string): string {
  URL_IN_TEXT.lastIndex = 0;
  return line;
}

function extractUrl(line: string): string {
  URL_IN_TEXT.lastIndex = 0;
  const raw = URL_IN_TEXT.exec(line)?.[0]?.replace(/[.,;)]+$/, "");
  if (!raw) return "";
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return isValidUrl(url) ? url : "";
}

function parseCertifications(
  lines: readonly SourceLine[],
): Extract<Section, { type: "certifications" }>["entries"] {
  return groupEntries(lines).map((raw) => {
    const { title, support } = titleAndSupport(raw);
    const entry = createCertificationEntry();
    const parts = splitFields(title);
    const supportLine = support[0] ?? "";
    const supportParts = splitFields(supportLine);

    entry.name = (parts[0] ?? title).slice(0, 180);
    entry.issuer = (parts[1] ?? supportParts[0] ?? "").slice(0, 140);
    entry.credentialId = (
      supportLine.match(/\b(?:credential\s+)?id\s*:?\s*([\w-]+)/i)?.[1] ?? ""
    ).slice(0, 120);
    entry.url = extractUrl(supportLine).slice(0, 400);

    // A certification carries one date, not a range: it was issued.
    entry.issued = raw.dated
      ? raw.dated.range.start
      : (findSingleDate(title)?.date ?? findSingleDate(supportLine)?.date ?? null);

    return entry;
  });
}

function parseCustomEntries(lines: readonly SourceLine[]): CustomSection["entries"] {
  const raws = groupEntries(lines);

  return raws.map((raw) => {
    const { title, support } = titleAndSupport(raw);
    const entry = createCustomEntry();
    entry.title = title.slice(0, 160);
    entry.subtitle = (support[0] ?? "").slice(0, 160);
    entry.dates = raw.dated ? raw.dated.range : null;
    entry.bullets = [...support.slice(1), ...raw.bullets].map((b) => b.slice(0, 1000));
    return entry;
  });
}
