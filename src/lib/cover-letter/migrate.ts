/**
 * The cover letter migration chain (D10).
 *
 * Deliberately the same shape as `lib/resume/migrate.ts` — `detectVersion`,
 * `migrate`, `safeMigrate`, a registered chain, and a v0→v1 step — rather
 * than a simpler bespoke thing, because the two will be maintained together
 * and a reader who has understood one should not have to learn a second
 * pattern.
 *
 * ## Why a v0 migration exists on day one
 *
 * There is no v0 letter in the wild, and there never will be: this ships
 * with `CURRENT_COVER_LETTER_SCHEMA_VERSION = 1`. The step is still real
 * work rather than a placeholder, because "the document has no
 * `schemaVersion` field" is also what a hand-edited file, a partially
 * written IndexedDB record, and a bad import look like. Treating an unversioned
 * object as v0 and backfilling it is strictly better than rejecting it.
 *
 * ## Adding a migration
 *
 * 1. Bump `CURRENT_COVER_LETTER_SCHEMA_VERSION` in `./schema.ts`.
 * 2. Append a `Migration` here with `from` equal to the previous version.
 * 3. Add a test with a real document captured at the old version.
 *
 * Never edit a shipped migration, and never renumber.
 */

import { DEFAULT_SETTINGS } from "@/lib/resume/schema";
import {
  CURRENT_COVER_LETTER_SCHEMA_VERSION,
  coverLetterDocumentSchema,
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  EMPTY_RECIPIENT,
  type CoverLetterDocument,
} from "./schema";

type Loose = Record<string, unknown>;

export interface CoverLetterMigration {
  readonly from: number;
  readonly to: number;
  readonly description: string;
  readonly apply: (doc: Loose) => Loose;
}

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function detectVersion(doc: unknown): number {
  if (!isRecord(doc)) return 0;
  const raw = doc.schemaVersion;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

const migrationV0toV1: CoverLetterMigration = {
  from: 0,
  to: 1,
  description: "Stamp schemaVersion and backfill recipient, salutation, sign-off and settings.",
  apply: (doc) => {
    const contact = isRecord(doc.contact) ? doc.contact : {};
    const recipient = isRecord(doc.recipient) ? doc.recipient : {};
    const settings = isRecord(doc.settings) ? doc.settings : {};
    const paragraphs = Array.isArray(doc.paragraphs) ? doc.paragraphs : [];

    return {
      ...doc,
      schemaVersion: 1,
      contact: { ...contact, links: Array.isArray(contact.links) ? contact.links : [] },
      recipient: { ...EMPTY_RECIPIENT, ...recipient },
      dateISO: typeof doc.dateISO === "string" ? doc.dateISO : null,
      salutation: typeof doc.salutation === "string" ? doc.salutation : DEFAULT_SALUTATION,
      signOff: typeof doc.signOff === "string" ? doc.signOff : DEFAULT_SIGN_OFF,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      paragraphs: paragraphs.map((paragraph, index) => {
        const p = isRecord(paragraph) ? paragraph : {};
        return {
          ...p,
          id: typeof p.id === "string" && p.id.length > 0 ? p.id : `paragraph-${index}`,
          role: typeof p.role === "string" ? p.role : "custom",
          sources: Array.isArray(p.sources) ? p.sources : [],
        };
      }),
    };
  },
};

/**
 * Enhancement metadata is optional, so existing paragraphs already have the
 * complete v2 shape. The explicit step still matters: it stamps saved v1
 * letters at the new schema version before the stricter v2 parser sees them.
 */
const migrationV1toV2: CoverLetterMigration = {
  from: 1,
  to: 2,
  description: "Stamp existing paragraphs as v2 documents with no enhancement metadata.",
  apply: (doc) => ({ ...doc, schemaVersion: 2 }),
};

/** Ordered by `from`. Must be contiguous — asserted in the tests. */
export const COVER_LETTER_MIGRATIONS: readonly CoverLetterMigration[] = [
  migrationV0toV1,
  migrationV1toV2,
];

export class CoverLetterMigrationError extends Error {
  constructor(
    message: string,
    readonly detectedVersion: number,
  ) {
    super(message);
    this.name = "CoverLetterMigrationError";
  }
}

/**
 * Brings a letter of any known version up to current and validates it.
 *
 * @throws {CoverLetterMigrationError} when the input is not an object, comes
 *   from a newer release than this build understands, or hits a chain gap.
 * @throws {z.ZodError} when the migrated document still fails validation.
 */
export function migrateCoverLetter(input: unknown): CoverLetterDocument {
  if (!isRecord(input)) {
    throw new CoverLetterMigrationError("A cover letter must be an object.", 0);
  }

  let version = detectVersion(input);

  if (version > CURRENT_COVER_LETTER_SCHEMA_VERSION) {
    throw new CoverLetterMigrationError(
      `This letter was saved by a newer version of the app (schema v${version}, this build understands v${CURRENT_COVER_LETTER_SCHEMA_VERSION}). Update and try again.`,
      version,
    );
  }

  let doc: Loose = input;

  while (version < CURRENT_COVER_LETTER_SCHEMA_VERSION) {
    const step = COVER_LETTER_MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new CoverLetterMigrationError(
        `No migration registered from schema v${version}. The chain has a gap.`,
        version,
      );
    }
    doc = step.apply(doc);
    version = step.to;
  }

  return coverLetterDocumentSchema.parse(doc);
}

export type CoverLetterMigrateResult =
  { ok: true; document: CoverLetterDocument } | { ok: false; error: Error };

/** Non-throwing wrapper, for callers loading untrusted storage. */
export function safeMigrateCoverLetter(input: unknown): CoverLetterMigrateResult {
  try {
    return { ok: true, document: migrateCoverLetter(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
