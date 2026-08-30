import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  resumeDocumentSchema,
  settingsSchema,
  dateRangeSchema,
  contactSchema,
  type ResumeDocument,
  isValidEmail,
  isValidUrl,
} from "./schema";
import { createEmptyResume } from "./factory";
import { fresherResume, midCareerResume } from "@/test/fixtures/resumes";

/** Structural clone through JSON, the way persistence actually round-trips. */
function throughJson(doc: ResumeDocument): unknown {
  return JSON.parse(JSON.stringify(doc));
}

describe("resumeDocumentSchema", () => {
  it("accepts the complete mid-career fixture", () => {
    expect(() => resumeDocumentSchema.parse(midCareerResume)).not.toThrow();
  });

  it("accepts the fresher fixture with an empty experience section", () => {
    expect(() => resumeDocumentSchema.parse(fresherResume)).not.toThrow();
  });

  it("accepts a blank document, because completeness is the lint engine's job", () => {
    expect(() => resumeDocumentSchema.parse(createEmptyResume())).not.toThrow();
  });

  it("survives a JSON round-trip unchanged", () => {
    for (const doc of [midCareerResume, fresherResume, createEmptyResume()]) {
      const parsed = resumeDocumentSchema.parse(throughJson(doc));
      expect(parsed).toEqual(doc);
    }
  });

  it("is idempotent — parsing an already-parsed document changes nothing", () => {
    const once = resumeDocumentSchema.parse(midCareerResume);
    const twice = resumeDocumentSchema.parse(once);
    expect(twice).toEqual(once);
  });

  it("rejects a document whose schemaVersion is not current", () => {
    const stale = { ...midCareerResume, schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => resumeDocumentSchema.parse(stale)).toThrow();
  });

  it("rejects a repeated standard section", () => {
    const doubled: unknown = {
      ...midCareerResume,
      sections: [
        ...midCareerResume.sections,
        { id: "sec-experience-2", type: "experience", visible: true, entries: [] },
      ],
    };
    expect(() => resumeDocumentSchema.parse(doubled)).toThrow(/only once/i);
  });

  it("allows repeated custom sections, which are user-labelled", () => {
    const doc: unknown = {
      ...midCareerResume,
      sections: [
        ...midCareerResume.sections,
        { id: "sec-custom-2", type: "custom", visible: true, label: "Volunteering", entries: [] },
      ],
    };
    expect(() => resumeDocumentSchema.parse(doc)).not.toThrow();
  });

  it("rejects duplicate section ids", () => {
    const doc: unknown = {
      ...midCareerResume,
      sections: [
        ...midCareerResume.sections,
        { id: "sec-summary", type: "custom", visible: true, label: "Awards", entries: [] },
      ],
    };
    expect(() => resumeDocumentSchema.parse(doc)).toThrow(/unique/i);
  });

  it("strips unknown top-level keys rather than preserving them", () => {
    const withExtra = { ...midCareerResume, secretTrackingId: "nope" };
    const parsed = resumeDocumentSchema.parse(withExtra);
    expect(parsed).not.toHaveProperty("secretTrackingId");
  });
});

describe("contactSchema", () => {
  it("permits every field empty while the user is still typing", () => {
    const blank = { fullName: "", email: "", phone: "", location: "", links: [] };
    expect(() => contactSchema.parse(blank)).not.toThrow();
  });

  it("accepts a half-typed email, because the store persists every keystroke", () => {
    // Rejecting this would mean a refresh mid-word discards the whole
    // draft, since the migration chain parses on load. Format is checked
    // by the builder form and the lint engine, where the user can act on
    // it — see the note above `isValidEmail` in schema.ts.
    const partial = { fullName: "A", email: "jo", phone: "", location: "", links: [] };
    expect(() => contactSchema.parse(partial)).not.toThrow();
  });

  it("trims surrounding whitespace", () => {
    const parsed = contactSchema.parse({
      fullName: "  Ada Lovelace  ",
      email: "",
      phone: "",
      location: "",
      links: [],
    });
    expect(parsed.fullName).toBe("Ada Lovelace");
  });

  it("has no field for a photo, date of birth, gender, or nationality", () => {
    const keys = Object.keys(
      contactSchema.parse({ fullName: "", email: "", phone: "", location: "", links: [] }),
    );
    for (const forbidden of ["photo", "photoUrl", "dateOfBirth", "dob", "gender", "nationality"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("dateRangeSchema", () => {
  it("accepts an ongoing range with no end date", () => {
    const range = { start: { year: 2023, month: 1 }, end: null, current: true };
    expect(() => dateRangeSchema.parse(range)).not.toThrow();
  });

  it("rejects an ongoing range that also carries an end date", () => {
    const range = { start: { year: 2023, month: 1 }, end: { year: 2024, month: 1 }, current: true };
    expect(() => dateRangeSchema.parse(range)).toThrow();
  });

  it("rejects a finished range with no end date", () => {
    const range = { start: { year: 2023, month: 1 }, end: null, current: false };
    expect(() => dateRangeSchema.parse(range)).toThrow();
  });

  it("rejects an end date before the start date", () => {
    const range = {
      start: { year: 2024, month: 5 },
      end: { year: 2023, month: 1 },
      current: false,
    };
    expect(() => dateRangeSchema.parse(range)).toThrow(/before the start/i);
  });

  it("accepts a year-only range", () => {
    const range = {
      start: { year: 2020, month: null },
      end: { year: 2022, month: null },
      current: false,
    };
    expect(() => dateRangeSchema.parse(range)).not.toThrow();
  });

  it("rejects an out-of-range month", () => {
    const range = { start: { year: 2020, month: 13 }, end: null, current: true };
    expect(() => dateRangeSchema.parse(range)).toThrow();
  });
});

describe("settingsSchema", () => {
  it("accepts the defaults", () => {
    expect(() => settingsSchema.parse(DEFAULT_SETTINGS)).not.toThrow();
  });

  it.each([
    ["accent without a hash", { accent: "1F2937" }],
    ["three-digit accent", { accent: "#fff" }],
    ["margins below the legibility floor", { margins: 0.2 }],
    ["margins above the ceiling", { margins: 2 }],
    ["font size below the floor", { fontSizePt: 6 }],
    ["line height below single spacing", { lineHeight: 0.5 }],
    ["unknown page size", { pageSize: "A3" }],
    ["unknown font pair", { fontPair: "comic" }],
  ])("rejects %s", (_label, override) => {
    expect(() => settingsSchema.parse({ ...DEFAULT_SETTINGS, ...override })).toThrow();
  });

  it("defaults to A4, since the audience is global rather than US-only", () => {
    expect(DEFAULT_SETTINGS.pageSize).toBe("A4");
  });
});

describe("isValidEmail / isValidUrl", () => {
  it("accepts realistic addresses and rejects malformed ones", () => {
    for (const good of ["a@b.co", "jose.munoz@example.com", "first+tag@sub.domain.org"]) {
      expect(isValidEmail(good), good).toBe(true);
    }
    for (const bad of ["", "jo", "no-at-sign.com", "a@b", "a b@c.com", "@example.com"]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });

  it("accepts only http and https URLs", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
    for (const bad of ["", "example.com", "javascript:alert(1)", "mailto:a@b.co", "ftp://x.com"]) {
      expect(isValidUrl(bad), bad).toBe(false);
    }
  });

  it("ignores surrounding whitespace, matching how the schema trims", () => {
    expect(isValidEmail("  a@b.co  ")).toBe(true);
    expect(isValidUrl("  https://example.com  ")).toBe(true);
  });
});
