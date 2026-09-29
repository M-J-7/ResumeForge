/**
 * The vocabulary outside software (ROADMAP F5), held to the rules that keep a
 * vocabulary from lying.
 *
 * Three kinds of assertion. The first two are about the list — every written
 * term belongs to one entry, and no alias is an everyday word. The third is
 * about the point of it: a nurse, a teacher and an administrative assistant,
 * compared with an invented posting for their own role, now match something,
 * where on 2026-09-29 each posting matched nothing at all.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { parseJobDescription } from "@/lib/jd/parse";
import { scoreResume } from "@/lib/match/score";
import { COMMON_WORD_TIERS } from "./common-words";
import { CURATED_SKILLS } from "./curated";
import { DOMAIN_SKILLS } from "./domain";
import { buildSkillIndex, normalizeTerm, type SkillEntry, type SkillsData } from "./lookup";

const ingested = (
  JSON.parse(readFileSync(path.join(process.cwd(), "data", "skills.json"), "utf8")) as SkillsData
).skills as SkillEntry[];
const index = buildSkillIndex(ingested);

/** Words that are skills in one field and ordinary English everywhere else. */
const EVERYDAY = ["epic", "tally", "lean", "workday", "concur", "send", "bed", "budget", "vitals"];

describe("the curated vocabulary", () => {
  it("gives every written term to exactly one entry", () => {
    // An earlier entry silently wins a collision in `SkillIndex`, so a
    // duplicate is not an error anywhere — it is a skill that can never be
    // matched. "rn" was on React Native and shadowed the nursing licence.
    const owner = new Map<string, string>();
    for (const skill of CURATED_SKILLS) {
      for (const term of [skill.canonical, ...skill.aliases]) {
        const key = normalizeTerm(term);
        const previous = owner.get(key);
        expect(
          previous === undefined || previous === skill.id,
          `"${key}": ${previous} and ${skill.id}`,
        ).toBe(true);
        owner.set(key, skill.id);
      }
    }
  });

  it("uses no everyday word as an alias", () => {
    for (const skill of DOMAIN_SKILLS) {
      for (const term of [skill.canonical, ...skill.aliases]) {
        const key = normalizeTerm(term);
        expect(COMMON_WORD_TIERS.has(key), `"${key}" (${skill.id}) is a common word`).toBe(false);
        expect(EVERYDAY.includes(key), `"${key}" (${skill.id}) is an everyday word`).toBe(false);
      }
    }
  });

  it("resolves the terms people actually write, in every field", () => {
    const expected: Record<string, string> = {
      BLS: "Basic Life Support",
      "wound care": "Wound care",
      "RN license": "Registered Nurse",
      RN: "Registered Nurse",
      "lesson plans": "Lesson planning",
      QTS: "Qualified Teacher Status",
      "diary management": "Calendar management",
      "data entry": "Data entry",
      IFRS: "IFRS",
      GST: "GST",
      "cash handling": "Cash handling",
      rostering: "Staff scheduling",
      "talent acquisition": "Recruiting",
      OSHA: "OSHA",
      SolidWorks: "SolidWorks",
      QuickBooks: "QuickBooks",
      "Office 365": "Microsoft 365",
    };
    for (const [written, canonical] of Object.entries(expected)) {
      expect(index.resolve(written)?.canonical, written).toBe(canonical);
    }
  });

  it("no longer credits the Canvas LMS as Canva", () => {
    // The plural fold dropped the "s" of "canvas" and landed on Canva.
    expect(index.resolve("Canvas")?.canonical).toBe("Canvas LMS");
    expect(index.resolve("Canva")?.canonical).toBe("Canva");
  });
});

/** Invented postings — no real employer, no copied text. */
const POSTINGS: Record<string, string> = {
  "registered-nurse": [
    "Registered Nurse, Medical-Surgical Unit — Harbourview Community Hospital",
    "",
    "Requirements",
    "- Current RN license",
    "- BLS and ACLS certification",
    "- Experience with telemetry, IV therapy and wound care",
    "",
    "Preferred",
    "- Experience with sepsis protocols",
  ].join("\n"),
  teacher: [
    "Mathematics Teacher — Northgate Academy",
    "",
    "Requirements",
    "- Qualified Teacher Status (QTS)",
    "- Experience of curriculum design and assessment moderation",
    "- Safeguarding training",
    "",
    "Desirable",
    "- Intervention planning for exam classes",
  ].join("\n"),
  "administrative-assistant": [
    "Administrative Assistant — Brightwater Logistics",
    "",
    "Requirements",
    "- Diary management for two directors",
    "- Minute taking at board meetings",
    "- Microsoft 365 and SharePoint",
    "",
    "Nice to have",
    "- Xero",
  ].join("\n"),
};

describe("fields that matched nothing before", () => {
  it.each(Object.keys(POSTINGS))("the %s example matches a posting for its own role", (slug) => {
    const example = ROLE_EXAMPLES.find((candidate) => candidate.slug === slug)!;
    const result = scoreResume(example.resume, parseJobDescription(POSTINGS[slug]!), {
      skills: index,
    });

    // Before F5 each of these came back `unmatchedJd`: the posting named
    // nothing the vocabulary knew.
    expect(result.unmatchedJd).toBe(false);
    expect(result.keywords.length).toBeGreaterThanOrEqual(4);
    const found = result.keywords.filter((keyword) => keyword.status !== "missing");
    expect(found.length, found.map((k) => k.skill.canonical).join(", ")).toBeGreaterThanOrEqual(3);
  });
});
