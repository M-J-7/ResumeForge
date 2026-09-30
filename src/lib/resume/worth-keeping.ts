/**
 * Whether a draft holds enough of someone's own work that losing it would
 * hurt — the point at which the builder suggests keeping a copy (ROADMAP R2).
 *
 * A guest's resume lives in this browser and nowhere else (D6). That is the
 * privacy position, and it has exactly one way to go wrong for the person it
 * protects: clearing browsing data deletes it, and there is no copy anywhere
 * to restore. Saying so at the moment there is something to lose is the fix;
 * saying so on an empty form is noise that trains people to dismiss it.
 *
 * So: a name, and at least one real piece of a resume beneath it. Deliberately
 * low — an entry is typing someone would not want to do twice.
 */

import type { ResumeDocument } from "./schema";

/** Long enough to be a written summary rather than a few words to try the box. */
const SUMMARY_WORTH_KEEPING = 40;

export function worthKeeping(document: ResumeDocument): boolean {
  if (!document.contact.fullName.trim()) return false;
  return document.sections.some((section) => {
    switch (section.type) {
      case "summary":
        return section.content.trim().length >= SUMMARY_WORTH_KEEPING;
      case "skills":
        return section.groups.length > 0;
      default:
        return section.entries.length > 0;
    }
  });
}
