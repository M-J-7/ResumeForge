/**
 * A cover letter as `DocumentBlock[]` (P28-I2).
 *
 * The same trick the resume uses, for the same reason: one flat ordered list
 * of semantic blocks, three emitters that map it onto PDF, DOCX and plain
 * text. A letter that went down its own rendering path would drift from the
 * resume it is sent with — different margins, a different typeface, a
 * different idea of what "12pt" means — and the pair would look assembled by
 * two different people.
 *
 * Because the letter reuses `ContactBlock` for its header and `Settings`
 * from the resume document, the letterhead is literally the resume's
 * letterhead. That is the point.
 *
 * ## Break hints
 *
 * A letter is one page in almost every case, so the four resume break rules
 * mostly have nothing to bite on. Two still matter and are set:
 * `keepWithNext` on the letterhead and salutation, so a letter that does run
 * long cannot start page two with a bare "Dear Hiring Manager,"; and
 * `keepTogether` on the sign-off, which must never be split from itself.
 * Paragraphs are deliberately *not* `keepTogether` — a long paragraph
 * breaking across pages is correct behaviour for prose, unlike a resume
 * bullet.
 */

import { formatLetterDate, parseDateISO } from "@/lib/cover-letter/date";
import type { CoverLetterDocument } from "@/lib/cover-letter/schema";
import type { ContactBlock, DocumentBlock } from "./document";

function buildContactBlock(letter: CoverLetterDocument): ContactBlock {
  return {
    type: "contact",
    fullName: letter.contact.fullName,
    email: letter.contact.email,
    phone: letter.contact.phone,
    location: letter.contact.location,
    links: letter.contact.links.map((link) => ({ label: link.label, url: link.url })),
    keepWithNext: true,
  };
}

/**
 * The recipient block, as lines.
 *
 * Empty fields vanish rather than leaving blank lines — a letter addressed to
 * a company with no named contact should show one line, not three and a gap.
 * The address is split on its own newlines because the user typed it that
 * way and an address's line breaks are meaningful.
 */
function recipientLines(letter: CoverLetterDocument): string[] {
  const { name, title, company, address } = letter.recipient;
  return [name, title, company, ...address.split("\n")]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Turns a letter into the block list every emitter renders from.
 *
 * `today` is injected rather than read from the clock, because
 * `composeCoverLetter` is pure and stores `dateISO: null` — "stamp today at
 * export". This is the one place the current date enters the pipeline, and
 * passing it in keeps every test that renders a letter deterministic.
 */
export function buildCoverLetterDocument(
  letter: CoverLetterDocument,
  today: Date = new Date(),
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [buildContactBlock(letter)];

  const stamped = (letter.dateISO ? parseDateISO(letter.dateISO) : null) ?? today;
  const lines = recipientLines(letter);

  blocks.push({
    type: "letterMeta",
    date: formatLetterDate(stamped),
    recipientLines: lines,
    keepWithNext: true,
  });

  const salutation = letter.salutation.trim();
  if (salutation) {
    blocks.push({ type: "paragraph", text: salutation, keepWithNext: true });
  }

  for (const paragraph of letter.paragraphs) {
    const text = paragraph.text.trim();
    // An empty paragraph is a normal editing state, and rendering it would
    // put a blank gap in the middle of the letter. Same rule as the resume's
    // empty bullets, filtered once here so no emitter has to remember it.
    if (!text) continue;
    blocks.push({ type: "paragraph", text, paragraphId: paragraph.id });
  }

  const signOff = letter.signOff.trim();
  const name = letter.contact.fullName.trim();
  if (signOff || name) {
    blocks.push({
      type: "paragraph",
      text: [signOff, name].filter(Boolean).join("\n\n"),
      keepTogether: true,
    });
  }

  return blocks;
}
