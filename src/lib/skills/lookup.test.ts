/**
 * M3-T1's acceptance: "alias lookup resolves a 50-case test set."
 *
 * The cases below are written as the strings people actually type — the
 * ones taken from real resumes and real postings — rather than as the
 * canonical names, because resolving canonical names to themselves proves
 * nothing.
 */

import { describe, expect, it } from "vitest";
import { buildSkillIndex, normalizeTerm, type SkillEntry } from "./lookup";
import { CURATED_SKILLS } from "./curated";

const index = buildSkillIndex();

/** [written form, expected skill id] */
const CASES: ReadonlyArray<readonly [string, string]> = [
  ["k8s", "kubernetes"],
  ["K8s", "kubernetes"],
  ["kube", "kubernetes"],
  ["Kubernetes", "kubernetes"],
  ["EKS", "kubernetes"],
  ["JS", "javascript"],
  ["js", "javascript"],
  ["ES6", "javascript"],
  ["JavaScript", "javascript"],
  ["ECMAScript", "javascript"],
  ["TS", "typescript"],
  ["TypeScript", "typescript"],
  ["GCP", "gcp"],
  ["Google Cloud", "gcp"],
  ["Google Cloud Platform", "gcp"],
  ["AWS", "aws"],
  ["Amazon Web Services", "aws"],
  ["Azure", "azure"],
  ["Microsoft Azure", "azure"],
  ["RN", "react-native"],
  ["React Native", "react-native"],
  ["ReactJS", "react"],
  ["React.js", "react"],
  ["react", "react"],
  ["Next.js", "nextjs"],
  ["next js", "nextjs"],
  ["Vue", "vue"],
  ["VueJS", "vue"],
  ["Postgres", "postgresql"],
  ["PostgreSQL", "postgresql"],
  ["psql", "postgresql"],
  ["Mongo", "mongodb"],
  ["MongoDB", "mongodb"],
  ["Node", "nodejs"],
  ["node.js", "nodejs"],
  ["NodeJS", "nodejs"],
  ["Golang", "go"],
  ["Go", "go"],
  ["C++", "cpp"],
  ["C#", "csharp"],
  ["c sharp", "csharp"],
  [".NET", "dotnet"],
  ["ASP.NET", "dotnet"],
  ["CI/CD", "cicd"],
  ["continuous integration", "cicd"],
  ["ML", "machine-learning"],
  ["Machine Learning", "machine-learning"],
  ["NLP", "nlp"],
  ["sklearn", "scikit-learn"],
  ["scikit-learn", "scikit-learn"],
  ["Keras", "tensorflow"],
  ["a11y", "accessibility"],
  ["WCAG", "accessibility"],
  ["TDD", "tdd"],
  ["Scrum", "agile"],
  ["Excel", "excel"],
  ["MS Excel", "excel"],
  ["PowerBI", "power-bi"],
  ["A/B testing", "ab-testing"],
  ["GraphQL", "graphql"],
  ["REST API", "rest"],
  ["RESTful", "rest"],
  ["Spring Boot", "spring"],
  ["Rails", "rails"],
  ["Terraform", "terraform"],
  ["LLMs", "llm"],
  ["generative AI", "llm"],
];

describe("resolveSkill — the 50-case acceptance set (M3-T1)", () => {
  it("has at least 50 cases", () => {
    // The acceptance criterion is a number, so it is asserted rather than
    // assumed: deleting cases to make a failure go away should fail too.
    expect(CASES.length).toBeGreaterThanOrEqual(50);
  });

  it.each(CASES)("resolves %s to %s", (written, expectedId) => {
    expect(index.resolve(written)?.id).toBe(expectedId);
  });
});

/** Every skill each word of a sentence resolves to, in order. */
function skillsInWords(sentence: string, lookup = index): string[] {
  return normalizeTerm(sentence)
    .split(" ")
    .filter(Boolean)
    .map((word) => lookup.resolve(word)?.canonical)
    .filter((canonical): canonical is string => Boolean(canonical));
}

/**
 * Ordinary English must not resolve to anything.
 *
 * ## The bug this exists because of
 *
 * `REST APIs` carried `"rest"` as an alias, and `skillsInLine` resolves single
 * tokens — so "covered the rest of the region" and "patients were on bed rest"
 * both reported a REST APIs match. `curated.ts` states the rule this broke in
 * its own header ("do not add an alias that is a common English word"), and
 * the rule had nothing enforcing it. Found while assembling the QA §11 corpus,
 * where a teacher's resume came back demonstrating REST APIs.
 *
 * A false positive here is worse than a miss, and worse in a specific way. A
 * miss tells a candidate to add something they already have, and they can see
 * it is wrong. A false positive tells them they *demonstrate* a skill they
 * have never used — and the cover-letter composer will then write a sentence
 * about it, which is the exact failure this product exists to prevent.
 *
 * These sentences are the shape of the ones in `src/lib/examples/roles.ts` and
 * in ordinary postings. None of them is about software.
 *
 * The single-token path is written out rather than calling `skillsInLine`,
 * which would make this file depend on `src/lib/match` for one assertion. The
 * rule is about the vocabulary, so it is checked against the vocabulary.
 */
describe("ordinary English resolves to no skill", () => {
  const SENTENCES = [
    "Covered the rest of the region while two colleagues were on leave.",
    "Patients were placed on bed rest for forty-eight hours.",
    "Rest days are rostered a month in advance.",
    "Ran the rest of the meeting after the chair left.",
    "Reduced waiting times across the whole of the department.",
    "Led the team through a difficult year without losing anybody.",
  ];

  it.each(SENTENCES)("finds nothing in %s", (sentence) => {
    expect(skillsInWords(sentence)).toEqual([]);
  });
});

/**
 * The two collisions this vocabulary keeps, and why.
 *
 * Pinned rather than fixed, and pinned rather than quietly left out of the
 * suite above — a reader who finds "rest" defended by a test should also find
 * out that two others were looked at and kept, and on what grounds.
 *
 * - **`Go`** is the language's actual name. It collides with the verb through
 *   its *canonical* form, not an alias, so there is no alias to remove: the
 *   only fixes are renaming a programming language or making resolution
 *   context-sensitive, and the second is a real piece of work rather than a
 *   two-line change.
 * - **`excel`** is a deliberate alias. On a resume or in a posting the
 *   spreadsheet is overwhelmingly the intended sense, and dropping it would
 *   miss the single most common way people write it. `common-words.ts` reaches
 *   the same conclusion from the other direction: "excel is uncommon in
 *   English prose and ubiquitous in job postings".
 *
 * Both are narrower than `"rest"` was: they need the word in a verb sense that
 * is rare in the register these documents are written in, where "rest" is not
 * rare at all.
 */
describe("the two collisions this vocabulary accepts", () => {
  it.each([
    ["Handled the go-live and everything that came after it.", "Go"],
    ["Set out to excel in a department that had never been measured.", "Microsoft Excel"],
  ])("%s still resolves to %s", (sentence, canonical) => {
    expect(skillsInWords(sentence)).toContain(canonical);
  });
});

describe("normalizeTerm", () => {
  it("keeps the characters that carry meaning in technology names", () => {
    // Strip these naively and C++ becomes "c", C# becomes "c", and the two
    // languages become the same skill.
    expect(normalizeTerm("C++")).toBe("c++");
    expect(normalizeTerm("C#")).toBe("c#");
    expect(normalizeTerm(".NET")).toBe(".net");
    expect(normalizeTerm("CI/CD")).toBe("ci/cd");
    expect(normalizeTerm("Node.js")).toBe("node.js");
  });

  it("strips prose punctuation and collapses whitespace", () => {
    expect(normalizeTerm("  Kubernetes,  ")).toBe("kubernetes");
    expect(normalizeTerm("(React)")).toBe("react");
    expect(normalizeTerm("React—Native")).toBe("react native");
  });

  it("treats hyphens and spaces as the same separator", () => {
    expect(normalizeTerm("scikit-learn")).toBe(normalizeTerm("scikit learn"));
  });
});

describe("safe singularisation", () => {
  it("does not turn AWS into AW", () => {
    // The bug this guards: a blanket trailing-s strip breaks every acronym
    // ending in S, and the failure is silent — the term simply stops
    // resolving.
    expect(index.resolve("AWS")?.id).toBe("aws");
  });

  it("does not turn Kubernetes into Kubernete", () => {
    expect(index.resolve("Kubernetes")?.id).toBe("kubernetes");
  });

  it("only strips the s when the singular is itself a skill", () => {
    expect(index.resolve("microservices")?.id).toBe("microservices");
    expect(index.resolve("LLMs")?.id).toBe("llm");
  });
});

describe("non-skills resolve to null", () => {
  it.each([
    "team",
    "communication skills and",
    "the",
    "",
    "   ",
    "responsible for delivering",
    ",",
  ])("returns null for %j", (term) => {
    expect(index.resolve(term)).toBeNull();
  });
});

describe("curated entries win over ingested ones", () => {
  it("prefers our casing and aliases for a colliding id", () => {
    // O*NET ships an entry literally named "Python". Ours carries the
    // aliases and the category, so it has to be the one that wins.
    const ingested: SkillEntry[] = [
      { id: "python", canonical: "python", aliases: [], category: "other", source: "onet" },
    ];
    const merged = buildSkillIndex(ingested);
    const resolved = merged.resolve("py");

    expect(resolved?.canonical).toBe("Python");
    expect(resolved?.source).toBe("curated");
  });

  it("keeps ingested entries that do not collide", () => {
    const ingested: SkillEntry[] = [
      {
        id: "adobe-acrobat",
        canonical: "Adobe Acrobat",
        aliases: [],
        category: "office",
        source: "onet",
      },
    ];
    const merged = buildSkillIndex(ingested);
    expect(merged.resolve("Adobe Acrobat")?.source).toBe("onet");
  });
});

describe("the curated list itself", () => {
  it("has no duplicate ids", () => {
    const ids = CURATED_SKILLS.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no alias that collides with a different skill's canonical name", () => {
    // A collision here is silent and wrong: one skill quietly absorbs
    // another's name, and the matcher reports the wrong canonical term.
    const canonical = new Map(CURATED_SKILLS.map((s) => [normalizeTerm(s.canonical), s.id]));
    for (const skill of CURATED_SKILLS) {
      for (const alias of skill.aliases) {
        const owner = canonical.get(normalizeTerm(alias));
        if (owner !== undefined) expect(owner).toBe(skill.id);
      }
    }
  });

  it("resolves every canonical name to its own entry", () => {
    for (const skill of CURATED_SKILLS) {
      expect(index.resolve(skill.canonical)?.id).toBe(skill.id);
    }
  });
});
