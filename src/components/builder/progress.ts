/**
 * Step completion, for the progress indicator.
 *
 * "Complete" here means *has usable content*, not "passes validation" —
 * the schema deliberately accepts an empty document, so validity would mark
 * every step complete from the start and the indicator would say nothing.
 *
 * Optional steps are reported separately rather than counted as incomplete.
 * Marking Certifications as an unfinished task for someone who holds none
 * invents work and pushes them toward padding, which is the opposite of what
 * this product is for (D14).
 */

import type { ResumeDocument, Section } from "@/lib/resume/schema";

export type StepStatus = "empty" | "started" | "complete";

export interface StepProgress {
  status: StepStatus;
  /** True when leaving this step empty is a perfectly good outcome. */
  optional: boolean;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function sectionOf(doc: ResumeDocument, type: Section["type"]): Section | undefined {
  return doc.sections.find((s) => s.type === type);
}

function entryCount(section: Section | undefined): number {
  if (!section) return 0;
  if ("entries" in section) return section.entries.length;
  if (section.type === "skills") return section.groups.length;
  if (section.type === "summary") return hasText(section.content) ? 1 : 0;
  return 0;
}

/**
 * Contact is the only step with a hard requirement: a name plus at least one
 * way to reach the candidate. A resume without either is not a resume.
 */
function contactStatus(doc: ResumeDocument): StepStatus {
  const { fullName, email, phone } = doc.contact;
  const named = hasText(fullName);
  const reachable = hasText(email) || hasText(phone);
  if (named && reachable) return "complete";
  if (named || reachable) return "started";
  return "empty";
}

/** An entry counts as complete once it has both a heading and some detail. */
function experienceStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "experience");
  if (!section || section.type !== "experience" || section.entries.length === 0) return "empty";
  const anyComplete = section.entries.some(
    (e) => hasText(e.title) && hasText(e.organization) && e.bullets.some(hasText),
  );
  return anyComplete ? "complete" : "started";
}

function educationStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "education");
  if (!section || section.type !== "education" || section.entries.length === 0) return "empty";
  const anyComplete = section.entries.some((e) => hasText(e.institution) && hasText(e.credential));
  return anyComplete ? "complete" : "started";
}

function projectsStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "projects");
  if (!section || section.type !== "projects" || section.entries.length === 0) return "empty";
  const anyComplete = section.entries.some((e) => hasText(e.name) && e.bullets.some(hasText));
  return anyComplete ? "complete" : "started";
}

function skillsStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "skills");
  if (!section || section.type !== "skills" || section.groups.length === 0) return "empty";
  const anyComplete = section.groups.some((g) => g.skills.some(hasText));
  return anyComplete ? "complete" : "started";
}

function certificationsStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "certifications");
  if (!section || section.type !== "certifications" || section.entries.length === 0) return "empty";
  return section.entries.some((e) => hasText(e.name)) ? "complete" : "started";
}

function summaryStatus(doc: ResumeDocument): StepStatus {
  const section = sectionOf(doc, "summary");
  if (!section || section.type !== "summary") return "empty";
  return hasText(section.content) ? "complete" : "empty";
}

function customStatus(doc: ResumeDocument): StepStatus {
  const customs = doc.sections.filter((s) => s.type === "custom");
  if (customs.length === 0) return "empty";
  const anyComplete = customs.some(
    (s) => s.type === "custom" && hasText(s.label) && entryCount(s) > 0,
  );
  return anyComplete ? "complete" : "started";
}

export function stepProgress(doc: ResumeDocument): Record<string, StepProgress> {
  return {
    contact: { status: contactStatus(doc), optional: false },
    summary: { status: summaryStatus(doc), optional: true },
    experience: { status: experienceStatus(doc), optional: true },
    education: { status: educationStatus(doc), optional: true },
    skills: { status: skillsStatus(doc), optional: false },
    projects: { status: projectsStatus(doc), optional: true },
    certifications: { status: certificationsStatus(doc), optional: true },
    custom: { status: customStatus(doc), optional: true },
  };
}

/**
 * A resume needs contact details, skills, and evidence of *something* —
 * a job, a project, or a qualification. Which one does not matter, which is
 * exactly the point: a fresher with three good projects and no jobs has a
 * complete resume, and the indicator should say so.
 */
export function isReadyToDownload(doc: ResumeDocument): boolean {
  const progress = stepProgress(doc);
  const hasEvidence = (["experience", "projects", "education"] as const).some(
    (id) => progress[id]?.status === "complete",
  );
  return progress.contact?.status === "complete" && hasEvidence;
}

/**
 * True when the document holds anything a person actually typed.
 *
 * Used by draft claiming (M2-T3) to decide whether a browser draft is worth
 * offering to save. A pristine document created by simply opening the
 * builder is not; prompting to save it teaches people to dismiss the prompt.
 *
 * Defined in terms of `stepProgress` so "empty" means the same thing here
 * as it does in the indicator the user has already been reading.
 */
export function hasAnyContent(doc: ResumeDocument): boolean {
  return Object.values(stepProgress(doc)).some((step) => step.status !== "empty");
}

export function completedCount(doc: ResumeDocument): { done: number; total: number } {
  const progress = stepProgress(doc);
  const entries = Object.values(progress);
  return {
    done: entries.filter((p) => p.status === "complete").length,
    total: entries.length,
  };
}
