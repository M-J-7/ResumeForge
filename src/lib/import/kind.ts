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

/**
 * `doc` is every word-processor file that is not a `.docx`: Word 97–2003, and
 * the RTF, HTML and XML files that are routinely saved with a `.doc` name.
 */
export type ImportKind = "pdf" | "docx" | "doc";

/**
 * The file picker's `accept` list for a resume. Extensions and media types
 * both, because pickers honour different halves: iOS's Files sheet goes by
 * type, a desktop dialog by extension.
 */
export const RESUME_FILE_ACCEPT = [
  ".pdf",
  ".docx",
  ".doc",
  ".rtf",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/rtf",
  "text/rtf",
].join(",");

/** Which of the file kinds a filename claims to be, or null. */
export function importKindFromFilename(name: string): ImportKind | null {
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.docx$/i.test(name)) return "docx";
  if (/\.(?:doc|rtf)$/i.test(name)) return "doc";
  return null;
}

/**
 * What a file is, from its first bytes — which is what it actually is,
 * whatever its name says.
 *
 * Names lie routinely and innocently: a `.docx` renamed `.doc` because a form
 * asked for one, an RTF that Word saved as `.doc`, a file shared through a
 * phone that arrives with no extension at all. Each of those used to be read
 * as the kind its name claimed, fail, and be reported as damaged.
 */
export function importKindFromBytes(bytes: Uint8Array): ImportKind | null {
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "docx";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc";
  if (/^\s*\{\\rtf/.test(head(bytes, 64))) return "doc";
  // The header is meant to be at byte 0 and readers allow it anywhere in the
  // first kilobyte, because some programs write a little before it.
  if (head(bytes, 1024).includes("%PDF-")) return "pdf";
  return null;
}

/**
 * A file that is plainly not a resume document, said in a sentence that tells
 * its owner what to do. Null when the bytes do not say.
 */
export function foreignFileMessage(bytes: Uint8Array): string | null {
  if (bytes.length === 0) {
    return "That file is empty — it has no content at all. Choose the file again, or download it again if it came from somewhere else.";
  }
  const isImage =
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    startsWith(bytes, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) || // GIF
    (head(bytes, 4) === "RIFF" && head(bytes, 12).endsWith("WEBP")) ||
    /^....ftyp(?:hei[cxsm]|mif1|msf1|avif)/s.test(head(bytes, 12)) || // HEIC, AVIF
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || // TIFF
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
  if (isImage) {
    return (
      "That is a picture of a resume rather than a document, so there is no text in it to " +
      "read — and an applicant tracking system cannot read it either. Export a PDF or a Word " +
      "file from the document you wrote it in, and check that."
    );
  }
  return null;
}

/**
 * What a screen shows when reading a file threw.
 *
 * The parser's own failures (`ResumeReadError`, tested by name because the
 * parser is loaded on demand) carry a message written for the person, and it
 * is shown as is. Anything else is not theirs to fix, and its message — a
 * stack-trace phrase, or a browser's — is not shown: it goes to the console,
 * and the person is told the truth, which is that it was us.
 */
export function readFailureMessage(error: unknown): string {
  if (error instanceof Error && error.name === "ResumeReadError") return error.message;
  console.error("Resume import failed", error);
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (
    /dynamically imported module|importing a module script|loading chunk|chunkloaderror|failed to fetch|load failed/i.test(
      text,
    )
  ) {
    return "The file reader did not finish loading, which usually means the connection dropped. Reload the page and try again.";
  }
  return "Something went wrong on our side while reading that file. Reload the page and try again; if it happens again, try a PDF of the same resume.";
}

/** HTML or XML — what a failed download or a "Word" file from a website often is. */
export function looksLikeMarkup(bytes: Uint8Array): boolean {
  return /^\s*</.test(head(bytes, 256));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/** The first bytes as Latin-1, after a UTF-8 byte-order mark if there is one. */
function head(bytes: Uint8Array, length: number): string {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let out = "";
  for (let i = start; i < Math.min(bytes.length, start + length); i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}
