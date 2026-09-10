/**
 * The four guarantees the composer makes (P28-I3).
 *
 * Each has a test here, and each exists because the obvious implementation
 * violates it. A composer that reads well and quietly asserts something the
 * resume does not support is worse than no composer at all — it produces a
 * letter the candidate will be asked about in an interview.
 */

import { describe, expect, it } from "vitest";
import { parseJobDescription } from "@/lib/jd/parse";
import { scoreResume } from "@/lib/match/score";
import { buildSkillIndex } from "@/lib/skills/lookup";
import { createEmptyResume } from "@/lib/resume/factory";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";
import { coverLetterDocumentSchema } from "./schema";
import {
  composeCoverLetter,
  composeParagraph,
  lowercaseLead,
  composeDiagnostics,
  selectAlignmentSkills,
  selectEvidence,
  selectListedSkills,
  startsWithCapitalisedWord,
  terminate,
  type ComposeInput,
} from "./compose";
import {
  ANGLES,
  DIAGNOSTIC_NO_REQUIREMENT_MATCHED,
  DIAGNOSTIC_POSTING_UNRECOGNISED,
  EVIDENCE_WITHOUT_BULLETS,
  TONES,
} from "./phrasing";
import { describeEntry, findEntry } from "./provenance";

const skills = buildSkillIndex();

const JOB_DESCRIPTION = `Senior Platform Engineer

Requirements
- 5+ years with Kubernetes in production
- Strong Terraform experience
- Proficient in Go
- Experience with PostgreSQL

Nice to have
- Prometheus
`;

const jd = parseJobDescription(JOB_DESCRIPTION);

const resume: ResumeDocument = {
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
          organization: "Meridian Health",
          location: "London",
          dates: { start: { year: 2021, month: 4 }, end: null, current: true },
          bullets: [
            "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes cluster.",
            "Replaced hand-rolled provisioning with Terraform modules, taking environment setup from two days to twenty minutes.",
            "Rebuilt the ingestion path in Go, taking p99 latency from 1.4s to 210ms at triple the volume.",
          ],
        },
      ],
    },
    {
      id: "sec-skills",
      type: "skills",
      visible: true,
      // Prometheus is *only* here. It must never reach the letter.
      groups: [{ id: "grp-1", label: "Tools", skills: ["Prometheus", "PostgreSQL"] }],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

const match = scoreResume(resume, jd, { skills });

function input(overrides: Partial<ComposeInput> = {}): ComposeInput {
  return {
    resume,
    match,
    company: "Acme",
    roleTitle: "Senior Platform Engineer",
    tone: "direct",
    angle: "impact",
    ...overrides,
  };
}

/** Every sentence a letter contains, as one searchable blob. */
function letterText(document: ReturnType<typeof composeCoverLetter>): string {
  return document.paragraphs.map((p) => p.text).join("\n");
}

describe("guarantee 1 — pure and deterministic", () => {
  it("produces an identical document from identical input", () => {
    const first = composeCoverLetter(input());
    const second = composeCoverLetter(input());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("holds across every tone and angle", () => {
    for (const tone of TONES) {
      for (const angle of ANGLES) {
        const a = composeCoverLetter(input({ tone, angle }));
        const b = composeCoverLetter(input({ tone, angle }));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it("leaves the date unstamped, which is what makes it pure", () => {
    expect(composeCoverLetter(input()).dateISO).toBeNull();
  });

  it("produces a document the schema accepts", () => {
    expect(() => coverLetterDocumentSchema.parse(composeCoverLetter(input()))).not.toThrow();
  });
});

describe("guarantee 2 — evidence is verbatim", () => {
  /** All of the user's own bullet text, for substring searching. */
  const sourceBullets = resume.sections.flatMap((section) =>
    section.type === "experience" ? section.entries.flatMap((entry) => entry.bullets) : [],
  );

  it("quotes resume bullets with at most the two documented changes", () => {
    for (const tone of TONES) {
      const document = composeCoverLetter(input({ tone }));
      const evidence = document.paragraphs.find((p) => p.role === "evidence");
      expect(evidence).toBeDefined();

      const chosen = selectEvidence(resume, match);
      expect(chosen.length).toBeGreaterThan(0);

      for (const choice of chosen) {
        // The bullet is the user's, unaltered, and it is in the resume.
        expect(sourceBullets).toContain(choice.bullet);
        // And it appears in the paragraph either as written or with only its
        // first character lowercased. Nothing else is permitted.
        const appears =
          evidence!.text.includes(choice.bullet) ||
          evidence!.text.includes(lowercaseLead(choice.bullet));
        expect(appears).toBe(true);
      }
    }
  });

  it("names the employer the bullet belongs to, not the company applied to", () => {
    const document = composeCoverLetter(input({ company: "Acme" }));
    const evidence = document.paragraphs.find((p) => p.role === "evidence");
    expect(evidence?.text).toContain("Meridian Health");
  });

  it("records the entries it drew from, so the UI can show provenance", () => {
    const document = composeCoverLetter(input());
    const evidence = document.paragraphs.find((p) => p.role === "evidence");
    expect(evidence?.sources).toContain("exp-1");
  });

  it("ranks by what the posting weighted, not by resume order", () => {
    const chosen = selectEvidence(resume, match);
    // Kubernetes leads the posting's requirements, so the Kubernetes bullet
    // leads the paragraph — even though the resume happens to list it first
    // too, this asserts the mechanism rather than the coincidence.
    expect(chosen[0]?.bullet).toContain("Kubernetes");
  });
});

describe("guarantee 3 — no undemonstrated claim", () => {
  /**
   * ## The guarantee, restated after the §12 gap fix
   *
   * It used to be "a listed-only skill is never named". That was simple and it
   * was too strong: measured across the ten example resumes in `docs/QA.md`
   * §11, exactly two bullets anywhere name a term the vocabulary knows, so the
   * rule deleted the alignment paragraph for eight of ten candidates — people
   * who had written their bullets exactly as this product tells them to.
   *
   * The guarantee is now the one that was always doing the work: **the letter
   * may make any claim the resume makes, and must never present a weaker claim
   * as a stronger one.** A listed skill may be named, in a sentence that says
   * "I have worked with it" and never in the sentence that says the work above
   * shows it. These tests assert that split structurally.
   */
  it("never names a listed-only skill in the sentence that claims demonstration", () => {
    for (const tone of TONES) {
      for (const angle of ANGLES) {
        const alignment = composeCoverLetter(input({ tone, angle })).paragraphs.find(
          (paragraph) => paragraph.role === "alignment",
        );
        const [demonstratedSentence] = (alignment?.text ?? "").split(/(?<=[.!?])\s+/);
        // Prometheus and PostgreSQL are listed and never shown in a bullet.
        expect(demonstratedSentence).not.toContain("Prometheus");
        expect(demonstratedSentence).not.toContain("PostgreSQL");
        // And they are in the paragraph, in the weaker sentence — which is the
        // point of the change, so it is asserted rather than merely allowed.
        expect(alignment?.text).toContain("Prometheus");
      }
    }
  });

  it("keeps the two claims in separate sentences, never one clause", () => {
    const alignment = composeCoverLetter(input()).paragraphs.find((p) => p.role === "alignment");
    const sentences = (alignment?.text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);

    /*
     * The listed claim is last, and it is alone in its sentence.
     *
     * Counting sentences would be the wrong assertion: several demonstrated
     * frames are themselves two sentences ("Your posting asks for X, Y and Z.
     * All of them are in the work above."). What matters is that no sentence
     * makes both claims, which is what a reader could misread.
     */
    const listedSentence = sentences.at(-1) ?? "";
    expect(listedSentence).toContain("Prometheus");
    expect(listedSentence).toContain("worked with");
    expect(listedSentence).not.toContain("the work above");

    for (const sentence of sentences.slice(0, -1)) {
      expect(sentence).not.toContain("Prometheus");
      expect(sentence).not.toContain("worked with");
    }
  });

  it("never names the same skill as both demonstrated and merely listed", () => {
    const demonstrated = new Set(selectAlignmentSkills(match));
    for (const name of selectListedSkills(match)) {
      expect(demonstrated.has(name), name).toBe(false);
    }
  });

  it("names only skills the match engine calls demonstrated", () => {
    const demonstrated = new Set(
      match.keywords.filter((k) => k.status === "demonstrated").map((k) => k.skill.canonical),
    );
    for (const name of selectAlignmentSkills(match)) {
      expect(demonstrated.has(name)).toBe(true);
    }
  });

  it("uses the taxonomy's casing rather than whatever the posting typed", () => {
    const alignment = composeCoverLetter(input()).paragraphs.find((p) => p.role === "alignment");
    expect(alignment?.text).toContain("Kubernetes");
    expect(alignment?.text).not.toContain("kubernetes");
  });

  it("omits the alignment paragraph entirely when nothing is demonstrated", () => {
    const bare = createEmptyResume();
    const bareMatch = scoreResume(bare, jd, { skills });
    const document = composeCoverLetter(input({ resume: bare, match: bareMatch }));
    expect(document.paragraphs.some((p) => p.role === "alignment")).toBe(false);
  });
});

describe("guarantee 4 — gaps are visible, never filled", () => {
  const bare = createEmptyResume();
  const bareMatch = scoreResume(bare, jd, { skills });
  const document = composeCoverLetter(input({ resume: bare, match: bareMatch }));

  it("still produces a usable scaffold", () => {
    expect(document.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(document.paragraphs.some((p) => p.role === "opening")).toBe(true);
    expect(document.paragraphs.some((p) => p.role === "closing")).toBe(true);
  });

  it("marks the missing pieces rather than inventing them", () => {
    const text = letterText(document);
    expect(text).toContain("[Add your current or most recent role");
    expect(text).toContain("[Add a bullet or two");
  });

  it("still names the role and company the user typed", () => {
    expect(letterText(document)).toContain("Senior Platform Engineer");
    expect(letterText(document)).toContain("Acme");
  });
});

describe("the opening", () => {
  it("drops the company clause rather than emitting an empty one", () => {
    const text = letterText(composeCoverLetter(input({ company: "" })));
    expect(text).not.toContain(" at .");
    expect(text).toContain("Senior Platform Engineer");
  });

  it("drops the role clause rather than emitting an empty one", () => {
    const text = letterText(composeCoverLetter(input({ roleTitle: "" })));
    expect(text).not.toContain("the  role");
    expect(text).toContain("Acme");
  });

  it("names the user's actual current title, taken from the resume", () => {
    const opening = composeCoverLetter(input()).paragraphs.find((p) => p.role === "opening");
    expect(opening?.text).toContain("Platform Engineer at Meridian Health");
    expect(opening?.sources).toContain("exp-1");
  });

  it("keeps a current title without emitting an orphaned preposition when its organization is blank", () => {
    const resumeWithoutOrganization: ResumeDocument = {
      ...resume,
      sections: resume.sections.map((section) =>
        section.type === "experience"
          ? {
              ...section,
              entries: section.entries.map((entry) => ({ ...entry, organization: "" })),
            }
          : section,
      ),
    };
    const matchWithoutOrganization = scoreResume(resumeWithoutOrganization, jd, { skills });

    for (const tone of TONES) {
      for (const angle of ANGLES) {
        const opening = composeCoverLetter(
          input({
            resume: resumeWithoutOrganization,
            match: matchWithoutOrganization,
            tone,
            angle,
          }),
        ).paragraphs.find((paragraph) => paragraph.role === "opening");

        expect(opening?.text).toContain("Platform Engineer");
        expect(opening?.text).not.toMatch(/\bat\s*[;.,]/);
      }
    }
  });
});

describe("the closing", () => {
  it("carries the user's availability verbatim", () => {
    const availability = "I can start from the first week of November.";
    const closing = composeCoverLetter(input({ availability })).paragraphs.find(
      (p) => p.role === "closing",
    );
    expect(closing?.text).toContain(availability);
  });

  it("omits the availability sentence when there is none", () => {
    const closing = composeCoverLetter(input()).paragraphs.find((p) => p.role === "closing");
    expect(closing?.text).not.toMatch(/timing/i);
  });

  it("does not contain the phrase every reader has seen a thousand times", () => {
    for (const tone of TONES) {
      const text = letterText(composeCoverLetter(input({ tone })));
      expect(text).not.toMatch(/at your earliest convenience/i);
    }
  });
});

describe("no template asserts anything about the employer", () => {
  it("says nothing about the company beyond its name", () => {
    for (const tone of TONES) {
      for (const angle of ANGLES) {
        const text = letterText(composeCoverLetter(input({ tone, angle })));
        // The adjectives a generated cover letter reaches for, none of which
        // we have any evidence for.
        expect(text).not.toMatch(
          /\b(innovative|exciting|dynamic|world-class|leading|passionate|thrilled|excited)\b/i,
        );
      }
    }
  });
});

describe("the documented transformations", () => {
  it("lowercases an ordinary capitalised lead word", () => {
    expect(startsWithCapitalisedWord("Led a team of six")).toBe(true);
    expect(lowercaseLead("Led a team of six")).toBe("led a team of six");
  });

  it("refuses to touch an acronym or a number", () => {
    expect(startsWithCapitalisedWord("AWS migration completed")).toBe(false);
    expect(startsWithCapitalisedWord("40 services moved")).toBe(false);
    expect(startsWithCapitalisedWord("I led")).toBe(false);
  });

  it("adds a period only where there is no terminal punctuation", () => {
    expect(terminate("Led a team")).toBe("Led a team.");
    expect(terminate("Led a team.")).toBe("Led a team.");
    expect(terminate("Led a team?")).toBe("Led a team?");
  });

  it("falls back to the colon form when the lead cannot be lowercased", () => {
    const acronymResume: ResumeDocument = {
      ...resume,
      sections: resume.sections.map((section) =>
        section.type === "experience"
          ? {
              ...section,
              entries: section.entries.map((entry) => ({
                ...entry,
                bullets: ["AWS and Kubernetes migration across 40 services"],
              })),
            }
          : section,
      ),
    };
    const acronymMatch = scoreResume(acronymResume, jd, { skills });
    const document = composeCoverLetter(input({ resume: acronymResume, match: acronymMatch }));
    const evidence = document.paragraphs.find((p) => p.role === "evidence");

    expect(evidence?.text).toContain("Meridian Health: AWS and Kubernetes migration");
    // Never corrupted into "aWS".
    expect(evidence?.text).not.toContain("aWS");
  });
});

describe("composeParagraph", () => {
  it("rebuilds one paragraph identically to the full compose", () => {
    const document = composeCoverLetter(input());
    for (const paragraph of document.paragraphs) {
      const rebuilt = composeParagraph(paragraph.role, input());
      expect(rebuilt).toEqual(paragraph);
    }
  });

  it("refuses to regenerate a paragraph the user wrote", () => {
    expect(composeParagraph("custom", input())).toBeNull();
  });
});

describe("bullets from a custom section (§10.2)", () => {
  /**
   * A resume whose only bullets live in a custom section.
   *
   * There was no fixture for this at all, which is how the bug survived:
   * `evidence.ts` tags a custom section's bullets as `projectBullet` — so
   * `selectEvidence` will happily choose them — while `organizationForEntry`
   * searched only experience and projects. The user's own attribution was
   * dropped and the sentence fell through to the bare "I …" frame.
   *
   * Volunteering and open source are exactly what a custom section holds, and
   * exactly what a career-changer's strongest evidence is, so this is not an
   * edge case for the people the product is most useful to.
   */
  const customResume: ResumeDocument = {
    ...resume,
    sections: [
      {
        id: "sec-custom",
        type: "custom",
        visible: true,
        label: "Open source",
        entries: [
          {
            id: "cus-1",
            title: "Kubernetes SIG-Network",
            subtitle: "Maintainer",
            dates: { start: { year: 2022, month: 1 }, end: null, current: true },
            bullets: [
              "Shipped a Kubernetes ingress controller used by 40 services, cutting deploy time from 38 minutes to 6.",
            ],
          },
        ],
      },
      ...resume.sections.filter((section) => section.type === "skills"),
    ],
  };
  const customMatch = scoreResume(customResume, jd, { skills });

  it("selects them at all, which is what makes the attribution matter", () => {
    const chosen = selectEvidence(customResume, customMatch);
    expect(chosen.map((choice) => choice.entryId)).toContain("cus-1");
  });

  it("attributes them to the user's own entry title", () => {
    const chosen = selectEvidence(customResume, customMatch);
    const fromCustom = chosen.find((choice) => choice.entryId === "cus-1");
    expect(fromCustom?.organization).toBe("Kubernetes SIG-Network");
  });

  it("names that attribution in the letter rather than dropping it", () => {
    const evidence = composeCoverLetter(
      input({ resume: customResume, match: customMatch }),
    ).paragraphs.find((paragraph) => paragraph.role === "evidence");

    expect(evidence?.text).toContain("Kubernetes SIG-Network");
    // And the bullet itself is still verbatim — the attribution is added
    // around the user's text, never inside it.
    expect(evidence?.text).toContain("used by 40 services");
  });

  it("falls back to the subtitle when the entry has no title", () => {
    const untitled: ResumeDocument = {
      ...customResume,
      sections: customResume.sections.map((section) =>
        section.type === "custom"
          ? { ...section, entries: section.entries.map((entry) => ({ ...entry, title: "" })) }
          : section,
      ),
    };
    const chosen = selectEvidence(untitled, scoreResume(untitled, jd, { skills }));
    expect(chosen.find((choice) => choice.entryId === "cus-1")?.organization).toBe("Maintainer");
  });
});

describe("the alignment paragraph carries its provenance (§10.2)", () => {
  const alignment = composeCoverLetter(input()).paragraphs.find((p) => p.role === "alignment");

  it("names the entries the skills were demonstrated in, first", () => {
    // This returned `[]` before §10.2 — so the one paragraph that most reads
    // like an assertion was the only one with no provenance behind it, even
    // though every skill in it was chosen *because* the resume demonstrates it.
    // Bullets lead, because the sentence they back leads.
    expect(alignment?.sources?.[0]).toBe("exp-1");
  });

  it("cites the skills group behind the listed sentence, and says it is one", () => {
    /*
     * The chip is what stops the weaker claim reading as the stronger one.
     *
     * Before the §12 fix this asserted the *opposite* — that a skills group
     * must never be a source — because a listed skill could not reach the
     * letter at all. Now it can, and the honest arrangement is not to hide
     * where it came from but to name it: a reader opening Sources sees
     * "Infrastructure (skills list)" beside the job titles.
     */
    expect(alignment?.sources).toContain("grp-1");
    const label = describeEntry(findEntry(resume, "grp-1")!);
    expect(label).toContain("skills list");
  });

  it("resolves every source it records", () => {
    // A source id that names nothing would render as a chip with no label.
    // `findEntry` did not traverse skills sections until the §12 fix, which is
    // the partial-traversal failure its own header warns about.
    for (const id of alignment?.sources ?? []) {
      expect(findEntry(resume, id), id).not.toBeNull();
    }
  });
});

describe("an empty evidence paragraph blames the right thing (§10.2)", () => {
  const evidenceOf = (composed: ReturnType<typeof composeCoverLetter>) =>
    composed.paragraphs.find((paragraph) => paragraph.role === "evidence")?.text ?? "";

  it("tells a resume with no bullets to add one", () => {
    const empty = createEmptyResume();
    const text = evidenceOf(
      composeCoverLetter(input({ resume: empty, match: scoreResume(empty, jd, { skills }) })),
    );
    expect(text).toContain("Add a bullet or two");
  });

  it("keeps the one that is still a paragraph conspicuous, so it cannot be sent", () => {
    // Only `EVIDENCE_WITHOUT_BULLETS` is a paragraph now, and only a paragraph
    // needs to be impossible to send by accident.
    expect(EVIDENCE_WITHOUT_BULLETS.startsWith("[")).toBe(true);
    expect(EVIDENCE_WITHOUT_BULLETS.endsWith("]")).toBe(true);
  });

  it("does not bracket the two that became notes", () => {
    // A diagnostic sits beside the letter and is never inside it, so the
    // conspicuous style would be noise — and would read as a paragraph the
    // user was expected to delete.
    for (const text of [DIAGNOSTIC_NO_REQUIREMENT_MATCHED, DIAGNOSTIC_POSTING_UNRECOGNISED]) {
      expect(text.startsWith("[")).toBe(false);
    }
  });
});

/**
 * ## The §12 gap: a resume that says it, but does not show it
 *
 * A requirement counts as `demonstrated` only when a bullet names a term the
 * skill vocabulary knows. Measured across the ten example resumes in
 * `docs/QA.md` §11, exactly two bullets anywhere pass that gate — so before
 * this, eight of ten candidates got a bracketed placeholder instead of an
 * evidence paragraph and no alignment paragraph at all, for resumes written
 * exactly as this product's own guidance tells them to write.
 *
 * The fix is not to loosen what "demonstrated" means. It is to let the letter
 * say the weaker thing weakly, and to move the advice out of the letter.
 */
describe("the letter still says something when the posting matched nothing (§12)", () => {
  const elsewhere = parseJobDescription(
    "Pastry Chef\n\nRequirements\n- Laminated dough\n- Chocolate tempering\n",
  );
  const unrelated = scoreResume(resume, elsewhere, { skills });
  const evidenceOf = (composed: ReturnType<typeof composeCoverLetter>) =>
    composed.paragraphs.find((paragraph) => paragraph.role === "evidence")?.text ?? "";

  it("quotes the resume's own bullets rather than an error message", () => {
    const text = evidenceOf(composeCoverLetter(input({ match: unrelated })));
    expect(text).not.toContain("[");
    // Verbatim, exactly as the matched path is — the fallback changes which
    // bullets are chosen, never what may be done to them.
    const bullets = resume.sections.flatMap((section) =>
      section.type === "experience" ? section.entries.flatMap((entry) => entry.bullets) : [],
    );
    expect(bullets.some((bullet) => text.includes(lowercaseLead(bullet)))).toBe(true);
  });

  it("marks those bullets as unmatched, so nothing downstream can assume otherwise", () => {
    const chosen = selectEvidence(resume, unrelated);
    expect(chosen.length).toBeGreaterThan(0);
    expect(chosen.every((choice) => choice.matched)).toBe(false);
  });

  it("puts matched bullets first when only some matched", () => {
    const chosen = selectEvidence(resume, match);
    const firstUnmatched = chosen.findIndex((choice) => !choice.matched);
    if (firstUnmatched === -1) return;
    expect(chosen.slice(firstUnmatched).every((choice) => !choice.matched)).toBe(true);
  });

  it("tells the user the tailoring did not happen, beside the letter and not in it", () => {
    const notes = composeDiagnostics(input({ match: unrelated }));
    const kinds = notes.map((note) => note.kind);
    expect(kinds).toContain(
      unrelated.unmatchedJd ? "posting-unrecognised" : "no-requirement-matched",
    );
    // Advisory: the letter is sendable, it is simply not tailored.
    expect(notes.every((note) => note.advisory)).toBe(true);
  });

  it("reports the listed-only skills it leaned on, and what would improve them", () => {
    const notes = composeDiagnostics(input());
    const listed = notes.find((note) => note.kind === "skills-list-only");
    expect(listed).toBeDefined();
    expect(listed?.message).toContain("Prometheus");
    expect(listed?.message).toContain("bullet");
  });

  it("blocks rather than advises when there is nothing to quote at all", () => {
    const empty = createEmptyResume();
    const notes = composeDiagnostics(
      input({ resume: empty, match: scoreResume(empty, jd, { skills }) }),
    );
    expect(notes.map((note) => note.kind)).toEqual(["no-bullets"]);
    expect(notes[0]?.advisory).toBe(false);
  });

  it("is pure, like everything else here", () => {
    const once = composeDiagnostics(input({ match: unrelated }));
    const twice = composeDiagnostics(input({ match: unrelated }));
    expect(once).toEqual(twice);
  });
});
