/**
 * P36 acceptance for the content itself.
 *
 * Two things a reviewer cannot check by reading: that every example resume
 * is a **valid document that passes our own lint engine**, and that nothing
 * on any of these pages makes a claim D14 forbids.
 *
 * The first matters more than it looks. These pages are the product's public
 * argument about what a good resume is; publishing eight that our own
 * checker would complain about would be the most visible possible way to
 * undermine it.
 */

import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES, EXAMPLE_SLUGS, getRoleExample } from "./roles";
import { GUIDES, GUIDE_SLUGS, getGuide } from "@/lib/guides/guides";
import { lint } from "@/lib/lint/engine";
import { renderText } from "@/lib/emit/text/render";
import { resumeDocumentSchema } from "@/lib/resume/schema";
import { analyzeBullet } from "@/lib/coach/parse-bullet";

/** The phrases D14 forbids, and the ones the category actually uses. */
const OUTCOME_CLAIM =
  /\b(guarantee\w*|beat\s+the\s+(bots?|ats)|ats[- ]proof|will\s+pass\s+(the\s+)?ats|\d+%\s+more\s+interviews?|land\s+you\s+(the\s+)?job|recruiters?\s+love)\b/i;

/**
 * Wording that marks a sentence as *refusing* the claim it contains.
 *
 * "We will not tell you a resume is guaranteed to pass" contains
 * "guaranteed" and is the opposite of the thing D14 forbids — it is D14
 * being stated. A scan that cannot tell the two apart would force the
 * guides to stop naming the claim they exist to refuse, which would make
 * them worse in the name of a test.
 */
const REFUSAL =
  /\b(will not|cannot|can't|nobody can|no one can|does not|is not|are not|never|not\b.*\btell you|guessing|anyone quoting|neither has)\b/i;

/** Sentences that assert something, with the refusals filtered out. */
function assertions(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !REFUSAL.test(sentence));
}

function forbiddenClaimIn(text: string): string | null {
  for (const sentence of assertions(text)) {
    const match = OUTCOME_CLAIM.exec(sentence);
    if (match) return `${match[0]} — in: ${sentence}`;
  }
  return null;
}

function allExampleText(): string {
  return ROLE_EXAMPLES.map(
    (example) =>
      `${example.role} ${example.summary} ` +
      example.notes.map((note) => `${note.title} ${note.body}`).join(" ") +
      renderText(example.resume),
  ).join("\n");
}

function allGuideText(): string {
  return GUIDES.map(
    (guide) =>
      `${guide.title} ${guide.summary} ` +
      guide.sections
        .map(
          (section) =>
            section.heading +
            " " +
            section.blocks
              .map((block) => (block.kind === "list" ? block.items.join(" ") : block.text))
              .join(" "),
        )
        .join(" "),
  ).join("\n");
}

/* -------------------------------------------------------------------------- */

describe("the example resumes", () => {
  it("ships a set worth calling a set", () => {
    expect(ROLE_EXAMPLES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(EXAMPLE_SLUGS).size).toBe(ROLE_EXAMPLES.length);
    expect(new Set(ROLE_EXAMPLES.map((e) => e.field)).size).toBeGreaterThanOrEqual(4);
  });

  it("uses URL-safe, stable slugs", () => {
    // The slug is the page's identity in a search result. A capital or a
    // space in one is a redirect somebody has to maintain forever.
    for (const slug of EXAMPLE_SLUGS) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(ROLE_EXAMPLES.map((e) => [e.slug, e] as const))(
    "%s is a valid document",
    (_slug, example) => {
      const parsed = resumeDocumentSchema.safeParse(example.resume);
      expect(parsed.success, parsed.error?.message).toBe(true);
    },
  );

  it.each(ROLE_EXAMPLES.map((e) => [e.slug, e] as const))(
    "%s passes our own lint engine with no errors or warnings",
    (_slug, example) => {
      // The inversion that matters: these pages argue about what a good
      // resume is. One our own checker complains about would undermine that
      // in the most visible way available.
      const blocking = lint(example.resume).findings.filter((f) => f.severity !== "info");
      expect(blocking.map((f) => `${f.ruleId}: ${f.message}`)).toEqual([]);
    },
  );

  it.each(ROLE_EXAMPLES.map((e) => [e.slug, e] as const))(
    "%s satisfies the bullet coach on every bullet",
    (_slug, example) => {
      // Stronger than lint: the coach asks for a result on every bullet, and
      // an example that cannot answer its own coach is not an example.
      const noisy: string[] = [];
      for (const section of example.resume.sections) {
        if (!("entries" in section)) continue;
        for (const entry of section.entries) {
          if (!("bullets" in entry)) continue;
          for (const bullet of entry.bullets) {
            const hard = analyzeBullet(bullet).notes.filter((n) => n.part !== "how");
            if (hard.length > 0) noisy.push(`${bullet} → ${hard.map((n) => n.part).join(", ")}`);
          }
        }
      }
      expect(noisy).toEqual([]);
    },
  );

  it("gives every example real notes rather than filler", () => {
    for (const example of ROLE_EXAMPLES) {
      expect(example.notes.length, example.slug).toBeGreaterThanOrEqual(3);
      for (const note of example.notes) {
        expect(note.title.length, example.slug).toBeGreaterThan(10);
        expect(note.body.split(/\s+/).length, `${example.slug}: ${note.title}`).toBeGreaterThan(12);
      }
    }
  });

  it("produces plain text substantial enough to be a page body", () => {
    // The whole point of the route: the indexed body is the resume's real
    // machine-readable output, not a picture of one.
    for (const example of ROLE_EXAMPLES) {
      const text = renderText(example.resume);
      expect(text.split(/\s+/).length, example.slug).toBeGreaterThan(120);
      expect(text, example.slug).toContain(example.resume.contact.fullName);
    }
  });

  it("keeps every contact detail in the reserved example ranges", () => {
    // These are published pages. A real-looking address that happens to
    // belong to somebody is a person's inbox, and `example.com` exists
    // precisely so documentation does not have to guess.
    for (const example of ROLE_EXAMPLES) {
      expect(example.resume.contact.email, example.slug).toMatch(/@example\.com$/);
    }
  });

  it("resolves by slug, and nothing by a bad one", () => {
    expect(getRoleExample("software-developer")?.role).toBe("Software Developer");
    expect(getRoleExample("no-such-role")).toBeNull();
  });

  it("includes the case most example libraries skip", () => {
    // A first resume with no employment history is the hardest one to write
    // and the one nobody publishes.
    const fresher = getRoleExample("graduate-no-experience");
    expect(fresher).not.toBeNull();
    const experience = fresher!.resume.sections.find((s) => s.type === "experience");
    expect(experience?.type === "experience" ? experience.entries : null).toEqual([]);
  });
});

describe("the guides", () => {
  it("ships a small number that answer their question", () => {
    expect(GUIDES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(GUIDE_SLUGS).size).toBe(GUIDES.length);
    for (const slug of GUIDE_SLUGS) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives every guide enough body to be worth landing on", () => {
    // The thin-page failure, as a floor. A guide under this length is one
    // that ranks and disappoints.
    for (const guide of GUIDES) {
      const words = guide.sections
        .flatMap((section) =>
          section.blocks.map((block) =>
            block.kind === "list" ? block.items.join(" ") : block.text,
          ),
        )
        .join(" ")
        .split(/\s+/).length;
      expect(words, guide.slug).toBeGreaterThan(300);
      expect(guide.sections.length, guide.slug).toBeGreaterThanOrEqual(2);
      expect(guide.minutes, guide.slug).toBeGreaterThan(0);
    }
  });

  it("resolves by slug, and nothing by a bad one", () => {
    expect(getGuide("what-an-ats-actually-does")?.minutes).toBeGreaterThan(0);
    expect(getGuide("nope")).toBeNull();
  });
});

describe("nothing on the content surface claims an outcome (D14)", () => {
  it("makes no forbidden claim in an example", () => {
    expect(forbiddenClaimIn(allExampleText())).toBeNull();
  });

  it("makes no forbidden claim in a guide", () => {
    expect(forbiddenClaimIn(allGuideText())).toBeNull();
  });

  it("still catches a forbidden claim that is actually asserted", () => {
    // The refusal filter must not be a hole. A sentence that makes the claim
    // outright has to be caught, or the two tests above prove nothing.
    expect(forbiddenClaimIn("This resume is guaranteed to pass any ATS.")).not.toBeNull();
    expect(forbiddenClaimIn("Our users get 38% more interviews.")).not.toBeNull();
    expect(forbiddenClaimIn("We will not promise it is guaranteed to pass.")).toBeNull();
  });

  it("says plainly that the guides refuse to predict", () => {
    // The differentiator is not the absence of the claim, it is saying why
    // it is absent. A page that merely omits it reads as an oversight.
    const ats = getGuide("what-an-ats-actually-does");
    const text = allGuideText();
    expect(ats).not.toBeNull();
    expect(text).toMatch(/guaranteed to pass|will not tell you|anyone quoting/i);
  });
});
