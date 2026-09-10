/**
 * JSON-LD for the indexable pages (§10.4b).
 *
 * ## Why this exists
 *
 * `grep` for `application/ld+json` across `src/` returned nothing, which made
 * it the largest on-page gap in the whole SEO picture. Structured data is
 * what lets a search engine render a result as something other than a blue
 * link: a free-tool badge on the landing page, a breadcrumb trail on a guide,
 * an expandable answer in the "People also ask" slot.
 *
 * ## Every field here is checkable
 *
 * That is not a stylistic preference, it is the same rule the rest of the
 * product follows and it is also what Google's structured-data policy
 * requires: markup must describe what is actually on the page. So there is no
 * `aggregateRating` — this product has no users yet, and D14 forbids
 * manufacturing that kind of proof as firmly for a machine-readable audience
 * as for a human one. A fabricated rating is also the single fastest way to
 * earn a manual action, so the honest choice is the safe one twice over.
 *
 * `offers` with `price: "0"` is the one claim worth making loudly: it is
 * true, permanently (D13), and it is the difference between this product and
 * every competitor whose paywall is at the download step.
 *
 * ## Emitted as a string, not a component
 *
 * Each builder returns a plain object; the caller stringifies it into a
 * `<script type="application/ld+json">`. Keeping them as data is what lets
 * `structured-data.test.ts` assert on the shape without rendering anything.
 */

import { PRODUCT_NAME } from "./product";
import { SITE_DESCRIPTION, siteUrl } from "./site";
import type { Guide } from "./guides/guides";
import type { RoleExample } from "./examples/roles";

/** Anything that can go inside a `<script type="application/ld+json">`. */
export type JsonLd = Record<string, unknown>;

/**
 * Serialized for `dangerouslySetInnerHTML`.
 *
 * `<` is escaped because a `</script>` sequence inside a JSON string would
 * close the block early and turn the rest of the payload into markup. None of
 * this data is user-supplied today, and that is exactly the kind of thing
 * that stops being true later.
 */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * The landing page: a free web application.
 *
 * `SoftwareApplication` rather than `WebSite` because that is what it is, and
 * because it is the type that carries `offers` — the free-tool signal.
 */
export function softwareApplicationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_NAME,
    url: siteUrl("/"),
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    // It runs in the browser; there is nothing to install and no platform to
    // name beyond that.
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Requires a modern browser.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      // D13, in the form a crawler reads.
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "ATS-safe resume builder",
      "PDF, Word, plain text and JSON Resume export",
      "Extraction check on the generated PDF",
      "Cover letters assembled from your own resume",
    ],
  };
}

/** A trail, so a result shows `Guides › This guide` rather than a bare URL. */
export function breadcrumbJsonLd(trail: readonly { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: siteUrl(crumb.path),
    })),
  };
}

/**
 * One guide as an `Article`.
 *
 * No `author` with a person's name on it: nobody is credited on these pages,
 * and inventing a byline to satisfy a schema would be exactly the kind of
 * decorative untruth the rest of this file refuses. The organization is the
 * publisher, which is what is actually true.
 */
export function guideArticleJsonLd(guide: Guide): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    url: siteUrl(`/guides/${guide.slug}`),
    mainEntityOfPage: siteUrl(`/guides/${guide.slug}`),
    publisher: { "@type": "Organization", name: PRODUCT_NAME, url: siteUrl("/") },
    // Roughly, and the page says the same number to the reader.
    timeRequired: `PT${guide.minutes}M`,
  };
}

/**
 * A guide whose sections read as questions, as an `FAQPage`.
 *
 * Only for guides that genuinely pose questions — `FAQPage` markup on a page
 * that answers none of them is both a lie and a manual-action risk. The
 * caller decides; `faqSections` is what it uses to decide.
 */
export function guideFaqJsonLd(guide: Guide): JsonLd | null {
  const questions = faqSections(guide);
  if (questions.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((section) => ({
      "@type": "Question",
      name: section.heading,
      acceptedAnswer: { "@type": "Answer", text: section.answer },
    })),
  };
}

/**
 * The sections of a guide that are questions, with their prose answers.
 *
 * A heading is a question when it ends in a question mark, or opens with an
 * interrogative. Deliberately conservative: a section wrongly treated as a
 * question produces markup that does not match the page, and a question
 * missed costs nothing but a rich result.
 */
export function faqSections(guide: Guide): { heading: string; answer: string }[] {
  const found: { heading: string; answer: string }[] = [];

  for (const section of guide.sections) {
    const heading = section.heading.trim();
    const isQuestion =
      heading.endsWith("?") ||
      /^(what|why|how|when|where|which|who|do|does|can|should|is|are)\b/i.test(heading);
    if (!isQuestion) continue;

    // The first prose block is the answer. Lists and callouts are supporting
    // material, and an answer assembled out of fragments reads as one.
    const prose = section.blocks.find((block) => block.kind === "prose");
    if (!prose || prose.kind !== "prose") continue;
    found.push({ heading, answer: prose.text });
  }

  return found;
}

/** `/examples` and `/templates`: a list, with each item's own URL. */
export function itemListJsonLd(
  name: string,
  items: readonly { name: string; path: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: siteUrl(item.path),
    })),
  };
}

/** One role example page, as an `Article` about that role's resume. */
export function roleExampleJsonLd(example: RoleExample): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${example.role} resume example`,
    description: example.summary,
    url: siteUrl(`/examples/${example.slug}`),
    mainEntityOfPage: siteUrl(`/examples/${example.slug}`),
    publisher: { "@type": "Organization", name: PRODUCT_NAME, url: siteUrl("/") },
    about: example.occupationTitle,
  };
}
