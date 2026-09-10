/**
 * The react-pdf document tree for a cover letter (P28-I2).
 *
 * A near-copy of `ResumePdf.tsx`, and deliberately so: same `<Page>`, same
 * `buildStyles(settings)`, same pinned metadata, same `renderBlock`. What
 * differs is one line — which builder produced the block list. Everything
 * downstream of that is shared, which is what guarantees a letter and the
 * resume it accompanies come out on identical paper in identical type.
 *
 * The pinned `creationDate` is the same fixed instant the resume uses, for
 * the same determinism reason (M0-T4): pdfkit derives the trailer `/ID` from
 * an MD5 of the info dictionary, so pinning the dates pins the document id.
 * The *letter's* date is content, not metadata, and lives in the block list.
 */

import { Document, Page } from "@react-pdf/renderer";
import { buildCoverLetterDocument } from "@/lib/layout/cover-letter";
import type { CoverLetterDocument } from "@/lib/cover-letter/schema";
import { renderBlock } from "./blocks";
import { buildStyles } from "./styles";
import { PDF_CREATOR, PDF_PRODUCER, PINNED_PDF_DATE } from "./ResumePdf";

export function coverLetterPdfElement(letter: CoverLetterDocument, today?: Date) {
  const blocks = buildCoverLetterDocument(letter, today);
  const styles = buildStyles(letter.settings);

  return (
    <Document
      title={
        letter.contact.fullName ? `${letter.contact.fullName} — Cover Letter` : "Cover Letter"
      }
      author={letter.contact.fullName || undefined}
      producer={PDF_PRODUCER}
      creator={PDF_CREATOR}
      creationDate={PINNED_PDF_DATE}
      modificationDate={PINNED_PDF_DATE}
    >
      <Page size={letter.settings.pageSize} style={styles.page} wrap>
        {blocks.map((block, i) => renderBlock(block, styles, letter.settings, i))}
      </Page>
    </Document>
  );
}
