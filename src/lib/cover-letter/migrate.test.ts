/**
 * The cover letter migration chain (D10).
 *
 * The chain has one step today and the interesting assertions are structural
 * — contiguity, no gaps, a refusal to guess at a future version. Those are
 * the properties that stay true as the chain grows, and they are exactly
 * what nobody remembers to check when adding migration number four.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/resume/schema";
import {
  COVER_LETTER_MIGRATIONS,
  CoverLetterMigrationError,
  detectVersion,
  migrateCoverLetter,
  safeMigrateCoverLetter,
} from "./migrate";
import {
  CURRENT_COVER_LETTER_SCHEMA_VERSION,
  DEFAULT_SALUTATION,
  DEFAULT_SIGN_OFF,
  type CoverLetterDocument,
} from "./schema";

const contact = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "",
  location: "London",
  links: [],
};

const current: CoverLetterDocument = {
  schemaVersion: CURRENT_COVER_LETTER_SCHEMA_VERSION,
  contact,
  recipient: { name: "", title: "", company: "Acme", address: "" },
  dateISO: null,
  salutation: DEFAULT_SALUTATION,
  paragraphs: [
    { id: "opening", role: "opening", text: "I am writing about the role.", sources: [] },
  ],
  signOff: DEFAULT_SIGN_OFF,
  settings: { ...DEFAULT_SETTINGS },
};

describe("the chain itself", () => {
  it("is contiguous and ends at the current version", () => {
    let expected = 0;
    for (const migration of COVER_LETTER_MIGRATIONS) {
      expect(migration.from).toBe(expected);
      expect(migration.to).toBe(migration.from + 1);
      expected = migration.to;
    }
    expect(expected).toBe(CURRENT_COVER_LETTER_SCHEMA_VERSION);
  });
});

describe("detectVersion", () => {
  it("treats an unversioned object as v0 rather than rejecting it", () => {
    expect(detectVersion({ paragraphs: [] })).toBe(0);
  });

  it("reads a stamped version", () => {
    expect(detectVersion(current)).toBe(CURRENT_COVER_LETTER_SCHEMA_VERSION);
  });

  it("treats a nonsense version as v0", () => {
    expect(detectVersion({ schemaVersion: "one" })).toBe(0);
    expect(detectVersion({ schemaVersion: -3 })).toBe(0);
  });
});

describe("migrateCoverLetter", () => {
  it("passes a current document through unchanged", () => {
    expect(migrateCoverLetter(current)).toEqual(current);
  });

  it("backfills everything a v0 document is missing", () => {
    const migrated = migrateCoverLetter({
      contact,
      paragraphs: [{ text: "One paragraph, no id and no role." }],
    });

    expect(migrated.schemaVersion).toBe(CURRENT_COVER_LETTER_SCHEMA_VERSION);
    expect(migrated.salutation).toBe(DEFAULT_SALUTATION);
    expect(migrated.signOff).toBe(DEFAULT_SIGN_OFF);
    expect(migrated.dateISO).toBeNull();
    expect(migrated.recipient).toEqual({ name: "", title: "", company: "", address: "" });
    expect(migrated.settings).toEqual(DEFAULT_SETTINGS);
    expect(migrated.paragraphs[0]?.id).toBe("paragraph-0");
    expect(migrated.paragraphs[0]?.role).toBe("custom");
    expect(migrated.paragraphs[0]?.sources).toEqual([]);
  });

  it("moves a v1 letter to v2 without adding enhancement metadata", () => {
    const v1 = { ...current, schemaVersion: 1 as const };
    const migrated = migrateCoverLetter(v1);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.paragraphs[0]?.enhancement).toBeUndefined();
  });

  it("refuses a document from a newer build rather than guessing", () => {
    expect(() => migrateCoverLetter({ ...current, schemaVersion: 99 })).toThrow(
      CoverLetterMigrationError,
    );
  });

  it("rejects something that is not an object at all", () => {
    expect(() => migrateCoverLetter("a letter")).toThrow(CoverLetterMigrationError);
    expect(() => migrateCoverLetter(null)).toThrow(CoverLetterMigrationError);
  });
});

describe("safeMigrateCoverLetter", () => {
  it("reports failure rather than throwing, for untrusted storage", () => {
    const result = safeMigrateCoverLetter({ schemaVersion: 99 });
    expect(result.ok).toBe(false);
  });

  it("returns the migrated document on success", () => {
    const result = safeMigrateCoverLetter(current);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.paragraphs).toHaveLength(1);
  });
});
