/**
 * P33 acceptance.
 *
 * **The test that matters is the first one: every shipped scaffold passes
 * the entire lint engine clean.** If the phrase bank cannot satisfy our own
 * rules, it is the phrase bank that is wrong — a product that suggested text
 * its own checker then flagged would be worse than one that suggested
 * nothing.
 *
 * The rest guard the D8 boundary (nothing here is a completed claim), the
 * O\*NET licence condition (attribution is a condition, not a courtesy), and
 * landmine 10 (exact-first, claim-once title matching).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_SCAFFOLDS, BLANK, DEFAULT_TOPIC_IDS, PHRASE_TOPICS, getTopic } from "./scaffolds";
import { OccupationIndex, phrasesForTitle, type PhrasesData } from "./lookup";
import { lint } from "@/lib/lint/engine";
import { createEmptyResume } from "@/lib/resume/factory";
import {
  SECTION_PRESETS,
  buildPresetSection,
  getSectionPreset,
} from "@/lib/resume/section-presets";
import { resumeDocumentSchema, type ResumeDocument } from "@/lib/resume/schema";

const PHRASES_FILE = path.join(process.cwd(), "data", "phrases.json");

function readPhrasesData(): PhrasesData {
  return JSON.parse(readFileSync(PHRASES_FILE, "utf8")) as PhrasesData;
}

/**
 * A complete, otherwise-clean resume whose bullets are the scaffolds.
 *
 * Chunked across several roles because `bulletsSchema` caps one entry at
 * fifty and there are more scaffolds than that — a resume the schema rejects
 * would make the lint assertion below vacuous rather than strict. Every role
 * carries the same date shape so `dates/inconsistent-precision` cannot fire
 * on an artefact of the fixture.
 */
const MAX_BULLETS_PER_ROLE = 25;

function resumeOfScaffolds(bullets: readonly string[]): ResumeDocument {
  const base = createEmptyResume();
  const chunks: string[][] = [];
  for (let i = 0; i < bullets.length; i += MAX_BULLETS_PER_ROLE) {
    chunks.push([...bullets.slice(i, i + MAX_BULLETS_PER_ROLE)]);
  }

  return {
    ...base,
    contact: {
      fullName: "Priya Raghunathan",
      email: "priya@example.com",
      phone: "+1 415 555 0134",
      location: "Oakland, CA",
      links: [],
    },
    sections: base.sections.map((section) =>
      section.type === "experience"
        ? {
            ...section,
            entries: chunks.map((chunk, index) => ({
              id: `lint-role-${index}`,
              title: "Senior Platform Engineer",
              organization: "Meridian Health",
              location: "Oakland, CA",
              dates: {
                start: { year: 2020 + index, month: 3 },
                end: { year: 2021 + index, month: 3 },
                current: false,
              },
              bullets: chunk,
            })),
          }
        : section,
    ),
  };
}

/* -------------------------------------------------------------------------- */

describe("the whole phrase bank lints clean under our own engine", () => {
  it("produces no errors and no warnings across every scaffold at once", () => {
    const document = resumeOfScaffolds(ALL_SCAFFOLDS);
    expect(resumeDocumentSchema.safeParse(document).success).toBe(true);

    const result = lint(document);
    const blocking = result.findings.filter((f) => f.severity !== "info");

    expect(
      blocking.map((f) => `${f.ruleId}: ${f.message}`),
      "a scaffold the product's own lint engine rejects must not ship",
    ).toEqual([]);
    expect(result.outstanding).toBe(0);
  });

  it("names the rules that were actually exercised, so this cannot pass vacuously", () => {
    // A lint-clean assertion is worthless if the bullets never reached the
    // rules. This is the guard: a deliberately bad bullet must be caught by
    // the same run that the scaffolds pass.
    const bad = resumeOfScaffolds(["Responsible for helping with our team's deployment process."]);
    const ruleIds = lint(bad).findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("bullets/duty-phrasing");
    expect(ruleIds).toContain("bullets/first-person");
    expect(ruleIds).toContain("bullets/weak-verb");
  });

  it("lints clean one scaffold at a time as well as all together", () => {
    // Together they could mask each other — `experience/no-quantified-outcome`
    // fires per role, not per bullet, so one accidentally-numeric scaffold
    // would silence it for all of them.
    for (const scaffold of ALL_SCAFFOLDS) {
      const blocking = lint(resumeOfScaffolds([scaffold])).findings.filter(
        (f) => f.severity !== "info",
      );
      expect(
        blocking.map((f) => f.ruleId),
        `"${scaffold}"`,
      ).toEqual([]);
    }
  });
});

describe("no scaffold is a completed claim (D8)", () => {
  it("gives every scaffold at least one visible blank", () => {
    for (const scaffold of ALL_SCAFFOLDS) {
      expect(scaffold.includes(BLANK), scaffold).toBe(true);
    }
  });

  it("uses a blank that is unmistakable rather than a placeholder word", () => {
    // "Cut [metric] from [x] to [y]" reads as something to fill in only if
    // you already know the convention. Underscores do not need explaining,
    // and — the part that matters — they cannot be mistaken for a claim the
    // user made and forgot to edit.
    expect(BLANK).toBe("___");
    for (const scaffold of ALL_SCAFFOLDS) {
      expect(/\[[^\]]+\]|\{[^}]+\}|<[^>]+>/.test(scaffold), scaffold).toBe(false);
    }
  });

  it("states no quantity of its own", () => {
    // A digit in a scaffold is a number the user did not write. That is the
    // exact thing D8 forbids, and it would also silence
    // `experience/no-quantified-outcome` on a resume that has earned it.
    for (const scaffold of ALL_SCAFFOLDS) {
      expect(/\d/.test(scaffold), scaffold).toBe(false);
    }
  });

  it("keeps every scaffold short enough to be a bullet", () => {
    for (const scaffold of ALL_SCAFFOLDS) {
      expect(scaffold.split(/\s+/).length, scaffold).toBeLessThan(20);
    }
  });

  it("gives every topic a unique id, a label and at least three scaffolds", () => {
    expect(new Set(PHRASE_TOPICS.map((t) => t.id)).size).toBe(PHRASE_TOPICS.length);
    for (const topic of PHRASE_TOPICS) {
      expect(topic.label.length, topic.id).toBeGreaterThan(3);
      expect(topic.hint.length, topic.id).toBeGreaterThan(10);
      expect(topic.scaffolds.length, topic.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("resolves every default topic id", () => {
    for (const id of DEFAULT_TOPIC_IDS) expect(getTopic(id), id).not.toBeNull();
  });
});

describe("the occupation index", () => {
  it("matches an exact title before any containing one (landmine 10)", () => {
    const index = new OccupationIndex([
      { code: "1", title: "Engineer", alternates: [], topics: ["delivery"] },
      { code: "2", title: "Backend Engineer", alternates: [], topics: ["quality"] },
      { code: "3", title: "Senior Backend Engineer", alternates: [], topics: ["leadership"] },
    ]);

    // Each of these is a substring of the next. Greedy matching hands the
    // junior title the senior one's index and nobody notices.
    expect(index.resolve("Engineer")?.code).toBe("1");
    expect(index.resolve("Backend Engineer")?.code).toBe("2");
    expect(index.resolve("Senior Backend Engineer")?.code).toBe("3");
  });

  it("prefers the longest contained title when nothing matches exactly", () => {
    const index = new OccupationIndex([
      { code: "1", title: "Engineer", alternates: [], topics: [] },
      { code: "2", title: "Backend Engineer", alternates: [], topics: [] },
    ]);
    expect(index.resolve("Staff Backend Engineer, Payments")?.code).toBe("2");
  });

  it("never lets an alternate title shadow another occupation's real name", () => {
    const index = new OccupationIndex([
      { code: "1", title: "Chef", alternates: ["Cook"], topics: [] },
      { code: "2", title: "Cook", alternates: [], topics: [] },
    ]);
    // "Cook" is occupation 2's canonical title. Registering alternates in the
    // same pass would let occupation 1 claim it first and make 2 unreachable.
    expect(index.resolve("Cook")?.code).toBe("2");
  });

  it("ranks a prefix match above a merely contained one", () => {
    const index = new OccupationIndex([
      { code: "1", title: "Tax Preparer, Public Accountant", alternates: [], topics: [] },
      { code: "2", title: "Accountant", alternates: [], topics: [] },
    ]);
    expect(index.search("account")[0]?.code).toBe("2");
  });

  it("returns nothing for a query too short to mean anything", () => {
    const index = new OccupationIndex([{ code: "1", title: "Nurse", alternates: [], topics: [] }]);
    expect(index.search("n")).toEqual([]);
  });
});

describe("the committed index", () => {
  const data = readPhrasesData();

  it("stays inside the 2 MB budget", () => {
    const bytes = Buffer.byteLength(readFileSync(PHRASES_FILE, "utf8"));
    expect(bytes).toBeLessThan(2 * 1024 * 1024);
  });

  it("carries real occupations and a lot of alternate titles", () => {
    expect(data.occupations.length).toBeGreaterThan(500);
    const alternates = data.occupations.reduce((n, o) => n + o.alternates.length, 0);
    expect(alternates).toBeGreaterThan(5000);
  });

  it("reproduces no O*NET task statement", () => {
    // The licence permits it; our own lint engine does not. Task statements
    // are duty-shaped, which `bullets/duty-phrasing` exists to flag — so they
    // are read at build time to derive topics and then discarded. This
    // asserts the discard, on the occupation records themselves: the
    // `sources` note is *about* the tasks and legitimately says the word.
    const serialized = JSON.stringify(data.occupations);
    expect(serialized).not.toMatch(/\btasks?\b/i);

    for (const occupation of data.occupations) {
      expect(Object.keys(occupation).sort()).toEqual(["alternates", "code", "title", "topics"]);
      // Every retained string is a job title. A task statement is a
      // *sentence* — it ends in a full stop — so that is the shape check
      // that catches one leaking in. Length is not: O*NET genuinely lists
      // "Air Defense Command, Control, Communications, Computers and
      // Intelligence Tactical Operations Center Enhanced Operator/Maintainer"
      // as a job title, at 128 characters.
      for (const title of [occupation.title, ...occupation.alternates]) {
        expect(title.endsWith("."), title).toBe(false);
        expect(title.length, title).toBeLessThan(200);
      }
      for (const topic of occupation.topics) {
        expect(
          PHRASE_TOPICS.some((t) => t.id === topic),
          `${occupation.code}: ${topic}`,
        ).toBe(true);
      }
    }
  });

  it("attributes O*NET with its version and the date it was accessed", () => {
    // CC BY makes this a condition of use, not a courtesy — so it is a test,
    // not a note in a README that nobody re-reads.
    const onet = data.sources.find((source) => /O\*NET/.test(source.name));
    expect(onet, "no O*NET source recorded in data/phrases.json").toBeDefined();
    expect(onet?.licence).toBe("CC BY 4.0");
    expect(onet?.name).toMatch(/\d+\.\d+/);
    expect(onet?.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onet?.url).toContain("onetcenter.org");
  });

  it("is attributed in docs/ATTRIBUTION.md as well as in the data file", () => {
    const attribution = readFileSync(path.join(process.cwd(), "docs", "ATTRIBUTION.md"), "utf8");
    expect(attribution).toContain("phrases.json");
    expect(attribution).toMatch(/Alternate Titles/);
  });
});

describe("phrasesForTitle", () => {
  it("finds topics for a title the index knows", async () => {
    const result = await phrasesForTitle("Software Developer");
    expect(result.occupation).not.toBeNull();
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.relatedTitles.length).toBeGreaterThan(0);
  });

  it("falls back to the default topics rather than opening empty", async () => {
    const result = await phrasesForTitle("Chief Vibes Officer");
    expect(result.occupation).toBeNull();
    expect(result.topics.map((t) => t.id)).toEqual([...DEFAULT_TOPIC_IDS]);
  });

  it("returns something usable for an empty title", async () => {
    const result = await phrasesForTitle("");
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.topics.every((t) => t.scaffolds.length > 0)).toBe(true);
  });
});

describe("section presets", () => {
  it("builds a valid custom section from every preset", () => {
    const base = createEmptyResume();
    for (const preset of SECTION_PRESETS) {
      const document = {
        ...base,
        sections: [...base.sections, buildPresetSection(preset)],
      };
      const parsed = resumeDocumentSchema.safeParse(document);
      expect(parsed.success, `${preset.id}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("gives each a fresh id, so adding two does not collide", () => {
    const a = buildPresetSection(SECTION_PRESETS[0]!);
    const b = buildPresetSection(SECTION_PRESETS[0]!);
    expect(a.id).not.toBe(b.id);
  });

  it("starts each with one empty entry rather than none", () => {
    for (const preset of SECTION_PRESETS) {
      expect(buildPresetSection(preset).entries, preset.id).toHaveLength(1);
    }
  });

  it("resolves by id, and nothing by a bad one", () => {
    expect(getSectionPreset("languages")?.label).toBe("Languages");
    expect(getSectionPreset("nope")).toBeNull();
  });

  it("claims no outcome in any hint (D14)", () => {
    const FORBIDDEN =
      /\b(guarantee\w*|beat\s+the|more\s+interviews?|get\s+(you\s+)?hired|recruiters?\s+love)\b/i;
    for (const preset of SECTION_PRESETS) {
      expect(FORBIDDEN.test(preset.hint), preset.id).toBe(false);
    }
  });
});
