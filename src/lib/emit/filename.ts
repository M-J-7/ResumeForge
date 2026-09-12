/**
 * Download filenames (M0-T12).
 *
 * Per D14 this convention is for the **human recruiter's downloads folder**,
 * not for ATS search. No parser ranks a file by its name; a person looking at
 * forty files called `resume.pdf` very much does.
 *
 * Accented characters are transliterated **for the filename only** — never
 * for the document content. A name is not ours to anglicize; but a filename
 * crosses filesystems, email gateways, and upload forms with inconsistent
 * encoding handling, and a mangled download is worse than a plain one.
 */

/**
 * Decomposes accented Latin characters and drops the combining marks, so
 * "José Ángel Muñoz-Łukasiewicz" becomes "Jose_Angel_Munoz-Lukasiewicz".
 *
 * Characters with no Latin decomposition (Ł, Ø, Đ, ß) have no combining form
 * to strip, so they are mapped explicitly rather than silently deleted.
 */
const EXPLICIT_TRANSLITERATIONS: Record<string, string> = {
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  Ð: "D",
  ð: "d",
  Þ: "Th",
  þ: "th",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
  İ: "I",
  ı: "i",
};

export function transliterate(value: string): string {
  return (
    value
      .split("")
      .map((char) => EXPLICIT_TRANSLITERATIONS[char] ?? char)
      .join("")
      .normalize("NFKD")
      // Combining diacritical marks.
      .replace(/[̀-ͯ]/g, "")
  );
}

/** `json` is JSON Resume (M2-T6), not a format any ATS reads. */
export type ExportFormat = "pdf" | "docx" | "txt" | "json";

/**
 * `FirstName_LastName_Resume.pdf`, falling back to `Resume.pdf` when the
 * user has not entered a name yet.
 */
export function resumeFileName(fullName: string, format: ExportFormat): string {
  const ascii = transliterate(fullName)
    // Anything outside the safe set becomes a separator rather than vanishing,
    // so distinct names cannot collapse into the same filename.
    .replace(/[^A-Za-z0-9\-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join("_");

  const stem = ascii.length > 0 ? `${ascii}_Resume` : "Resume";
  return `${stem}.${format}`;
}

/**
 * `FirstName_LastName_Cover_Letter.pdf` (P28-I2).
 *
 * Same convention and the same transliteration as the resume, so a recruiter
 * who downloads both gets two files that sort next to each other under the
 * candidate's name — which is the whole point of D14's naming rule.
 */
export function coverLetterFileName(fullName: string, format: ExportFormat): string {
  const stem = resumeFileName(fullName, format).replace(/\.[^.]+$/, "");
  return `${stem.replace(/Resume$/, "Cover_Letter")}.${format}`;
}

export interface DestinationAdvice {
  destination: string;
  format: Extract<ExportFormat, "pdf" | "docx">;
  reason: string;
}

/**
 * Per-destination format guidance (M0-T12).
 *
 * Costs one lookup table and answers the question every candidate actually
 * has at the download step. Grounded in the parse-accuracy evidence behind
 * D4, and phrased as a recommendation rather than a guarantee, per D14.
 */
export const DESTINATION_ADVICE: readonly DestinationAdvice[] = [
  {
    destination: "Workday",
    format: "docx",
    reason:
      "Its parser prefills the application form from your file; DOCX gives it the cleanest read.",
  },
  {
    destination: "Taleo",
    format: "docx",
    reason: "Older parser generation, and consistently better with DOCX than with PDF.",
  },
  {
    destination: "iCIMS",
    format: "docx",
    reason: "Form prefill is more reliable from DOCX.",
  },
  {
    destination: "Greenhouse",
    format: "pdf",
    reason: "Handles PDF well, and preserves exactly what you laid out.",
  },
  {
    destination: "Lever",
    format: "pdf",
    reason: "Handles PDF well, and preserves exactly what you laid out.",
  },
  {
    destination: "Ashby",
    format: "pdf",
    reason: "Handles PDF well, and preserves exactly what you laid out.",
  },
  {
    destination: "Emailing a person",
    format: "pdf",
    reason: "Opens identically everywhere and cannot be edited by accident.",
  },
];
