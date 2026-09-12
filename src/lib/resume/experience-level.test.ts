/**
 * P35 acceptance for the pure parts.
 *
 * The two that matter: a lower band reorders the rail, and **"10+" restores
 * the default order** — the second is the one that would silently regress,
 * because a reorder that never reverses looks fine until somebody with a
 * long career opens the builder and finds Projects above Experience.
 */

import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_OPTIONS,
  isEvidenceFirst,
  stepOrderFor,
} from "./experience-level";
import { STEPS, orderedSteps } from "@/components/builder/steps-config";
import { emptyStateFor } from "@/components/builder/empty-states";

describe("the bands", () => {
  it("offers one option per level, each with a label and a line of detail", () => {
    expect(EXPERIENCE_LEVEL_OPTIONS.map((o) => o.id)).toEqual([...EXPERIENCE_LEVELS]);
    for (const option of EXPERIENCE_LEVEL_OPTIONS) {
      expect(option.label.length, option.id).toBeGreaterThan(3);
      expect(option.detail.length, option.id).toBeGreaterThan(10);
    }
  });

  it("treats only the two lowest bands as evidence-first", () => {
    expect(isEvidenceFirst("none")).toBe(true);
    expect(isEvidenceFirst("under-2")).toBe(true);
    expect(isEvidenceFirst("2-5")).toBe(false);
    expect(isEvidenceFirst("5-10")).toBe(false);
    expect(isEvidenceFirst("10-plus")).toBe(false);
    expect(isEvidenceFirst(null)).toBe(false);
  });
});

describe("the step order", () => {
  const ids = (steps: readonly { id: string }[]) => steps.map((s) => s.id);

  it("puts projects and education above experience for “no experience”", () => {
    const order = ids(orderedSteps(stepOrderFor("none")));
    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("experience"));
    expect(order.indexOf("education")).toBeLessThan(order.indexOf("experience"));
  });

  it("restores the default order for 10+", () => {
    expect(stepOrderFor("10-plus")).toBeNull();
    expect(orderedSteps(stepOrderFor("10-plus"))).toBe(STEPS);
    expect(ids(orderedSteps(null))).toEqual(ids(STEPS));
  });

  it("never drops or duplicates a step, whatever the band", () => {
    for (const level of EXPERIENCE_LEVELS) {
      const order = ids(orderedSteps(stepOrderFor(level)));
      expect(order.length, level).toBe(STEPS.length);
      expect(new Set(order).size, level).toBe(STEPS.length);
      expect([...order].sort(), level).toEqual(ids(STEPS).slice().sort());
    }
  });

  it("keeps contact first in every band", () => {
    // A resume with no way to contact you is the one `contact/reachable`
    // calls an error. It leads regardless of career stage.
    for (const level of EXPERIENCE_LEVELS) {
      expect(ids(orderedSteps(stepOrderFor(level)))[0], level).toBe("contact");
    }
  });

  it("keeps a step the order does not name, rather than losing it", () => {
    const order = ids(orderedSteps(["skills"]));
    expect(order[0]).toBe("skills");
    expect(order).toHaveLength(STEPS.length);
  });
});

describe("empty-state overrides", () => {
  it("returns the default for a band with no override", () => {
    expect(emptyStateFor("skills", "none")).toBe(emptyStateFor("skills", null));
    expect(emptyStateFor("experience", "2-5")).toBe(emptyStateFor("experience", null));
  });

  it("swaps the experience copy for the bands that need it", () => {
    expect(emptyStateFor("experience", "none").headline).not.toBe(
      emptyStateFor("experience", null).headline,
    );
    expect(emptyStateFor("experience", "10-plus").headline).toMatch(/leave out/i);
  });

  it("leaves the locked fresher strings reachable and unedited", () => {
    // `/hackathon entries/i`, `/campus placement portal/i` and
    // `/how you show capability without a job title/i` are asserted verbatim
    // by both suites. The overrides are additive precisely so these survive.
    const projects = emptyStateFor("projects", null);
    expect(projects.headline).toMatch(/how you show capability without a job title/i);
    expect(projects.example?.title).toMatch(/campus placement portal/i);
    expect(projects.counts?.join(" ")).toMatch(/hackathon entries/i);

    // And the band that needs them still gets them.
    const fresher = emptyStateFor("projects", "none");
    expect(fresher.headline).toMatch(/how you show capability without a job title/i);
  });

  it("gives every override a headline and a body", () => {
    for (const level of EXPERIENCE_LEVELS) {
      for (const section of ["experience", "projects", "education", "skills"]) {
        const state = emptyStateFor(section, level);
        expect(state.headline.length, `${level}/${section}`).toBeGreaterThan(5);
        expect(state.body, `${level}/${section}`).toBeTruthy();
      }
    }
  });
});
