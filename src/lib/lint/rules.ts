/**
 * The M0 rule subset (M0-T11).
 *
 * Every rule states why it matters in the user's terms, not ours. "Weak verb"
 * teaches nothing; "the verb is what a skim reads first" tells someone what
 * to do differently next time.
 *
 * These are advisory. Nothing here blocks an export — per D13 downloads are
 * never gated, and per D14 we do not claim a resume that passes these will
 * pass anything else.
 */

import { compareDates } from "@/lib/resume/dates";
import { isValidEmail } from "@/lib/resume/schema";
import { buildDocument } from "@/lib/layout/document";
import type { ResumeDocument, Section } from "@/lib/resume/schema";
import type { LintRule } from "./types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

interface BulletRef {
  sectionId: string;
  entryId: string;
  stepId: string;
  bulletIndex: number;
  text: string;
}

const SECTION_STEP: Record<Section["type"], string> = {
  summary: "summary",
  experience: "experience",
  education: "education",
  skills: "skills",
  projects: "projects",
  certifications: "certifications",
  custom: "custom",
};

/** Every non-empty bullet in the document, with enough context to navigate to it. */
function allBullets(doc: ResumeDocument): BulletRef[] {
  const refs: BulletRef[] = [];
  for (const section of doc.sections) {
    if (!("entries" in section)) continue;
    for (const entry of section.entries) {
      if (!("bullets" in entry)) continue;
      entry.bullets.forEach((text, bulletIndex) => {
        if (!hasText(text)) return;
        refs.push({
          sectionId: section.id,
          entryId: entry.id,
          stepId: SECTION_STEP[section.type],
          bulletIndex,
          text,
        });
      });
    }
  }
  return refs;
}

/**
 * Total words across everything that renders — the basis for the length rule.
 *
 * Exported because the dashboard denormalizes this into `Resume.wordCount`
 * (M2-T1). A second definition of "word count" would let the number on the
 * dashboard disagree with the number in the checklist, which reads as a bug
 * in whichever one the user looked at second.
 */
export function documentWordCount(doc: ResumeDocument): number {
  return buildDocument(doc).reduce((total, block) => {
    switch (block.type) {
      case "summary":
        return total + words(block.text).length;
      case "bullet":
        return total + words(block.text).length;
      case "experienceEntry":
      case "educationEntry":
      case "projectEntry":
      case "customEntry":
        return total + words(block.firstBullet ?? "").length;
      case "skillGroup":
        return total + block.skills.length;
      default:
        return total;
    }
  }, 0);
}

/* -------------------------------------------------------------------------- */
/* Word lists                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Openings that describe a job description rather than a person's record.
 * "Responsible for X" says the task existed; it does not say you did it well,
 * or at all.
 */
const DUTY_PHRASES = [
  "responsible for",
  "duties included",
  "duties involved",
  "helped with",
  "helped to",
  "assisted with",
  "worked on",
  "tasked with",
  "in charge of",
];

const FIRST_PERSON = /\b(I|I'm|I've|I'd|me|my|mine|myself|we|our|ours|us)\b/i;

/**
 * Openings that describe presence rather than contribution. A bullet that
 * starts here is usually one edit away from a much stronger one.
 */
const WEAK_VERBS = new Set([
  "worked",
  "helped",
  "assisted",
  "participated",
  "involved",
  "supported",
  "handled",
  "dealt",
  "was",
  "were",
  "did",
  "made",
  "used",
  "attended",
  "learned",
  "familiar",
  "exposure",
  "responsible",
  "tasked",
]);

/** Words that are verbs only in a form that does not lead a bullet well. */
const NON_VERB_OPENERS = /^(a|an|the|this|that|these|those|it|there|as|for|to|in|on|at|with|and)$/i;

/** Any digit, percentage, currency, or magnitude word counts as a quantity. */
const QUANTITY = /\d|\b(doubled|tripled|halved|quadrupled)\b/i;

/* -------------------------------------------------------------------------- */
/* Rules                                                                       */
/* -------------------------------------------------------------------------- */

const missingName: LintRule = {
  id: "contact/name",
  severity: "error",
  title: "Your name is missing",
  why: "It is the first thing a recruiter looks for, and the filename of your download is built from it.",
  run: (doc) =>
    hasText(doc.contact.fullName)
      ? []
      : [{ message: "Add your full name.", location: { stepId: "contact" } }],
};

const missingContactMethod: LintRule = {
  id: "contact/reachable",
  severity: "error",
  title: "No way to contact you",
  why: "A resume a recruiter cannot reply to is a resume they move past. One of email or phone is the minimum.",
  run: (doc) => {
    const { email, phone } = doc.contact;
    if (hasText(email) || hasText(phone)) return [];
    return [
      { message: "Add an email address or a phone number.", location: { stepId: "contact" } },
    ];
  },
};

const malformedEmail: LintRule = {
  id: "contact/email-format",
  severity: "error",
  title: "Email address looks wrong",
  why: "A typo here means the one reply you wanted never arrives, and nothing else on the page can fix that.",
  run: (doc) => {
    const { email } = doc.contact;
    if (!hasText(email) || isValidEmail(email)) return [];
    return [
      {
        message: `"${email}" does not look like a valid address.`,
        location: { stepId: "contact" },
      },
    ];
  },
};

const missingLocation: LintRule = {
  id: "contact/location",
  severity: "info",
  title: "No location given",
  why: "Recruiters filter by region constantly. City and country is enough — a street address is a privacy risk, not a credential.",
  run: (doc) =>
    hasText(doc.contact.location)
      ? []
      : [{ message: "Add a city and country.", location: { stepId: "contact" } }],
};

const endBeforeStart: LintRule = {
  id: "dates/end-before-start",
  severity: "error",
  title: "A date range runs backwards",
  why: "An impossible date reads as carelessness on the one document meant to demonstrate the opposite.",
  run: (doc) => {
    const findings = [];
    for (const section of doc.sections) {
      if (!("entries" in section)) continue;
      for (const entry of section.entries) {
        const dates = "dates" in entry ? entry.dates : null;
        if (!dates || dates.current || dates.end === null) continue;
        if (compareDates(dates.start, dates.end) > 0) {
          findings.push({
            message: "The end date falls before the start date.",
            location: {
              stepId: SECTION_STEP[section.type],
              sectionId: section.id,
              entryId: entry.id,
            },
          });
        }
      }
    }
    return findings;
  },
};

const inconsistentDatePrecision: LintRule = {
  id: "dates/inconsistent-precision",
  severity: "warning",
  title: "Date precision is inconsistent",
  why: "Mixing “Jan 2023” with a bare “2023” looks like two different resumes pasted together. Pick one and hold it.",
  run: (doc) => {
    const precisions: boolean[] = [];
    for (const section of doc.sections) {
      if (!("entries" in section)) continue;
      for (const entry of section.entries) {
        const dates = "dates" in entry ? entry.dates : null;
        if (!dates) continue;
        precisions.push(dates.start.month !== null);
      }
    }
    const hasMonth = precisions.some(Boolean);
    const hasYearOnly = precisions.some((p) => !p);
    if (!hasMonth || !hasYearOnly) return [];
    return [
      {
        message: "Some dates give a month and others only a year.",
        location: { stepId: "experience" },
      },
    ];
  },
};

const paragraphBullet: LintRule = {
  id: "bullets/too-long",
  severity: "warning",
  title: "A bullet has become a paragraph",
  why: "Bullets are scanned, not read. Past about forty words the reader skips the whole line rather than finishing it.",
  run: (doc) =>
    allBullets(doc)
      .filter((bullet) => words(bullet.text).length > 40)
      .map((bullet) => ({
        message: `This bullet is ${words(bullet.text).length} words. Split it or cut it back.`,
        location: {
          stepId: bullet.stepId,
          sectionId: bullet.sectionId,
          entryId: bullet.entryId,
          bulletIndex: bullet.bulletIndex,
        },
      })),
};

const dutyPhrasing: LintRule = {
  id: "bullets/duty-phrasing",
  severity: "warning",
  title: "Describes the job, not your work",
  why: "“Responsible for” states that the task existed. It does not say you did it, or that anything improved because you did.",
  run: (doc) => {
    const findings = [];
    for (const bullet of allBullets(doc)) {
      const lower = bullet.text.toLowerCase();
      const phrase = DUTY_PHRASES.find((p) => lower.includes(p));
      if (!phrase) continue;
      findings.push({
        message: `Rewrite to lead with what you did, not "${phrase}".`,
        location: {
          stepId: bullet.stepId,
          sectionId: bullet.sectionId,
          entryId: bullet.entryId,
          bulletIndex: bullet.bulletIndex,
        },
      });
    }
    return findings;
  },
};

const firstPerson: LintRule = {
  id: "bullets/first-person",
  severity: "warning",
  title: "Uses first-person pronouns",
  why: "Resumes are written in an implied first person. “I led the migration” reads as less assured than “Led the migration”.",
  run: (doc) =>
    allBullets(doc)
      .filter((bullet) => FIRST_PERSON.test(bullet.text))
      .map((bullet) => ({
        message: "Drop the pronoun and start with the verb.",
        location: {
          stepId: bullet.stepId,
          sectionId: bullet.sectionId,
          entryId: bullet.entryId,
          bulletIndex: bullet.bulletIndex,
        },
      })),
};

const weakOpeningVerb: LintRule = {
  id: "bullets/weak-verb",
  severity: "warning",
  title: "Opens with a weak verb",
  why: "The first word is the one a six-second skim actually reads. “Worked on” describes presence; “Rebuilt” describes a contribution.",
  run: (doc) => {
    const findings = [];
    for (const bullet of allBullets(doc)) {
      const first = words(bullet.text)[0]
        ?.toLowerCase()
        .replace(/[^a-z']/g, "");
      if (!first) continue;
      const isWeak = WEAK_VERBS.has(first) || NON_VERB_OPENERS.test(first);
      if (!isWeak) continue;
      findings.push({
        message: `"${first}" is a weak opening. Lead with a verb that names what changed.`,
        location: {
          stepId: bullet.stepId,
          sectionId: bullet.sectionId,
          entryId: bullet.entryId,
          bulletIndex: bullet.bulletIndex,
        },
      });
    }
    return findings;
  },
};

const noQuantifiedOutcome: LintRule = {
  id: "experience/no-quantified-outcome",
  severity: "info",
  title: "A role has no measurable result",
  why: "A number is what separates a claim from a description. Percentages, time saved, counts, and scale all work.",
  run: (doc) => {
    const findings = [];
    for (const section of doc.sections) {
      if (section.type !== "experience") continue;
      for (const entry of section.entries) {
        const filled = entry.bullets.filter(hasText);
        if (filled.length === 0) continue;
        if (filled.some((bullet) => QUANTITY.test(bullet))) continue;
        findings.push({
          message: `No bullet under "${entry.title || "this role"}" gives a measurable outcome.`,
          location: { stepId: "experience", sectionId: section.id, entryId: entry.id },
        });
      }
    }
    return findings;
  },
};

const wordCount: LintRule = {
  id: "document/word-count",
  severity: "info",
  title: "Length is outside the usual range",
  why: "Under 300 words tends to read as thin; over 800 stops being skimmable. Neither is a rule, but both are worth a second look.",
  run: (doc) => {
    const count = documentWordCount(doc);
    if (count === 0) return [];
    if (count >= 300 && count <= 800) return [];
    return [
      {
        message:
          count < 300
            ? `About ${count} words — there is likely more worth saying.`
            : `About ${count} words — consider what a reader could lose without missing it.`,
        location: { stepId: "experience" },
      },
    ];
  },
};

const emptyVisibleSection: LintRule = {
  id: "document/empty-section",
  severity: "info",
  title: "A visible section has no content",
  why: "It will not appear in your downloads — which is fine, but hide it deliberately rather than leaving it looking unfinished.",
  run: (doc) => {
    const findings = [];
    for (const section of doc.sections) {
      if (!section.visible) continue;
      const empty =
        section.type === "summary"
          ? !hasText(section.content)
          : section.type === "skills"
            ? section.groups.every((g) => g.skills.every((s) => !hasText(s)))
            : section.entries.length === 0;
      if (!empty) continue;
      findings.push({
        message: "This section is empty and will not be included.",
        location: { stepId: SECTION_STEP[section.type], sectionId: section.id },
      });
    }
    return findings;
  },
};

const noEvidence: LintRule = {
  id: "document/no-evidence",
  severity: "error",
  title: "Nothing to show yet",
  why: "A resume needs at least one of work, projects, or study. For a fresher, three solid projects do the job a first role would.",
  run: (doc) => {
    const hasAny = doc.sections.some((section) => {
      if (!section.visible || !("entries" in section)) return false;
      if (!["experience", "projects", "education"].includes(section.type)) return false;
      return section.entries.length > 0;
    });
    return hasAny
      ? []
      : [
          {
            message: "Add a role, a project, or a qualification.",
            location: { stepId: "experience" },
          },
        ];
  },
};

export const RULES: readonly LintRule[] = [
  missingName,
  missingContactMethod,
  malformedEmail,
  missingLocation,
  noEvidence,
  endBeforeStart,
  inconsistentDatePrecision,
  paragraphBullet,
  dutyPhrasing,
  firstPerson,
  weakOpeningVerb,
  noQuantifiedOutcome,
  wordCount,
  emptyVisibleSection,
];
