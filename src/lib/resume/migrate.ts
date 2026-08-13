/**
 * The migration chain (D10).
 *
 * Every persisted resume carries a `schemaVersion`. Loading a document of
 * unknown age goes through `migrate()`, which walks registered migrations in
 * sequence until the document reaches `CURRENT_SCHEMA_VERSION`, then parses it
 * against the current schema.
 *
 * ## Adding a migration
 *
 * 1. Bump `CURRENT_SCHEMA_VERSION` in `./schema.ts`.
 * 2. Append a `Migration` here with `from` equal to the previous version.
 * 3. Add a test with a real document captured at the old version.
 *
 * Never edit a shipped migration, and never renumber. Users hold documents at
 * every version we have ever released.
 */

import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  resumeDocumentSchema,
  type ResumeDocument,
} from "./schema";

type Loose = Record<string, unknown>;

export interface Migration {
  /** Version this migration reads. */
  readonly from: number;
  /** Version this migration produces. Always `from + 1`. */
  readonly to: number;
  readonly description: string;
  readonly apply: (doc: Loose) => Loose;
}

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Version 0 means "written before we had versioning". Any document lacking the
 * field is treated as v0 rather than rejected, which is what makes the very
 * first migration real work rather than a placeholder.
 */
export function detectVersion(doc: unknown): number {
  if (!isRecord(doc)) return 0;
  const raw = doc.schemaVersion;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

const migrationV0toV1: Migration = {
  from: 0,
  to: 1,
  description: "Stamp schemaVersion and backfill settings, section flags, and contact links.",
  apply: (doc) => {
    const settings = isRecord(doc.settings) ? doc.settings : {};
    const contact = isRecord(doc.contact) ? doc.contact : {};
    const sections = Array.isArray(doc.sections) ? doc.sections : [];

    return {
      ...doc,
      schemaVersion: 1,
      contact: {
        ...contact,
        links: Array.isArray(contact.links) ? contact.links : [],
      },
      // Unknown keys are dropped by the schema parse that follows; the point
      // here is only to supply anything the old shape could be missing.
      settings: { ...DEFAULT_SETTINGS, ...settings },
      sections: sections.map((section, index) => {
        const s = isRecord(section) ? section : {};
        return {
          ...s,
          id: typeof s.id === "string" && s.id.length > 0 ? s.id : `section-${index}`,
          visible: typeof s.visible === "boolean" ? s.visible : true,
        };
      }),
    };
  },
};

/** Ordered by `from`. Must be contiguous — asserted in the tests. */
export const MIGRATIONS: readonly Migration[] = [migrationV0toV1];

export class ResumeMigrationError extends Error {
  constructor(
    message: string,
    readonly detectedVersion: number,
  ) {
    super(message);
    this.name = "ResumeMigrationError";
  }
}

/**
 * Brings a document of any known version up to current and validates it.
 *
 * @throws {ResumeMigrationError} when the input is not an object, comes from a
 *   newer release than this build understands, or hits a gap in the chain.
 * @throws {z.ZodError} when the migrated document still fails validation.
 */
export function migrate(input: unknown): ResumeDocument {
  if (!isRecord(input)) {
    throw new ResumeMigrationError("A resume document must be an object.", 0);
  }

  let version = detectVersion(input);

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ResumeMigrationError(
      `This resume was saved by a newer version of the app (schema v${version}, this build understands v${CURRENT_SCHEMA_VERSION}). Update and try again.`,
      version,
    );
  }

  let doc: Loose = input;

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new ResumeMigrationError(
        `No migration registered from schema v${version}. The chain has a gap.`,
        version,
      );
    }
    doc = step.apply(doc);
    version = step.to;
  }

  return resumeDocumentSchema.parse(doc);
}

export type MigrateResult = { ok: true; document: ResumeDocument } | { ok: false; error: Error };

/** Non-throwing wrapper, for callers loading untrusted storage. */
export function safeMigrate(input: unknown): MigrateResult {
  try {
    return { ok: true, document: migrate(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
