/**
 * The plain-text emitter (M0-T6).
 *
 * Purpose is narrow and concrete: text a user can paste into an application
 * form's textarea and have arrive intact. That rules out every kind of
 * decoration — no box drawing, no column alignment via padding, no Unicode
 * ornamentation — because all of it either wraps badly in a fixed-width
 * textarea or arrives as mojibake through a form post.
 *
 * It also serves as the canonical extraction target for tests: the DOCX
 * emitter's acceptance criterion is that `mammoth` recovers the same words
 * in the same order that this emitter writes. Both share the composition in
 * `lib/emit/shared/entry-lines.ts` so they cannot drift apart.
 *
 * ## The ASCII rule
 *
 * Everything *we* inject is ASCII. Characters the user typed pass through
 * untouched — a name is not ours to transliterate, and mangling "José" into
 * "Jose" in the body would be a correctness bug, not a safety measure.
 * (M0-T12 transliterates for the download *filename* only, a different
 * problem with a different answer.)
 *
 * The one place this needs active work is date labels. `formatDateRange`
 * uses an en dash, typographically right for PDF and DOCX but not ASCII.
 * Date labels are generated entirely by us from structured data, so folding
 * the separator there is safe and touches no user-entered text.
 *
 * ## `headerStyle` and `headingStyle` do nothing here, on purpose
 *
 * P32 added two template axes, and neither has a plain-text equivalent
 * worth inventing. "Centred" in a format with no measured line length means
 * padding with spaces, which is exactly the column alignment the paragraph
 * above rules out. And all three heading styles are already what this
 * emitter writes: an uppercase heading on its own line. `rule` would become
 * a row of dashes and `accent-bar` a leading glyph — decoration a form post
 * has to survive, for no gain to any reader.
 *
 * So a template changes the PDF and the DOCX and leaves this output byte for
 * byte identical. That is the intended result, not an omission: the golden
 * extracted-text snapshots are the machine-readable contract, and a purely
 * visual choice must not move them.
 */

import { DATE_RANGE_SEPARATOR } from "@/lib/resume/dates";
import { buildDocument, type DocumentBlock } from "@/lib/layout/document";
import type { ResumeDocument } from "@/lib/resume/schema";
import { contactLine, entryLines, skillGroupLine } from "@/lib/emit/shared/entry-lines";

/** ASCII stand-in for the en dash we put between dates. */
const ASCII_DATE_SEPARATOR = "-";

const BULLET_PREFIX = "- ";

/** Separates fields that share a line, e.g. `title | dates`. */
const INLINE_SEPARATOR = " | ";

/**
 * Column width for wrapped prose.
 *
 * 78 rather than 80: a couple of characters of headroom for the ">" quoting
 * an email client adds when the text is replied to.
 */
export const TEXT_COLUMN_WIDTH = 78;

/**
 * Folds only the separator this codebase injects into a generated date
 * label. Never applied to user-entered text.
 */
function asciiDateLabel(label: string): string {
  return label.split(DATE_RANGE_SEPARATOR).join(ASCII_DATE_SEPARATOR);
}

function bulletLine(text: string): string {
  return `${BULLET_PREFIX}${text}`;
}

function blockLines(block: DocumentBlock): string[] {
  const entry = entryLines(block);
  if (entry) {
    const heading = entry.dateLabel
      ? `${entry.heading}${INLINE_SEPARATOR}${asciiDateLabel(entry.dateLabel)}`
      : entry.heading;
    return [
      heading,
      entry.meta,
      ...(entry.firstBullet ? [bulletLine(entry.firstBullet)] : []),
    ].filter((l) => l.length > 0);
  }

  switch (block.type) {
    case "contact": {
      const lines: string[] = [];
      if (block.fullName) lines.push(block.fullName);
      const contact = contactLine(block);
      if (contact) lines.push(contact);
      return lines;
    }

    case "sectionHeading":
      // Caps rather than an underline of "=" or "-": a rule of dashes is
      // decoration, and some parsers read it as a bullet or a table border.
      return ["", block.label.toUpperCase(), ""];

    case "summary":
      return [block.text];

    case "skillGroup":
      return [skillGroupLine(block)].filter((l) => l.length > 0);

    case "bullet":
      return [bulletLine(block.text)];

    /* ---- Cover letter (P28-I2) ---------------------------------------- */

    case "letterMeta":
      return [...(block.date ? [block.date, ""] : []), ...block.recipientLines, ""];

    case "paragraph":
      // Wrapped at the shared column width, so a letter pasted into an
      // application form's textarea arrives as paragraphs rather than as
      // four very long lines. A blank line after each, because plain text
      // has no other way to say "paragraph".
      return [...wrapParagraph(block.text, TEXT_COLUMN_WIDTH), ""];

    default:
      return [];
  }
}

/**
 * Greedy wrap at a column width, preserving the user's own line breaks.
 *
 * A word longer than the column is left over-long rather than broken: a URL
 * or a long identifier split across lines is worse than a line that runs
 * past 78 characters, and a hyphen inserted into someone's text would
 * violate the rule that everything we inject is ours and everything they
 * typed is theirs.
 */
export function wrapParagraph(text: string, width: number): string[] {
  const lines: string[] = [];

  for (const source of text.split("\n")) {
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      if (current.length === 0) current = word;
      else if (current.length + 1 + word.length <= width) current = `${current} ${word}`;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

/**
 * Blocks that start a new logical record get a blank line before them, so
 * entries read as distinct items rather than one wall of text. Bullets
 * deliberately do not — they belong to the entry above them.
 */
function startsNewRecord(block: DocumentBlock): boolean {
  return entryLines(block) !== null;
}

/**
 * The emitter proper: block list in, text out.
 *
 * Split out from `renderText` so the cover letter emitter reuses it rather
 * than reimplementing the blank-line and trailing-newline rules, which are
 * fiddly and would drift.
 */
export function renderBlocksAsText(blocks: readonly DocumentBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (startsNewRecord(block) && lines.length > 0) lines.push("");
    lines.push(...blockLines(block));
  }

  // A trailing newline so the text ends cleanly when pasted or piped.
  return collapseBlankLines(lines).join("\n") + "\n";
}

export function renderText(resume: ResumeDocument): string {
  return renderBlocksAsText(buildDocument(resume));
}

/**
 * Reduces runs of blank lines to one and trims leading/trailing blanks.
 * Section headings pad themselves on both sides, so without this a heading
 * following an entry would produce two blanks in a row.
 */
function collapseBlankLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) {
      if (out.length === 0 || out[out.length - 1] === "") continue;
      out.push("");
    } else {
      out.push(trimmed);
    }
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}
