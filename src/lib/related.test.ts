/**
 * The sideways links between examples and guides.
 *
 * The failure worth a test is silent in the browser: a slug in the table goes
 * stale after a rename and the link simply disappears, or a new example is
 * added and nothing anywhere points at it except the index.
 */

import { describe, expect, it } from "vitest";
import { GUIDES } from "./guides/guides";
import { ROLE_EXAMPLES } from "./examples/roles";
import {
  EXAMPLES_FOR_GUIDE_TABLE,
  examplesForGuide,
  guidesForExample,
  otherGuides,
  relatedExamples,
} from "./related";

describe("related pages", () => {
  it("names only examples and guides that exist", () => {
    const guides = new Set(GUIDES.map((guide) => guide.slug));
    const examples = new Set(ROLE_EXAMPLES.map((example) => example.slug));
    for (const [guide, slugs] of Object.entries(EXAMPLES_FOR_GUIDE_TABLE)) {
      expect(guides.has(guide), `no guide "${guide}"`).toBe(true);
      for (const slug of slugs) expect(examples.has(slug), `no example "${slug}"`).toBe(true);
    }
  });

  it("gives every guide examples, and every example guides", () => {
    for (const guide of GUIDES)
      expect(examplesForGuide(guide).length, guide.slug).toBeGreaterThan(1);
    for (const example of ROLE_EXAMPLES) {
      expect(guidesForExample(example).length, example.slug).toBeGreaterThan(0);
    }
  });

  it("never links a page to itself, and never twice to the same page", () => {
    for (const example of ROLE_EXAMPLES) {
      const related = relatedExamples(example).map((item) => item.slug);
      expect(related).not.toContain(example.slug);
      expect(new Set(related).size).toBe(related.length);
    }
    for (const guide of GUIDES) {
      expect(otherGuides(guide).map((item) => item.slug)).not.toContain(guide.slug);
    }
  });

  it("links to every example from some other example", () => {
    // An example reachable only through the index is one a reader who landed
    // elsewhere never finds, and one a crawler reaches one level deeper.
    const linked = new Set(
      ROLE_EXAMPLES.flatMap((example) => relatedExamples(example)).map((item) => item.slug),
    );
    for (const example of ROLE_EXAMPLES) expect(linked.has(example.slug), example.slug).toBe(true);
  });

  it("prefers an example from the same field", () => {
    const developer = ROLE_EXAMPLES.find((example) => example.slug === "software-developer")!;
    expect(relatedExamples(developer)[0]?.field).toBe(developer.field);
  });

  it("leads with the guide written about an example", () => {
    const graduate = ROLE_EXAMPLES.find((example) => example.slug === "graduate-no-experience")!;
    expect(guidesForExample(graduate)[0]?.slug).toBe("resume-with-no-experience");
  });
});
