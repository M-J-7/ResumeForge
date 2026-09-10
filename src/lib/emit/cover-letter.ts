/**
 * Rendering a cover letter to PDF, DOCX and TXT (P28-I2).
 *
 * Every one of these is the resume's emitter with a different block list
 * fed into it. There is no second layout engine, no second style table, and
 * no second set of break rules — which is the property that keeps a letter
 * and its resume looking like one application rather than two documents that
 * happen to be attached to the same email.
 *
 * All three formats, never paywalled (D13), same as the resume.
 */

import { pdf } from "@react-pdf/renderer";
import { Packer } from "docx";
import { disableHyphenation, registerFontPair } from "@/lib/fonts/register";
import { countPages } from "@/lib/pdf/page-count";
import { buildCoverLetterDocument } from "@/lib/layout/cover-letter";
import type { CoverLetterDocument } from "@/lib/cover-letter/schema";
import { coverLetterPdfElement } from "./pdf/CoverLetterPdf";
import { buildDocxFromBlocks } from "./docx/render";
import { renderBlocksAsText } from "./text/render";
import type { RenderPdfOptions, RenderPdfResult } from "./pdf/render";

export async function renderCoverLetterPdf(
  letter: CoverLetterDocument,
  { resolveFont }: RenderPdfOptions,
  today?: Date,
): Promise<RenderPdfResult> {
  disableHyphenation();
  registerFontPair(letter.settings.fontPair, resolveFont);

  const blob = await pdf(coverLetterPdfElement(letter, today)).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes, pageCount: countPages(bytes) };
}

export interface RenderDocxResult {
  blob: Blob;
  bytes: Uint8Array;
}

export async function renderCoverLetterDocx(
  letter: CoverLetterDocument,
  today?: Date,
): Promise<RenderDocxResult> {
  const document = buildDocxFromBlocks(
    buildCoverLetterDocument(letter, today),
    letter.settings,
    {
      title: letter.contact.fullName ? `${letter.contact.fullName} — Cover Letter` : "Cover Letter",
      description: "Cover letter",
    },
  );
  const buffer = await Packer.toBuffer(document);
  const bytes = new Uint8Array(buffer);
  return {
    bytes,
    blob: new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  };
}

export function renderCoverLetterText(letter: CoverLetterDocument, today?: Date): string {
  return renderBlocksAsText(buildCoverLetterDocument(letter, today));
}
