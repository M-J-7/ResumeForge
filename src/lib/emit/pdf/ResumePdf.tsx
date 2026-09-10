/**
 * The react-pdf document tree for a resume.
 *
 * Determinism (M0-T4): `creationDate` and `modificationDate` are pinned to a
 * fixed instant and `producer`/`creator` to fixed strings, so identical input
 * yields identical output. pdfkit derives the trailer `/ID` from an MD5 of
 * this info dictionary, so pinning the dates pins the document id too.
 *
 * One residual nondeterminism is outside our control: pdfkit generates the
 * embedded font subset tag (the `ABCDEF` in `/BaseFont /ABCDEF+Arimo`) with
 * `Math.random()` and exposes no override. `canonicalizePdf` in
 * `./determinism.ts` normalizes it for byte-comparison purposes.
 */

import { Document, Page } from "@react-pdf/renderer";
import { buildDocument } from "@/lib/layout/document";
import type { ResumeDocument } from "@/lib/resume/schema";
import { renderBlock } from "./blocks";
import { buildStyles } from "./styles";

/** Fixed epoch for reproducible output. Arbitrary, but must never change. */
export const PINNED_PDF_DATE = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

// Literals rather than `PRODUCT_NAME`, so that renaming the product cannot
// silently change exported PDF bytes. They only have to be *fixed*, not to
// match the brand — see the determinism note above.
export const PDF_PRODUCER = "Six Seconds Resume";
export const PDF_CREATOR = "Six Seconds Resume";

/**
 * Built as a plain factory rather than a component so the result is typed as
 * the `<Document>` element itself. Both `pdf()` and `usePDF()` require a
 * Document element specifically; a wrapper component that merely *returns*
 * one does not satisfy that, and the preview (M0-T9) needs the same element.
 */
export function resumePdfElement(resume: ResumeDocument) {
  const blocks = buildDocument(resume);
  const styles = buildStyles(resume.settings);

  return (
    <Document
      title={resume.contact.fullName || "Resume"}
      author={resume.contact.fullName || undefined}
      producer={PDF_PRODUCER}
      creator={PDF_CREATOR}
      creationDate={PINNED_PDF_DATE}
      modificationDate={PINNED_PDF_DATE}
    >
      <Page size={resume.settings.pageSize} style={styles.page} wrap>
        {blocks.map((block, i) => renderBlock(block, styles, resume.settings, i))}
      </Page>
    </Document>
  );
}
