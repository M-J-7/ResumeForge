/**
 * `renderPdf` — the PDF emitter's public entry point (M0-T4).
 *
 * Per D2, this produces the single artifact that is *both* the preview and
 * the download; there is no second layout engine to drift from. Per D3, the
 * returned `pageCount` is read back from the rendered bytes rather than
 * estimated.
 *
 * Font registration is injected rather than assumed, matching the existing
 * seam in `lib/fonts/register.ts`: Node (tests, any server-side render)
 * resolves font files from disk, the browser resolves them by URL.
 */

import { pdf } from "@react-pdf/renderer";
import {
  disableHyphenation,
  registerFontPair,
  type FontSourceResolver,
} from "@/lib/fonts/register";
import { readPageCount } from "@/lib/pdf/read";
import type { ResumeDocument } from "@/lib/resume/schema";
import { resumePdfElement } from "./ResumePdf";

export interface RenderPdfOptions {
  /** Maps a font filename to something react-pdf can load in this environment. */
  resolveFont: FontSourceResolver;
}

export interface RenderPdfResult {
  blob: Blob;
  bytes: Uint8Array;
  /** Measured from the rendered artifact, never estimated (D3). */
  pageCount: number;
}

export async function renderPdf(
  resume: ResumeDocument,
  { resolveFont }: RenderPdfOptions,
): Promise<RenderPdfResult> {
  disableHyphenation();
  registerFontPair(resume.settings.fontPair, resolveFont);

  const blob = await pdf(resumePdfElement(resume)).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pageCount = await readPageCount(bytes);

  return { blob, bytes, pageCount };
}
