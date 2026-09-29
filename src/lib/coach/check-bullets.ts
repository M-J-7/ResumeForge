/**
 * The public bullet checker (ROADMAP Phase 3): pasted bullets, judged by the
 * same two things that judge them inside the builder.
 *
 * - The **Bullet Coach** (`analyzeBullet`) — which of Action / What / How /
 *   Outcome a bullet has, and the question to ask about the part it lacks.
 * - The **lint engine** (`lint`), run for real on a throwaway document that
 *   holds the pasted bullets as one role. Not a re-implementation of its
 *   bullet rules: a checker that approximated the builder's would one day
 *   disagree with it, and a reader who is told one thing here and another in
 *   the builder trusts neither.
 *
 * Where both say the same thing, the coach's version is kept: it is phrased
 * as a question, which is the point of it. A finding the coach has no
 * equivalent for — a bullet that has grown into a paragraph — comes through
 * from the lint engine as it is.
 *
 * Nothing here writes a bullet. The coach's own tests guarantee that none of
 * its output could be pasted into a resume (D8), and the lint messages name a
 * problem without supplying the fix.
 *
 * Pure and synchronous, so the page can run it on every keystroke without a
 * request anywhere: the text never leaves the browser.
 */

import { analyzeBullet, type BulletPart, type CoachNote } from "./parse-bullet";
import { lint } from "@/lib/lint/engine";
import { createEmptyResume, createExperienceEntry } from "@/lib/resume/factory";
import type { ResumeDocument } from "@/lib/resume/schema";

/** More than a whole resume's worth; past this the page is being used as a text box. */
export const MAX_BULLETS = 30;
/** Longer than any bullet should be; `bullets/too-long` fires well before it. */
export const MAX_BULLET_CHARS = 600;

export interface CheckFinding {
  ruleId: string;
  message: string;
  why: string;
}

export interface BulletCheck {
  text: string;
  present: Record<BulletPart, boolean>;
  notes: CoachNote[];
  /** Lint findings the coach does not already ask about. */
  findings: CheckFinding[];
}

/** List markers people paste along with their bullets: •, -, *, –, 1., (a). */
const MARKER = /^\s*(?:[•●▪◦*\-–—>]+|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+/i;

/** One bullet per line, markers and blank lines removed. */
export function splitBullets(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(MARKER, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_BULLETS)
    .map((line) => line.slice(0, MAX_BULLET_CHARS));
}

/**
 * Lint rules the coach already covers, and the coach part that covers them.
 * A lint finding is dropped only when the coach raised a note on that part
 * for the same bullet — so nothing is lost, only said once.
 */
const COVERED_BY: Readonly<Record<string, (notes: readonly CoachNote[]) => boolean>> = {
  "bullets/weak-verb": (notes) => notes.some((note) => note.part === "action"),
  "bullets/duty-phrasing": (notes) => notes.some((note) => note.part === "action"),
  "bullets/first-person": (notes) => notes.some((note) => /pronoun/i.test(note.gap)),
};

function documentFor(bullets: readonly string[]): { doc: ResumeDocument; entryId: string } {
  const doc = createEmptyResume();
  const entry = { ...createExperienceEntry(), bullets: [...bullets] };
  doc.sections = doc.sections.map((section) =>
    section.type === "experience" ? { ...section, entries: [entry] } : section,
  );
  return { doc, entryId: entry.id };
}

export function checkBullets(input: string): BulletCheck[] {
  const bullets = splitBullets(input);
  if (bullets.length === 0) return [];

  const { doc, entryId } = documentFor(bullets);
  const byBullet = new Map<number, CheckFinding[]>();
  for (const finding of lint(doc).findings) {
    const index = finding.location.bulletIndex;
    if (finding.location.entryId !== entryId || index === undefined) continue;
    if (!finding.ruleId.startsWith("bullets/")) continue;
    const list = byBullet.get(index) ?? [];
    list.push({ ruleId: finding.ruleId, message: finding.message, why: finding.why });
    byBullet.set(index, list);
  }

  return bullets.map((text, index) => {
    const analysis = analyzeBullet(text);
    const findings = (byBullet.get(index) ?? []).filter(
      (finding) => !COVERED_BY[finding.ruleId]?.(analysis.notes),
    );
    return { text, present: analysis.present, notes: analysis.notes, findings };
  });
}
