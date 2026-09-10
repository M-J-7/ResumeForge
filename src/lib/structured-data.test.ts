/**
 * Structured data (§10.4b).
 *
 * Two kinds of assertion here, and the second is the one that matters:
 *
 *   1. The markup is shaped the way `schema.org` expects, so it parses.
 *   2. **It says nothing that is not on the page.** Google's structured-data
 *      policy and D14 want the same thing for different reasons, and a
 *      fabricated rating is both a false claim and the fastest way to earn a
 *      manual action. A test is the only thing that stops one being added
 *      later "because the competitors have them".
 */

import { describe, expect, it } from "vitest";
import { GUIDES, type Guide } from "./guides/guides";
import { ROLE_EXAMPLES } from "./examples/roles";
import { PRODUCT_NAME } from "./product";
import {
  breadcrumbJsonLd,
  faqSections,
  guideArticleJsonLd,
  guideFaqJsonLd,
  itemListJsonLd,
  jsonLdScript,
  roleExampleJsonLd,
  softwareApplicationJsonLd,
} from "./structured-data";

describe("jsonLdScript", () => {
  it("round-trips through JSON", () => {
    expect(JSON.parse(jsonLdScript(softwareApplicationJsonLd()))).toEqual(
      softwareApplicationJsonLd(),
    );
  });

  it("escapes a sequence that would close the script block early", () => {
    // Nothing in this data is user-supplied today. That is exactly the kind
    // of thing that stops being true, and the failure mode is an injected
    // <script> in the head of an indexed page.
    const escaped = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(escaped).not.toContain("</script>");
    expect(JSON.parse(escaped)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("the landing page application markup", () => {
  const data = softwareApplicationJsonLd();

  it("declares itself free, which is the claim worth making", () => {
    expect(data).toMatchObject({
      "@type": "SoftwareApplication",
      name: PRODUCT_NAME,
      offers: { "@type": "Offer", price: "0" },
    });
  });

  it("claims no rating and no review count (D14)", () => {
    // There are no users yet. Every competitor's markup has these; that is
    // not a reason to have them, it is the reason the refusal is worth a test.
    const serialized = jsonLdScript(data);
    for (const forbidden of ["aggregateRating", "ratingValue", "reviewCount", "review"]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
  });

  it("does not hardcode the product name (P37)", () => {
    // Choosing a name has to stay the one-line change `product.ts` promises.
    expect(data.name).toBe(PRODUCT_NAME);
  });
});

describe("guides", () => {
  it("gives every guide an article with a headline and a description", () => {
    for (const guide of GUIDES) {
      const data = guideArticleJsonLd(guide);
      expect(data["@type"]).toBe("Article");
      expect(data.headline).toBe(guide.title);
      expect(String(data.description).length).toBeGreaterThan(20);
      expect(String(data.url)).toContain(`/guides/${guide.slug}`);
    }
  });

  it("names no author, because no person is credited on the page", () => {
    for (const guide of GUIDES) {
      expect(guideArticleJsonLd(guide).author).toBeUndefined();
    }
  });

  it("marks up FAQ answers only where the page actually asks a question", () => {
    for (const guide of GUIDES) {
      const data = guideFaqJsonLd(guide);
      if (data === null) {
        expect(faqSections(guide)).toEqual([]);
        continue;
      }
      const questions = data.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
      expect(questions.length).toBeGreaterThan(0);
      for (const question of questions) {
        // Every question and every answer has to appear on the page, or the
        // markup does not describe the page.
        const heading = guide.sections.find((section) => section.heading === question.name);
        expect(heading, question.name).toBeDefined();
        expect(
          heading?.blocks.some(
            (block) => block.kind === "prose" && block.text === question.acceptedAnswer.text,
          ),
        ).toBe(true);
      }
    }
  });

  it("recognises the two guides that pose questions", () => {
    // Named rather than counted: these are the two the plan identified as
    // "People also ask" shaped, and losing that is a silent regression.
    const withFaq = GUIDES.filter((guide: Guide) => guideFaqJsonLd(guide) !== null).map(
      (guide) => guide.slug,
    );
    expect(withFaq).toContain("what-an-ats-actually-does");
    expect(withFaq).toContain("resume-file-format");
  });
});

describe("breadcrumbs and lists", () => {
  it("numbers a breadcrumb from one", () => {
    const data = breadcrumbJsonLd([
      { name: "Guides", path: "/guides" },
      { name: "A guide", path: "/guides/a-guide" },
    ]);
    const items = data.itemListElement as { position: number; item: string }[];
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[1]?.item).toContain("/guides/a-guide");
  });

  it("lists every role example, with the count it claims", () => {
    const data = itemListJsonLd(
      "Resume examples by role",
      ROLE_EXAMPLES.map((example) => ({
        name: example.role,
        path: `/examples/${example.slug}`,
      })),
    );
    expect(data.numberOfItems).toBe(ROLE_EXAMPLES.length);
    expect((data.itemListElement as unknown[]).length).toBe(ROLE_EXAMPLES.length);
  });

  it("points every role example at a route that exists", () => {
    for (const example of ROLE_EXAMPLES) {
      expect(String(roleExampleJsonLd(example).url)).toContain(`/examples/${example.slug}`);
    }
  });
});
