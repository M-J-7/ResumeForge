/**
 * JSON Resume interop (M2-T6).
 *
 * M2-T6's acceptance is "export re-imports cleanly", so the round trip over
 * every fixture is the test that matters. The rest guard the two ways an
 * interop format goes wrong quietly: emitting something a third-party
 * consumer cannot read, and reading a third-party file into a document the
 * rest of the app then chokes on.
 */

import { describe, expect, it } from "vitest";
import {
  EXTENSION_KEY,
  JSON_RESUME_SCHEMA_URL,
  fromJsonResume,
  joinLocation,
  parseDate,
  splitLocation,
  toJsonResume,
} from "./json-resume";
import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/schema";
import { ALL_FIXTURES, midCareerResume } from "@/test/fixtures/resumes";

const NOW = new Date("2026-08-31T12:00:00.000Z");

/**
 * What the export legitimately drops.
 *
 * A blank bullet is an editing state — the user pressed "add" and has not
 * typed yet — not content, and writing empty strings into a file other tools
 * read would be untidy. The round trip is asserted against a document with
 * those already removed, so the assertion stays exact rather than fuzzy.
 */
function withoutBlanks(doc: ResumeDocument): ResumeDocument {
  const clean = (values: readonly string[]) =>
    values.map((v) => v.trim()).filter((v) => v.length > 0);

  return {
    ...doc,
    sections: doc.sections.map((section) => {
      if (section.type === "skills") {
        return {
          ...section,
          groups: section.groups.map((g) => ({ ...g, skills: clean(g.skills) })),
        };
      }
      if ("entries" in section) {
        return {
          ...section,
          entries: section.entries.map((entry) =>
            "bullets" in entry ? { ...entry, bullets: clean(entry.bullets) } : entry,
          ),
        } as typeof section;
      }
      return section;
    }),
  };
}

describe("round trip (M2-T6 acceptance)", () => {
  it.each(ALL_FIXTURES.map((f) => [f.name, f.document] as const))(
    "re-imports its own export of %s without loss",
    (_name, document) => {
      const exported = toJsonResume(document, { now: NOW });
      const result = fromJsonResume(JSON.parse(JSON.stringify(exported)), { now: NOW });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.document).toEqual(withoutBlanks(document));
    },
  );

  it("survives a second trip unchanged", () => {
    // Idempotence, not just reversibility: an export/import cycle that drifts
    // a little each time is worse than one that fails, because nobody notices.
    const once = fromJsonResume(toJsonResume(midCareerResume, { now: NOW }), { now: NOW });
    expect(once.ok).toBe(true);
    if (!once.ok) return;

    const twice = fromJsonResume(toJsonResume(once.document, { now: NOW }), { now: NOW });
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    expect(twice.document).toEqual(once.document);
  });

  it("keeps section order, visibility, and ids", () => {
    const reordered: ResumeDocument = {
      ...midCareerResume,
      sections: [...midCareerResume.sections].reverse().map((section, index) => ({
        ...section,
        visible: index % 2 === 0,
      })),
    };

    const result = fromJsonResume(toJsonResume(reordered, { now: NOW }), { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // JSON Resume has no concept of either; without the extension block,
    // re-importing your own file would silently reorder your resume.
    expect(result.document.sections.map((s) => s.type)).toEqual(
      reordered.sections.map((s) => s.type),
    );
    expect(result.document.sections.map((s) => s.id)).toEqual(reordered.sections.map((s) => s.id));
    expect(result.document.sections.map((s) => s.visible)).toEqual(
      reordered.sections.map((s) => s.visible),
    );
  });

  it("keeps the rendering settings", () => {
    const tuned: ResumeDocument = {
      ...midCareerResume,
      settings: { ...midCareerResume.settings, pageSize: "LETTER", fontSizePt: 10, margins: 0.6 },
    };
    const result = fromJsonResume(toJsonResume(tuned, { now: NOW }), { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.settings).toEqual(tuned.settings);
  });
});

describe("the exported file", () => {
  const exported = toJsonResume(midCareerResume, { now: NOW });

  it("declares the schema it follows", () => {
    expect(exported.$schema).toBe(JSON_RESUME_SCHEMA_URL);
  });

  it("puts our extras where the schema allows them", () => {
    // `additionalProperties: false` applies at the root and nowhere else, so
    // a top-level key of our own would make the file invalid.
    const rootKeys = Object.keys(exported);
    expect(rootKeys.filter((key) => key.startsWith("x_"))).toEqual([]);
    expect(exported.meta[EXTENSION_KEY]).toBeDefined();
  });

  it("uses only root properties the schema defines", () => {
    const allowed = new Set([
      "$schema",
      "basics",
      "work",
      "volunteer",
      "education",
      "awards",
      "certificates",
      "publications",
      "skills",
      "languages",
      "interests",
      "references",
      "projects",
      "meta",
    ]);
    for (const key of Object.keys(exported)) {
      expect(allowed.has(key), `unexpected root property ${key}`).toBe(true);
    }
  });

  it("maps roles and employers the way the format does, not the way we do", () => {
    // Ours is title/organization; JSON Resume's is position/name. Getting
    // these the wrong way round produces a file that looks right to us and
    // is nonsense to every other reader.
    const first = exported.work?.[0];
    expect(first?.position).toBe("Senior Backend Engineer");
    expect(first?.name).toBe("Contoso Payments");
  });

  it("omits endDate for an ongoing role rather than inventing one", () => {
    const ongoing = exported.work?.find((entry) => entry.endDate === undefined);
    expect(ongoing).toBeDefined();
  });

  it("writes no empty strings or empty arrays", () => {
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value !== "object" || value === null) return;
      for (const [key, entry] of Object.entries(value)) {
        expect(entry, `${key} should have been omitted`).not.toBe("");
        walk(entry);
      }
    };
    walk({ ...exported, meta: {} });
  });

  it("has a fixed timestamp when given one, so exports are comparable", () => {
    expect(exported.meta.lastModified).toBe(NOW.toISOString());
  });
});

describe("importing a foreign file", () => {
  /** A minimal resume as another tool would produce it: no extension block. */
  const foreign = {
    basics: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      location: { city: "London", region: "United Kingdom" },
      profiles: [{ network: "LinkedIn", url: "https://example.com/ada" }],
      summary: "Mathematician.",
    },
    work: [
      {
        name: "Analytical Engine Co",
        position: "Programmer",
        startDate: "2019-01",
        endDate: "2022",
        highlights: ["Wrote the first published algorithm."],
      },
    ],
    education: [
      { institution: "Private tuition", studyType: "Mathematics", courses: ["Calculus"] },
    ],
    skills: [{ name: "Languages", keywords: ["Analytical Engine notation"] }],
  };

  it("produces a document the rest of the app can use unconditionally", () => {
    const result = fromJsonResume(foreign, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The final gate: whatever the file claimed, this parses.
    expect(resumeDocumentSchema.safeParse(result.document).success).toBe(true);
  });

  it("reads the fields across", () => {
    const result = fromJsonResume(foreign, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.contact.fullName).toBe("Ada Lovelace");
    expect(result.document.contact.location).toBe("London, United Kingdom");
    expect(result.document.contact.links[0]?.label).toBe("LinkedIn");

    const work = result.document.sections.find((s) => s.type === "experience");
    expect(work?.type === "experience" && work.entries[0]).toMatchObject({
      title: "Programmer",
      organization: "Analytical Engine Co",
      dates: { start: { year: 2019, month: 1 }, end: { year: 2022, month: null }, current: false },
    });
  });

  it("falls back to `courses` rather than dropping education detail", () => {
    const result = fromJsonResume(foreign, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const education = result.document.sections.find((s) => s.type === "education");
    expect(education?.type === "education" && education.entries[0]?.bullets).toEqual(["Calculus"]);
  });

  it("uses the default section order when the file carries none", () => {
    const result = fromJsonResume(foreign, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.sections.map((s) => s.type)).toEqual([
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
    ]);
  });

  it("invents a date only where our schema demands one the file lacks", () => {
    const result = fromJsonResume(foreign, { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const education = result.document.sections.find((s) => s.type === "education");
    expect(education?.type === "education" && education.entries[0]?.dates.start.year).toBe(2026);
  });

  it("refuses something that is not a resume", () => {
    expect(fromJsonResume({ hello: "world" }, { now: NOW })).toMatchObject({ ok: false });
    expect(fromJsonResume("not json at all", { now: NOW })).toMatchObject({ ok: false });
    expect(fromJsonResume(null, { now: NOW })).toMatchObject({ ok: false });
  });

  it("ignores settings it cannot trust", () => {
    // A hand-edited file could ask for a 400pt font. Settings drive page
    // geometry, so an unchecked value renders a broken PDF rather than an
    // ugly one.
    const result = fromJsonResume(
      { ...foreign, meta: { [EXTENSION_KEY]: { settings: { fontSizePt: 400, margins: -5 } } } },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.settings.fontSizePt).toBeLessThanOrEqual(12);
  });

  it("takes the first of a duplicated section rather than failing outright", () => {
    const result = fromJsonResume(
      {
        ...foreign,
        meta: {
          [EXTENSION_KEY]: {
            sections: [
              { type: "experience", visible: true },
              { type: "experience", visible: true },
            ],
          },
        },
      },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.sections.map((s) => s.type)).toEqual(["experience"]);
  });
});

describe("location", () => {
  it.each([
    ["Berlin, Germany", { city: "Berlin", region: "Germany" }],
    ["Remote", { city: "Remote" }],
    ["  Bengaluru , Karnataka ", { city: "Bengaluru", region: "Karnataka" }],
  ])("splits %s", (input, expected) => {
    expect(splitLocation(input)).toEqual(expected);
  });

  it("round-trips anything with at most one comma", () => {
    for (const value of ["Berlin, Germany", "Remote", "London"]) {
      expect(joinLocation(splitLocation(value))).toBe(value.trim());
    }
  });

  it("has nothing to say about an empty location", () => {
    expect(splitLocation("   ")).toBeUndefined();
    expect(joinLocation(undefined)).toBe("");
  });
});

describe("parseDate", () => {
  it.each([
    ["2024", { year: 2024, month: null }],
    ["2024-03", { year: 2024, month: 3 }],
    // Day precision is discarded — a resume never prints one.
    ["2024-03-15", { year: 2024, month: 3 }],
  ])("reads %s", (input, expected) => {
    expect(parseDate(input)).toEqual(expected);
  });

  it.each([["", "March 2024", "24-03", "2024-13", "1800", null, 2024]])("rejects %s", (input) => {
    expect(parseDate(input)).toBeNull();
  });
});
