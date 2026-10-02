/**
 * Every example's search title and description fit a results page, carry the
 * query the page is for, and do not compete with each other.
 */

import { describe, expect, it } from "vitest";
import { ROLE_EXAMPLES } from "./roles";
import {
  exampleSearchDescription,
  exampleSearchTitle,
  SEARCH_DESCRIPTION_LIMIT,
  SEARCH_TITLE_LIMIT,
} from "./search";

describe("exampleSearchTitle", () => {
  it("fits in sixty characters for every example", () => {
    for (const example of ROLE_EXAMPLES) {
      expect(exampleSearchTitle(example).length, example.slug).toBeLessThanOrEqual(
        SEARCH_TITLE_LIMIT,
      );
    }
  });

  it("is unique, so no two examples compete for one query", () => {
    const titles = ROLE_EXAMPLES.map((example) => exampleSearchTitle(example).toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("says 'format' for India, where that is the search, and 'example' elsewhere", () => {
    for (const example of ROLE_EXAMPLES) {
      const title = exampleSearchTitle(example);
      expect(title, example.slug).toContain(
        example.market === "IN" ? "resume format" : "resume example",
      );
    }
  });

  it("leads with the role, written the way it is typed", () => {
    expect(exampleSearchTitle({ role: "Software Engineer (Fresher)", market: "IN" })).toBe(
      "Software Engineer fresher resume format — free Word & PDF",
    );
    expect(exampleSearchTitle({ role: "Cashier", market: "US" })).toBe(
      "Cashier resume example — free Word & PDF",
    );
  });

  it("falls back to a shorter shape rather than running long", () => {
    expect(exampleSearchTitle({ role: "Customer Service Representative", market: undefined })).toBe(
      "Customer Service Representative resume example and template",
    );
    expect(
      exampleSearchTitle({ role: "Licensed Practical Nurse (Long-Term Care)", market: undefined }),
    ).toBe("Licensed Practical Nurse long-term care resume example");
  });
});

describe("exampleSearchDescription", () => {
  it("fits in 160 characters and says more than the title", () => {
    for (const example of ROLE_EXAMPLES) {
      const description = exampleSearchDescription(example);
      expect(description.length, example.slug).toBeLessThanOrEqual(SEARCH_DESCRIPTION_LIMIT);
      expect(description.length, example.slug).toBeGreaterThan(70);
    }
  });

  it("is the page's own summary whenever that fits", () => {
    const short = { role: "Teacher", market: undefined, summary: "A short summary." };
    expect(exampleSearchDescription(short)).toBe(
      "A short summary. Free to download in Word and PDF.",
    );
  });

  it("uses the part before the dash when the whole summary is too long", () => {
    const dashed = {
      role: "Cashier",
      market: "US" as const,
      summary: `A cashier's resume with the numbers a store manager checks — ${"x".repeat(120)}.`,
    };
    expect(exampleSearchDescription(dashed)).toBe(
      "A cashier's resume with the numbers a store manager checks. " +
        "Free to download in Word and PDF, with the plain text an ATS reads.",
    );
  });

  it("names the role when the summary is too long to carry", () => {
    const long = { role: "Staff Nurse", market: "IN" as const, summary: "x".repeat(150) };
    expect(exampleSearchDescription(long)).toMatch(/^Staff Nurse resume format, free/);
  });

  it("is unique for every example", () => {
    const descriptions = ROLE_EXAMPLES.map((example) => exampleSearchDescription(example));
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
