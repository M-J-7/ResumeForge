import { describe, expect, it } from "vitest";
import { MIGRATIONS, ResumeMigrationError, detectVersion, migrate, safeMigrate } from "./migrate";
import { CURRENT_SCHEMA_VERSION } from "./schema";
import { midCareerResume } from "@/test/fixtures/resumes";

describe("migration chain integrity", () => {
  it("is contiguous from 0 to the current version", () => {
    const sorted = [...MIGRATIONS].sort((a, b) => a.from - b.from);
    expect(sorted.map((m) => m.from)).toEqual(
      Array.from({ length: CURRENT_SCHEMA_VERSION }, (_, i) => i),
    );
  });

  it("advances exactly one version per step", () => {
    for (const m of MIGRATIONS) {
      expect(m.to).toBe(m.from + 1);
    }
  });

  it("has one migration per version step, with no duplicates", () => {
    const froms = MIGRATIONS.map((m) => m.from);
    expect(new Set(froms).size).toBe(froms.length);
  });

  it("describes every migration, so the chain stays readable years later", () => {
    for (const m of MIGRATIONS) {
      expect(m.description.length).toBeGreaterThan(10);
    }
  });
});

describe("detectVersion", () => {
  it("treats a document with no schemaVersion as v0", () => {
    expect(detectVersion({ contact: {} })).toBe(0);
  });

  it("reads an explicit version", () => {
    expect(detectVersion({ schemaVersion: 1 })).toBe(1);
  });

  it.each([[null], [undefined], ["a string"], [42], [[]]])(
    "returns 0 for non-object input %s",
    (input) => {
      expect(detectVersion(input)).toBe(0);
    },
  );

  it("ignores a non-integer version", () => {
    expect(detectVersion({ schemaVersion: "1" })).toBe(0);
    expect(detectVersion({ schemaVersion: 1.5 })).toBe(0);
  });
});

describe("migrate", () => {
  it("passes an already-current document through unchanged", () => {
    expect(migrate(midCareerResume)).toEqual(midCareerResume);
  });

  it("upgrades a pre-versioning (v0) document", () => {
    // A document as it might have been written before schemaVersion existed:
    // no version stamp, no section visibility flags, no settings, no links.
    const v0 = {
      contact: { fullName: "Ada Lovelace", email: "ada@example.com", phone: "", location: "" },
      sections: [
        { type: "summary", content: "Mathematician." },
        { type: "experience", entries: [] },
      ],
    };

    const migrated = migrate(v0);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.contact.fullName).toBe("Ada Lovelace");
    expect(migrated.contact.links).toEqual([]);
    expect(migrated.settings.pageSize).toBe("A4");
    expect(migrated.sections).toHaveLength(2);
    for (const section of migrated.sections) {
      expect(section.visible).toBe(true);
      expect(section.id.length).toBeGreaterThan(0);
    }
  });

  it("preserves ids that a v0 document already had", () => {
    const v0 = {
      contact: { fullName: "", email: "", phone: "", location: "" },
      sections: [{ id: "kept-id", type: "summary", content: "", visible: false }],
    };
    const migrated = migrate(v0);
    expect(migrated.sections[0]?.id).toBe("kept-id");
    expect(migrated.sections[0]?.visible).toBe(false);
  });

  it("refuses a document from a newer release rather than silently mangling it", () => {
    const future = { ...midCareerResume, schemaVersion: CURRENT_SCHEMA_VERSION + 5 };
    expect(() => migrate(future)).toThrow(ResumeMigrationError);
    expect(() => migrate(future)).toThrow(/newer version/i);
  });

  it.each([[null], [undefined], ["string"], [7], [[]]])("rejects non-object input %s", (input) => {
    expect(() => migrate(input)).toThrow(ResumeMigrationError);
  });

  it("throws when the migrated document is still structurally invalid", () => {
    // A v0 document whose date range is self-contradictory cannot be repaired
    // by a migration, so it must surface as a validation error.
    const broken = {
      contact: { fullName: "", email: "", phone: "", location: "" },
      sections: [
        {
          type: "experience",
          entries: [
            {
              id: "e1",
              title: "",
              organization: "",
              location: "",
              dates: {
                start: { year: 2024, month: 1 },
                end: { year: 2020, month: 1 },
                current: false,
              },
              bullets: [],
            },
          ],
        },
      ],
    };
    expect(() => migrate(broken)).toThrow();
  });
});

describe("safeMigrate", () => {
  it("reports success without throwing", () => {
    const result = safeMigrate(midCareerResume);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.contact.fullName).toBe(midCareerResume.contact.fullName);
  });

  it("returns an error instead of throwing on bad input", () => {
    const result = safeMigrate("not a document");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Error);
  });
});
