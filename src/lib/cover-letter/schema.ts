/**
 * The cover letter document (P28-I1).
 *
 * Mirrors `lib/resume/schema.ts` in every respect that matters, including
 * the parts that look like overkill for a page of prose:
 *
 *   - A `schemaVersion` and a migration chain from commit one (D10). A letter
 *     is a persisted document that outlives the code that wrote it, and a
 *     versioning scheme retrofitted after the first user has saved something
 *     is a versioning scheme with a hole in it.
 *   - Structural validation only. The store persists on every keystroke, so a
 *     half-written letter has to be representable; an empty paragraph is a
 *     normal editing state, not a parse error.
 *
 * ## Contact and Settings are reused, not redefined
 *
 * The letter carries the same `Contact` and the same `Settings` as the
 * resume, so a letter sent alongside a resume is set in the same typeface at
 * the same size on the same paper with the same margins. Two people looking
 * at your application should not be able to tell the two documents were
 * assembled separately. Redefining either type here would let them drift.
 *
 * ## `sources` is what makes the composer defensible
 *
 * Every paragraph records which resume entries or bullets it drew from. The
 * UI shows those as chips, and the composer's guarantee — that no sentence is
 * invented (D8) — is only checkable because the provenance is stored rather
 * than reconstructed.
 */

import { z } from "zod";
import { contactSchema, settingsSchema } from "@/lib/resume/schema";

/**
 * Bump whenever the persisted shape changes, and add the matching migration
 * in `./migrate.ts`. Never renumber existing versions.
 */
export const CURRENT_COVER_LETTER_SCHEMA_VERSION = 2;

/**
 * Exported since §10.2 (2.6): the UI has to enforce it too.
 *
 * A user who adds a thirteenth paragraph and presses Save gets an opaque zod
 * failure at the storage boundary — after the writing is done. The control
 * that adds one has to know the limit, not just the validator that rejects it.
 */
export const MAX_COVER_LETTER_PARAGRAPHS = 12;
export const MAX_COVER_LETTER_PARAGRAPH_LENGTH = 4000;

const idSchema = z.string().min(1, "Every paragraph needs a stable id.");

/** User-entered text: trimmed and length-capped, but may be empty while editing. */
const text = (max: number) => z.string().trim().max(max);

/**
 * The four roles the composer produces, plus `custom` for anything the user
 * adds themselves.
 *
 * A role rather than a free-form label because the composer needs to know
 * which paragraph to regenerate when only one is being recomposed, and
 * because the evidence paragraph carries a guarantee the others do not (its
 * sentences appear verbatim in the resume) that only a typed role can pin.
 */
export const PARAGRAPH_ROLES = ["opening", "evidence", "alignment", "closing", "custom"] as const;

export const coverLetterParagraphSchema = z.object({
  id: idSchema,
  role: z.enum(PARAGRAPH_ROLES),
  text: text(MAX_COVER_LETTER_PARAGRAPH_LENGTH),
  /**
   * Ids of the resume entries and bullets this drew from. Shown in the UI as
   * "Sources" chips; empty for a paragraph the user wrote themselves.
   */
  sources: z.array(z.string()).max(24),
  /**
   * Present only after the user accepts a locally generated wording proposal.
   * The original text is retained so the user can undo it after saving and
   * reopening the letter. It is metadata only and is never rendered.
   */
  enhancement: z
    .object({
      originalText: text(MAX_COVER_LETTER_PARAGRAPH_LENGTH),
      modelId: z.string().min(1).max(200),
      modelRevision: z.string().min(1).max(200),
      appliedAt: z.string().datetime(),
    })
    .optional(),
});

/**
 * Who it is addressed to.
 *
 * Every field may be empty, and the common case is that all of them are —
 * most postings name nobody. `salutation` is separate rather than derived so
 * a user who knows the hiring manager's name can address them without the
 * composer guessing at a form of address it has no business choosing.
 */
export const recipientSchema = z.object({
  name: text(120),
  title: text(120),
  company: text(120),
  /** One block, newlines preserved. Rendered as-is under the recipient. */
  address: text(400),
});

export const coverLetterDocumentSchema = z.object({
  schemaVersion: z.literal(CURRENT_COVER_LETTER_SCHEMA_VERSION),
  contact: contactSchema,
  recipient: recipientSchema,
  /**
   * `null` means "stamp today at export".
   *
   * This is not a convenience — it is what makes `composeCoverLetter` pure.
   * A composer that called `Date.now()` could not be tested for determinism,
   * and the determinism test is the one that proves the same inputs always
   * produce the same letter.
   */
  dateISO: z.string().nullable(),
  salutation: text(160),
  paragraphs: z.array(coverLetterParagraphSchema).max(MAX_COVER_LETTER_PARAGRAPHS),
  signOff: text(80),
  settings: settingsSchema,
});

export type CoverLetterParagraph = z.infer<typeof coverLetterParagraphSchema>;
export type CoverLetterEnhancement = NonNullable<CoverLetterParagraph["enhancement"]>;
export type CoverLetterRecipient = z.infer<typeof recipientSchema>;
export type CoverLetterDocument = z.infer<typeof coverLetterDocumentSchema>;
export type ParagraphRole = (typeof PARAGRAPH_ROLES)[number];

export const EMPTY_RECIPIENT: CoverLetterRecipient = {
  name: "",
  title: "",
  company: "",
  address: "",
};

/**
 * The default salutation.
 *
 * "Dear Hiring Manager," rather than "To Whom It May Concern," — the latter
 * reads as a form letter, which is exactly what a letter assembled from
 * templates most needs to avoid looking like. Editable, like everything else.
 */
export const DEFAULT_SALUTATION = "Dear Hiring Manager,";

export const DEFAULT_SIGN_OFF = "Sincerely,";
