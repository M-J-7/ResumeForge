/**
 * What costs money, and what never will.
 *
 * ## The constraint this page is built around
 *
 * **D13: downloads are never paywalled.** PDF, DOCX, plain text and JSON
 * Resume are free forever, for everyone, with or without an account. That is
 * not a launch promotion and it is not a tier — it is a decision with a date
 * on it in `docs/DECISIONS.md`, and this page links to it rather than asking
 * to be believed.
 *
 * So the thing being sold is not the artifact. It is **us keeping things for
 * you across many applications**: more than one stored resume, version
 * history, unlimited saved letters, a library of job targets. Guest mode stays
 * unlimited and local, because the free-tier counts apply only to what a
 * server stores — which is the honest framing of what the money is for.
 *
 * ## Why a Pass and not a subscription
 *
 * A resume tool has a structurally short life: people use one for one to three
 * months and then stop. Selling a subscription into that is selling churn, and
 * the way this category monetises churn is the reason its largest operator is
 * being sued — $1.95 trials auto-renewing at $25.95 every four weeks, thirteen
 * times a year. One payment, twelve months, no auto-renew and no card kept is
 * both the kinder product and the one claim a competitor structurally cannot
 * copy.
 *
 * ## Nothing here is purchasable yet, and the page says so
 *
 * There is no billing code in this repository. A pricing page with a live-
 * looking buy button over no checkout is a lie told in a button, and the
 * `Offer` markup in `structured-data.ts` says `PreOrder` for the same reason.
 * When checkout exists, `available` flips and the markup follows it.
 *
 * `pricing.test.ts` screens this copy the way `faq.test.ts` screens the FAQ,
 * and pins the price against the structured data so the page and the machine-
 * readable version cannot drift.
 */

import { TEMPLATE_COUNT } from "@/lib/resume/templates";

/** The Pass, in the one place both the page and the JSON-LD read it from. */
export const PASS = {
  price: "19",
  currency: "USD",
  /** Shown next to the figure. Not "per year" — that implies a renewal. */
  period: "once, for 12 months",
} as const;

export interface PricingTier {
  name: string;
  /** The figure, as it is set on the page. `null` for the free tiers. */
  price: string | null;
  /** The line under the figure. */
  priceNote: string;
  /** Who this is, in one line. */
  who: string;
  features: readonly string[];
  /** Whether it can be had today. The Pass cannot, and the page says so. */
  available: boolean;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    name: "No account",
    price: null,
    priceNote: "Free, permanently",
    who: "Everything the product does, with nothing stored anywhere but your own browser.",
    features: [
      `The whole builder, and all ${TEMPLATE_COUNT} templates`,
      "PDF, Word, plain text and JSON Resume, with no watermark",
      "X-Ray: the extraction re-run on the file you are about to download",
      "The ATS check, and the match report against a posting",
      "Your work stays in this browser and is never sent to us",
    ],
    available: true,
  },
  {
    name: "With an account",
    price: null,
    priceNote: "Free, permanently",
    who: "The same product, plus somewhere to keep one of everything so it follows you between devices.",
    /*
     * What an account does *today*, not what it will do once the Pass is on
     * sale. This listed "One stored resume", "Three saved cover letters" and
     * "One saved job target" as present fact, and nothing enforces any of
     * them — `src/server/resumes.ts` counts rows and never refuses one. A
     * pricing page stating a limit the product does not have is the same
     * failure as a buy button over no checkout, pointed the other way.
     *
     * `pricing.test.ts` holds the last line to the Pass's availability: when
     * checkout exists and the counts are enforced, both change together.
     */
    features: [
      "Everything above",
      "Your resumes, cover letters and saved job targets, synced between your devices",
      "Export the whole account as JSON Resume, and delete it in one confirmation",
      "No limit on what an account stores while the Pass is not on sale",
    ],
    available: true,
  },
  {
    name: "Pass",
    price: PASS.price,
    priceNote: PASS.period,
    who: "For a real search: several versions of your resume, a letter for each application, and a record of what you sent where.",
    features: [
      "Unlimited stored resumes",
      "Version history with your own labels, and restore as a single undo step",
      "Unlimited saved cover letters",
      "A library of saved job descriptions to match against",
      "One payment. No auto-renew, and no card kept on file",
      "At month eleven, one email saying it is ending. Your data stays, and exports stay free",
    ],
    available: false,
  },
];

/**
 * The pricing patterns we will not use, named.
 *
 * The same argument the landing page's refusals make, applied to the part of
 * a product where a reader has most reason to be suspicious. Every one of
 * these is a thing a competitor in this category does today.
 */
export const PRICING_REFUSALS: readonly string[] = [
  "A trial that quietly becomes a subscription. There is no auto-renew here, so there is nothing to cancel and nothing to forget.",
  "A paywall at the download step, after you have done the work. Every format is free on every tier, permanently.",
  "A card kept on file for a payment you did not ask for.",
  "A cheaper price for the first period and a higher one afterwards.",
  "Making your own resume harder to get out than it was to put in.",
];
