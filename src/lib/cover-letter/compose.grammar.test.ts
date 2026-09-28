/**
 * Does the letter read as English? (P28-I4)
 *
 * The four guarantees in `compose.test.ts` are about *honesty* — every
 * sentence traceable, no claim the resume does not support, gaps left visible.
 * All four held while the composer was emitting "At Acme, I responsible for
 * the regional ledger", because not one of them asks whether a sentence is a
 * sentence.
 *
 * That is the gap this file closes. Its assertions are about grammar and
 * nothing else, and every case below is a shape a real resume bullet takes.
 */

import { describe, expect, it } from "vitest";
import { parseJobDescription } from "@/lib/jd/parse";
import { scoreResume } from "@/lib/match/score";
import { buildSkillIndex } from "@/lib/skills/lookup";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";
import { classifyBulletForm } from "./bullet-form";
import { composeCoverLetter, type ComposeInput } from "./compose";
import { ANGLES, TONES } from "./phrasing";

const skills = buildSkillIndex();

const JOB_DESCRIPTION = `Senior Platform Engineer

Requirements
- 5+ years with Kubernetes in production
- Strong Terraform experience
- Proficient in Go
`;

const jd = parseJobDescription(JOB_DESCRIPTION);

/** A resume whose only experience entry carries exactly the bullets given. */
function resumeWith(bullets: string[], organization = "Acme"): ResumeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contact: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "",
      location: "London",
      links: [],
    },
    sections: [
      {
        id: "sec-exp",
        type: "experience",
        visible: true,
        entries: [
          {
            id: "exp-1",
            title: "Platform Engineer",
            organization,
            location: "London",
            dates: { start: { year: 2021, month: 4 }, end: null, current: true },
            bullets,
          },
        ],
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function compose(resume: ResumeDocument, overrides: Partial<ComposeInput> = {}) {
  return composeCoverLetter({
    resume,
    match: scoreResume(resume, jd, { skills }),
    company: "Northwind",
    roleTitle: "Senior Platform Engineer",
    tone: "direct",
    angle: "impact",
    ...overrides,
  });
}

function evidenceText(resume: ResumeDocument, overrides: Partial<ComposeInput> = {}): string {
  const document = compose(resume, overrides);
  return document.paragraphs.find((paragraph) => paragraph.role === "evidence")?.text ?? "";
}

/* -------------------------------------------------------------------------- */

describe("the bullet-form classifier", () => {
  it.each([
    ["Cut settlement processing from 40 minutes to 6.", "pastVerb"],
    ["Led the migration of 2.1 billion ledger rows.", "pastVerb"],
    ["Rebuilt the ingestion path in Go.", "pastVerb"],
    // The `-ed` fallback, for regular verbs outside the lexicon.
    ["Reconciled 40 vendor accounts every month.", "pastVerb"],
    ["Responsible for the regional ledger.", "dutyPhrase"],
    ["In charge of a team of six.", "dutyPhrase"],
    ["Tasked with closing the quarter.", "dutyPhrase"],
    ["Managing a team of six across two sites.", "gerund"],
    ["Leading the migration of 40 services.", "gerund"],
    ["My team shipped the settlement rewrite.", "ownSubject"],
    ["The migration cut costs by 30%.", "ownSubject"],
    ["Duties included closing the monthly ledger.", "ownSubject"],
    ["Open dataset and notebook series on high-street footfall.", "nounPhrase"],
    ["Key contributor to the billing redesign.", "nounPhrase"],
    ["Team lead for the checkout rewrite.", "nounPhrase"],
    // A determiner with no finite verb near it is a noun phrase, not a clause.
    ["The regional ledger for EMEA and APAC.", "nounPhrase"],
    // An `-ing` word that is not a verb must not become a gerund.
    ["Engineering team of six across two sites.", "nounPhrase"],
    // `-ed` adjectives are not verbs.
    ["Advanced analytics for the trading desk.", "nounPhrase"],
    ["Distributed systems work across four teams.", "nounPhrase"],
    ["AWS migration across 40 services.", "unsafeLead"],
    ["40 services moved to Kubernetes.", "unsafeLead"],
    ["I led the billing rewrite.", "unsafeLead"],
  ])("classifies %j as %s", (bullet, form) => {
    expect(classifyBulletForm(bullet)).toBe(form);
  });
});

describe("every bullet form composes into a sentence", () => {
  it("puts a copula in front of a duty phrase", () => {
    expect(evidenceText(resumeWith(["Responsible for the regional ledger."]))).toContain(
      "At Acme, I was responsible for the regional ledger.",
    );
  });

  it("gives a gerund a frame that takes one", () => {
    expect(evidenceText(resumeWith(["Managing a team of six across two sites."]))).toContain(
      "At Acme, my work included managing a team of six across two sites.",
    );
  });

  it("does not put 'I' in front of a bullet that has its own subject", () => {
    const text = evidenceText(resumeWith(["My team shipped the settlement rewrite."]));
    expect(text).toContain("At Acme, my team shipped the settlement rewrite.");
    expect(text).not.toContain("I my team");
  });

  it("labels a noun phrase rather than claiming it is a verb", () => {
    const text = evidenceText(resumeWith(["Key contributor to the billing redesign."]));
    expect(text).toContain("At Acme: Key contributor to the billing redesign.");
  });

  it("keeps the ordinary past-tense frame untouched", () => {
    expect(evidenceText(resumeWith(["Cut settlement processing from 40 minutes to 6."]))).toContain(
      "At Acme, I cut settlement processing from 40 minutes to 6.",
    );
  });

  /**
   * The regression that named this file.
   *
   * `src/lib/examples/roles.ts` ships this bullet under the project
   * `uk-retail-footfall`, and the composer turned it into "At
   * uk-retail-footfall, I open dataset and notebook series…" on the example
   * page the product uses to teach people how to write a resume.
   */
  it("does not turn the shipped data-analyst project bullet into gibberish", () => {
    const bullet =
      "Open dataset and notebook series on high-street footfall, cited in two local-government planning reports.";
    const text = evidenceText(resumeWith([bullet], "uk-retail-footfall"));
    expect(text).not.toContain("I open dataset");
    expect(text).toContain(`uk-retail-footfall: ${bullet}`);
  });
});

describe("the letter never splices a non-verb after 'I'", () => {
  /**
   * The property test, run over every example resume the product ships.
   *
   * Wherever an evidence sentence says "I <word>", that word must be a verb.
   * This is the assertion whose absence let every defect above ship, and it is
   * deliberately phrased over the *output* rather than over the classifier, so
   * a future frame that reintroduces the bug fails here even if the classifier
   * is right.
   */
  const VERB_AFTER_I = /\bI ([a-z][a-z']*)/g;

  it.each(ROLE_EXAMPLES.map((example) => [example.slug, example] as const))(
    "composes grammatical evidence for the %s example",
    (_slug, example) => {
      for (const tone of TONES) {
        for (const angle of ANGLES) {
          const text = evidenceText(example.resume, { tone, angle });
          for (const [, word] of text.matchAll(VERB_AFTER_I)) {
            if (!word) continue;
            // "I was <duty phrase>" is the copula frame; the word after it is
            // the bullet's own, and is not required to be a verb.
            if (word === "was") continue;
            const form = classifyBulletForm(`${word[0]?.toUpperCase()}${word.slice(1)} x`);
            expect(form, `"I ${word}" in ${_slug} (${tone}/${angle}): ${text}`).toBe("pastVerb");
          }
        }
      }
    },
  );
});

describe("the letter does not invent a chronology", () => {
  it("never says 'More recently' about two bullets from the same job", () => {
    const text = evidenceText(
      resumeWith([
        "Cut settlement processing from 40 minutes to 6.",
        "Led the migration of 2.1 billion ledger rows.",
        "Rebuilt the ingestion path in Go.",
      ]),
    );
    expect(text).not.toContain("More recently");
    expect(text).toContain("In the same role,");
  });

  it("never claims an older entry is more recent", () => {
    for (const example of ROLE_EXAMPLES) {
      for (const tone of TONES) {
        const text = evidenceText(example.resume, { tone });
        // "More recently" is licensed only by a lower entry index, which the
        // composer checks. Its mere absence is not the assertion — the
        // assertion is that it never follows a same-entry continuation.
        expect(
          /In the same role,[^.]*\.\s*More recently,/.test(text),
          `${example.slug} (${tone}): ${text}`,
        ).toBe(false);
      }
    }
  });
});

describe("the opening does not restate itself", () => {
  it("does not name the same title twice when applying for the role it holds", () => {
    const resume = resumeWith(["Cut settlement processing from 40 minutes to 6."]);
    const document = compose(resume, { roleTitle: "Platform Engineer" });
    const opening = document.paragraphs.find((p) => p.role === "opening")?.text ?? "";
    const occurrences = opening.split("Platform Engineer").length - 1;
    expect(occurrences, opening).toBe(1);
  });
});

describe("the posting is quoted, not paraphrased", () => {
  it("quotes the requirement the next sentence answers", () => {
    const resume = resumeWith(["Rebuilt the ingestion path in Go, cutting p99 latency to 210ms."]);
    const alignment = compose(resume).paragraphs.find((p) => p.role === "alignment")?.text ?? "";
    expect(alignment).toContain("\u201cProficient in Go\u201d");
    expect(alignment).toContain("Go is in the work above.");
    // The echo already named the posting; the old frame would repeat it.
    expect(alignment).not.toContain("Your posting asks for Go.");
  });

  it("never quotes a length-of-experience requirement", () => {
    // "5+ years with Kubernetes" is the highest-weighted line in the fixture
    // posting. Quoting it beside "Kubernetes is in the work above" would imply
    // a claim about duration that the match engine never checked.
    const resume = resumeWith(["Migrated 40 services onto a shared Kubernetes cluster."]);
    const alignment = compose(resume).paragraphs.find((p) => p.role === "alignment")?.text ?? "";
    expect(alignment).not.toContain("5+ years");
    expect(alignment).toContain("Kubernetes");
  });

  it("drops a requirement line too long to sit in a sentence", () => {
    const wordy = parseJobDescription(
      `Engineer\n\nRequirements\n- Proficient in Go, and comfortable owning a service end to end including its deployment, its alerting, its on-call rota and its capacity planning\n`,
    );
    const resume = resumeWith(["Rebuilt the ingestion path in Go, cutting p99 latency to 210ms."]);
    const document = composeCoverLetter({
      resume,
      match: scoreResume(resume, wordy, { skills }),
      company: "Northwind",
      roleTitle: "Engineer",
      tone: "direct",
      angle: "impact",
    });
    const alignment = document.paragraphs.find((p) => p.role === "alignment")?.text ?? "";
    // Over the ceiling: no quote, but the paragraph still makes its claim.
    expect(alignment).not.toContain("“");
    expect(alignment).toContain("Go");
    expect(alignment).toContain("the work above");
  });
});

describe("the letter is long enough to be a letter", () => {
  it("carries three pieces of evidence and a call to action", () => {
    const resume = resumeWith([
      "Cut settlement processing from 40 minutes to 6.",
      "Led the migration of 2.1 billion ledger rows with zero downtime.",
      "Rebuilt the ingestion path in Go, taking p99 latency to 210ms.",
      "Mentored four engineers, two of whom now own services end to end.",
    ]);
    const document = compose(resume);
    const text = document.paragraphs.map((p) => p.text).join(" ");
    expect(text).toContain("Cut settlement processing".toLowerCase());
    expect(text).toContain("2.1 billion ledger rows");
    expect(text).toContain("p99 latency");
    // The closing asks for the next step rather than merely offering.
    expect(text).toMatch(/arrange a conversation|available for an interview/);
  });

  it("is materially longer than the two-bullet letter it replaces", () => {
    for (const example of ROLE_EXAMPLES) {
      const text = compose(example.resume, { roleTitle: example.role })
        .paragraphs.map((p) => p.text)
        .join(" ");
      const words = text.split(/\s+/).filter(Boolean).length;
      expect(words, `${example.slug}: ${words} words`).toBeGreaterThan(110);
    }
  });
});
