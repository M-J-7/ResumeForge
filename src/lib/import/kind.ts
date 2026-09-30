/**
 * Which kind of file a resume import is dealing with — and nothing else.
 *
 * A module of its own so that deciding whether to read a file costs nothing.
 * `parse-resume.ts` pulls in pdfjs, the DOCX reader, the field scorecard and
 * libphonenumber; `/check` used to import all of that statically just to ask
 * this one question, which put every byte of it in the page's first load and
 * in the prefetch of every page that links to it. The tool now loads the
 * parser when a file arrives, and asks this first.
 *
 * `parse-resume.ts` re-exports both names, so existing imports are unchanged.
 */

export type ImportKind = "pdf" | "docx";

/** Which of the two file kinds a filename claims to be, or null. */
export function importKindFromFilename(name: string): ImportKind | null {
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.docx$/i.test(name)) return "docx";
  return null;
}
