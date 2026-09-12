/**
 * P34 acceptance.
 *
 * **The test that carries the package is the first block: no coach message
 * is a sentence that could be pasted into a resume.** That is the D8
 * boundary, and it is the one property a reviewer cannot check by reading —
 * a helpful-sounding phrase slipped into a `hint` six months from now would
 * look like an improvement in the diff and be a model writing someone's
 * resume for them in effect.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeBullet,
  hasOutcome,
  hasStrongAction,
  partsPresent,
  BULLET_PARTS,
  PART_LABELS,
  type CoachNote,
} from "./parse-bullet";
import { midCareerResume, fresherResume } from "@/test/fixtures/resumes";

/** Every string this module can put in front of a user, for one fixture set. */
const SAMPLE_BULLETS = [
  "",
  "Worked on the deployment pipeline",
  "Responsible for the billing system",
  "Rebuilt the ingestion path",
  "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared pipeline.",
  "I led the migration",
  "Managed",
  "Led a four-person team through a zero-downtime migration of 2.3 billion ledger rows.",
];

function allNotes(): CoachNote[] {
  return SAMPLE_BULLETS.flatMap((bullet) => analyzeBullet(bullet).notes);
}

/* -------------------------------------------------------------------------- */

describe("no coach message could be pasted into a resume (D8)", () => {
  it("ends every question with a question mark", () => {
    for (const note of allNotes()) {
      expect(note.question.endsWith("?"), note.question).toBe(true);
    }
  });

  it("names a missing part in every gap, rather than asserting anything about the work", () => {
    for (const note of allNotes()) {
      expect(note.gap.length, note.part).toBeGreaterThan(5);
      // A gap describes the *bullet*. If one ever began with a past-tense
      // achievement verb it would have started describing the person.
      expect(/^(Cut|Built|Led|Shipped|Delivered|Grew|Reduced|Increased)\b/.test(note.gap)).toBe(
        false,
      );
    }
  });

  it("never supplies a number", () => {
    // The single most valuable thing a coach could invent, and the single
    // most damaging. Every quantity on a resume has to be one the user knows.
    for (const note of allNotes()) {
      for (const field of [note.gap, note.question, note.hint]) {
        expect(/\d/.test(field), field).toBe(false);
      }
    }
  });

  it("never offers a completed example bullet", () => {
    // A hint that reads "e.g. Cut deploy time from 38 minutes to 6" is a
    // sentence somebody will paste. Hints point at where to look instead.
    for (const note of allNotes()) {
      expect(/\be\.?g\.?\b|for example|such as “|try:/i.test(note.hint), note.hint).toBe(false);
    }
  });
});

describe("it fires where it should", () => {
  it("asks for a result when the bullet has none", () => {
    const notes = analyzeBullet("Rebuilt the ingestion path").notes;
    expect(notes.some((n) => n.part === "outcome")).toBe(true);
  });

  it("asks what you did when the bullet is duty-phrased", () => {
    const notes = analyzeBullet("Responsible for the billing system").notes;
    const action = notes.find((n) => n.part === "action");
    expect(action).toBeDefined();
    expect(action?.gap).toMatch(/describes the job/i);
  });

  it("names the weak opening word back to the user", () => {
    // "handled", not "worked on": the latter is in `DUTY_PHRASES`, so it
    // takes the duty branch — which is the better message for it, and is
    // asserted separately above.
    const action = analyzeBullet("Handled the deployment pipeline").notes.find(
      (n) => n.part === "action",
    );
    expect(action?.gap).toContain("handled");
  });

  it("reads a result stated as the verb rather than as a number", () => {
    // "Cut shortlisting time from three days to under an hour" contains no
    // digit and no connective. Asking its author what changed would be the
    // coach failing to read the bullet it is commenting on.
    const analysis = analyzeBullet(
      "Cut shortlisting time from three days to under an hour by automating eligibility filtering.",
    );
    expect(analysis.present.outcome).toBe(true);
    expect(analysis.notes).toEqual([]);
  });

  it("flags a first-person pronoun", () => {
    const notes = analyzeBullet("I led the migration").notes;
    expect(notes.some((n) => n.gap.includes("first-person"))).toBe(true);
  });

  it("asks what was acted on when the bullet is barely a phrase", () => {
    const notes = analyzeBullet("Managed things").notes;
    expect(notes.some((n) => n.part === "what")).toBe(true);
  });

  it("puts the missing result first, because it is the costliest gap", () => {
    const notes = analyzeBullet("Worked on the deployment pipeline").notes;
    expect(notes[0]?.part).toBe("outcome");
  });
});

describe("it stays quiet where it should", () => {
  it("says nothing about a complete bullet", () => {
    const complete =
      "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared pipeline.";
    expect(analyzeBullet(complete).notes).toEqual([]);
    expect(partsPresent(analyzeBullet(complete))).toBe(4);
  });

  it("says nothing about an empty bullet", () => {
    // A blank field already has an empty state and a hint. Four questions on
    // top of it is noise at exactly the moment somebody is trying to start.
    expect(analyzeBullet("").notes).toEqual([]);
    expect(analyzeBullet("   ").notes).toEqual([]);
    expect(analyzeBullet("Managed").notes).toEqual([]);
  });

  it("stays quiet on every bullet in the shipped fixtures", () => {
    // The fixtures are written as good resumes are. If the coach fires on
    // them, it is the coach that is wrong — the same inversion the X-Ray
    // scorecard uses on the same documents.
    const noisy: string[] = [];
    for (const document of [midCareerResume, fresherResume]) {
      for (const section of document.sections) {
        if (!("entries" in section)) continue;
        for (const entry of section.entries) {
          if (!("bullets" in entry)) continue;
          for (const bullet of entry.bullets) {
            if (!bullet.trim()) continue;
            const notes = analyzeBullet(bullet).notes;
            // "How" is the softest of the four and is legitimately absent
            // from a well-written result-first bullet.
            const hard = notes.filter((n) => n.part !== "how");
            if (hard.length > 0) noisy.push(`${bullet} → ${hard.map((n) => n.part).join(", ")}`);
          }
        }
      }
    }
    expect(noisy).toEqual([]);
  });

  it("accepts an outcome stated without a number", () => {
    // A bullet can name a result without quantifying it. That is a weaker
    // bullet, not an outcome-less one, and the coach must ask for the number
    // rather than for the result it can already see.
    const analysis = analyzeBullet("Replaced the nightly export, eliminating a manual step");
    expect(analysis.present.outcome).toBe(true);
    expect(analysis.notes.some((n) => n.part === "outcome")).toBe(false);
  });
});

describe("the part detectors agree with the lint engine", () => {
  it("calls the same verbs weak", () => {
    expect(hasStrongAction("Worked on the pipeline")).toBe(false);
    expect(hasStrongAction("Helped with the migration")).toBe(false);
    expect(hasStrongAction("Rebuilt the pipeline")).toBe(true);
    expect(hasStrongAction("The pipeline was rebuilt")).toBe(false);
  });

  it("calls the same things quantities", () => {
    expect(hasOutcome("Cut latency 40%")).toBe(true);
    expect(hasOutcome("Doubled throughput")).toBe(true);
    expect(hasOutcome("Rebuilt the pipeline")).toBe(false);
  });
});

describe("the count is a count, not a score (D12)", () => {
  it("counts parts out of four", () => {
    expect(BULLET_PARTS).toHaveLength(4);
    expect(partsPresent(analyzeBullet("Rebuilt the ingestion path"))).toBeLessThan(4);
    expect(
      partsPresent(
        analyzeBullet("Cut deploy time from 38 minutes to 6 by consolidating the pipeline."),
      ),
    ).toBe(4);
  });

  it("labels every part", () => {
    for (const part of BULLET_PARTS) expect(PART_LABELS[part].length).toBeGreaterThan(1);
  });
});
