/**
 * One-click optional sections (P33-C4).
 *
 * Closes the competitor's "optional sections" row for about an hour of work,
 * because the machinery already exists: a custom section is a first-class
 * part of the schema, `addCustomSection` is already on the store, and the
 * emitters already render one. What was missing was the list — the user had
 * to know that "Publications" was a thing they could add, and then type the
 * word.
 *
 * ## Why these five
 *
 * They are the sections that recur across real resumes without being
 * standard enough to earn a schema type of their own. Anything genuinely
 * universal (experience, education, skills) is already a typed section;
 * anything rarer than these is better served by the existing "add a custom
 * section" field than by a preset nobody clicks.
 *
 * ## The hint is the useful part
 *
 * Each carries a line on what belongs in it, because the failure mode of an
 * optional section is not forgetting it exists — it is adding "Interests"
 * and filling it with three words that tell a reader nothing. The hints are
 * written to be usable as guidance, and none of them claims an outcome
 * (D14): "Awards" does not say it gets you hired.
 */

import { createCustomEntry, createId } from "./factory";
import type { CustomSection } from "./schema";

export interface SectionPreset {
  readonly id: string;
  /** Becomes the section's heading, and is what an ATS pattern-matches on. */
  readonly label: string;
  /** One line on what belongs under it. Shown beside the button. */
  readonly hint: string;
}

export const SECTION_PRESETS: readonly SectionPreset[] = [
  {
    id: "languages",
    label: "Languages",
    hint: "With a level for each — “Spanish (native)”, “German (B2)”. A bare list invites the wrong assumption in both directions.",
  },
  {
    id: "awards",
    label: "Awards",
    hint: "Name the award, who gave it, and out of how many. “Top 3 of 240 teams” says more than the award's name alone.",
  },
  {
    id: "publications",
    label: "Publications",
    hint: "Title, venue, year. Link it if it is online; a reader who wants to check should not have to search.",
  },
  {
    id: "volunteering",
    label: "Volunteering",
    hint: "Treat it like a role: what you did and what changed. Unpaid work counts as evidence of capability.",
  },
  {
    id: "interests",
    label: "Interests",
    hint: "Only where an interest is specific enough to be a real fact about you. “Reading” is not; “restoring a 1974 motorcycle” is.",
  },
];

export function getSectionPreset(id: string): SectionPreset | null {
  return SECTION_PRESETS.find((preset) => preset.id === id) ?? null;
}

/**
 * A ready-to-add custom section.
 *
 * One empty entry, not zero: a section that appears with nothing in it looks
 * broken, and the entry is what the user types into. Same reason
 * `createExperienceEntry` starts with one empty bullet.
 */
export function buildPresetSection(preset: SectionPreset): CustomSection {
  return {
    id: createId(),
    type: "custom",
    visible: true,
    label: preset.label,
    entries: [createCustomEntry()],
  };
}
