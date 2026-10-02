/**
 * A template, downloaded as a Word or PDF file you can open and edit.
 *
 * "Resume template Word free download" is one of the largest queries in both
 * markets this site writes for (ROADMAP Phase 3), and D13 makes the answer
 * free anyway. So each card on `/templates` offers its template as a file —
 * made here, in the browser, by the same emitters the builder downloads
 * with, from the same sample resume its picture shows. Nothing is fetched
 * from a server and nothing is stored on one: the promise the privacy page
 * makes about every other file this site hands over.
 *
 * Imported dynamically by `TemplateDownloads`, so the DOCX library and
 * react-pdf are fetched on the click that needs them and never with the page
 * (`site-weight.test.ts`).
 */

import { renderDocx } from "@/lib/emit/docx/render";
import type { TemplateDefinition } from "@/lib/resume/templates";
import { saveFile } from "@/lib/save-file";
import { renderPdfBytes } from "@/lib/thumbnail/render";
import { templateSample } from "@/lib/thumbnail/template-sample";

export type TemplateFormat = "docx" | "pdf";

/** `Atlas_Resume_Template.docx` — the template's name, then what it is. */
export function templateFileName(template: TemplateDefinition, format: TemplateFormat): string {
  const name = template.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${name}_Resume_Template.${format}`;
}

export async function templateFile(
  template: TemplateDefinition,
  format: TemplateFormat,
): Promise<Blob> {
  const resume = templateSample(template);
  if (format === "docx") return (await renderDocx(resume)).blob;
  const bytes = await renderPdfBytes(resume);
  return new Blob([bytes.slice()], { type: "application/pdf" });
}

export async function downloadTemplate(
  template: TemplateDefinition,
  format: TemplateFormat,
): Promise<void> {
  saveFile(await templateFile(template, format), templateFileName(template, format));
}
