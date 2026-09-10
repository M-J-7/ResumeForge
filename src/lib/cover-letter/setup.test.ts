/**
 * The Recompose snapshot split (§10.2, 2.4).
 *
 * The regression this pins is a UI bug — change Tone, press one paragraph's
 * Recompose, get the old tone back with no indication the control was
 * ignored — but it is asserted here as a node test rather than a jsdom one,
 * which is the whole reason `setup.ts` exists as a separate module. The
 * alternative was mounting the editor, stubbing the resume loader and the
 * skill index, and reading a textarea.
 */

import { describe, expect, it } from "vitest";
import { parseJobDescription } from "@/lib/jd/parse";
import { scoreResume } from "@/lib/match/score";
import { buildSkillIndex } from "@/lib/skills/lookup";
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, type ResumeDocument } from "@/lib/resume/schema";
import { composeParagraph } from "./compose";
import { toComposeInput, type ComposeSetup, type ComposeSources } from "./setup";

const skills = buildSkillIndex();

const resume: ResumeDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "",
    location: "",
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
          ],
        },
      ],
    },
  ],
  settings: { ...DEFAULT_SETTINGS },
};

const jd = parseJobDescription("Senior Platform Engineer\n\nRequirements\n- Kubernetes\n");

const sources: ComposeSources = { resume, match: scoreResume(resume, jd, { skills }) };

function setup(overrides: Partial<ComposeSetup> = {}): ComposeSetup {
  return {
    company: "Acme",
    roleTitle: "Senior Platform Engineer",
    tone: "direct",
    angle: "impact",
    availability: "",
    recipientName: "",
    recipientTitle: "",
    recipientAddress: "",
    salutation: "Dear Hiring Manager,",
    signOff: "Sincerely,",
    ...overrides,
  };
}

describe("toComposeInput", () => {
  it("keeps the frozen sources exactly, by reference", () => {
    // Identity, not equality: re-deriving `match` on a per-paragraph
    // Recompose would be a second parse and score, and — worse — could pick
    // different bullets if the posting had been edited in between.
    const input = toComposeInput(sources, setup());
    expect(input.resume).toBe(resume);
    expect(input.match).toBe(sources.match);
  });

  it("reads the setup live, which is the whole point", () => {
    const direct = composeParagraph("opening", toComposeInput(sources, setup()));
    const formal = composeParagraph("opening", toComposeInput(sources, setup({ tone: "formal" })));

    expect(direct?.text).not.toBe(formal?.text);
  });

  it("carries every control through, not only tone", () => {
    // Each of these was frozen into the old snapshot too, so each could be
    // changed and then silently ignored by a per-paragraph Recompose.
    const closing = composeParagraph(
      "closing",
      toComposeInput(sources, setup({ availability: "I can start in November." })),
    );
    expect(closing?.text).toContain("I can start in November.");

    const opening = composeParagraph("opening", toComposeInput(sources, setup({ angle: "craft" })));
    expect(opening?.text).not.toBe(
      composeParagraph("opening", toComposeInput(sources, setup()))?.text,
    );
  });

  it("fills the recipient's company from the one company field", () => {
    // Two inputs for one company would eventually disagree on the same page.
    const input = toComposeInput(sources, setup({ company: "Northwind" }));
    expect(input.recipient?.company).toBe("Northwind");
    expect(input.company).toBe("Northwind");
  });
});
