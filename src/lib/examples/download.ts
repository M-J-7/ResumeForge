/**
 * An example resume, downloaded as a Word or PDF file to write over.
 *
 * "<role> resume format download" and "<role> resume template word" are how
 * a large share of the people these pages are for search — in India almost
 * all of them — and a page that answers with a picture of a resume and no
 * file is not the answer to that query. So every example offers itself as a
 * file, made here, in the browser, by the same emitters the builder downloads
 * with, from the same document the page draws. Nothing is fetched from a
 * server and nothing is stored on one.
 *
 * Imported dynamically by `ExampleDownloads`, so the DOCX library and
 * react-pdf are fetched on the click that needs them and never with the page
 * (`site-weight.test.ts`).
 */

import { renderDocx } from "@/lib/emit/docx/render";
import type { ResumeDocument } from "@/lib/resume/schema";
import { saveFile } from "@/lib/save-file";
import { renderPdfBytes } from "@/lib/thumbnail/render";

export type ExampleFormat = "docx" | "pdf";

/** `Staff_Nurse_Resume_Example.docx` — the role, then what the file is. */
export function exampleFileName(role: string, format: ExampleFormat): string {
  const name = role.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${name}_Resume_Example.${format}`;
}

export async function exampleFile(resume: ResumeDocument, format: ExampleFormat): Promise<Blob> {
  if (format === "docx") return (await renderDocx(resume)).blob;
  const bytes = await renderPdfBytes(resume);
  return new Blob([bytes.slice()], { type: "application/pdf" });
}

export async function downloadExample(
  role: string,
  resume: ResumeDocument,
  format: ExampleFormat,
): Promise<void> {
  saveFile(await exampleFile(resume, format), exampleFileName(role, format));
}
