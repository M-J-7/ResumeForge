/**
 * `/pricing` — what costs money, and what never will.
 *
 * The argument is in `lib/pricing.ts`; this is the page that sets it. Two
 * things about its shape are deliberate.
 *
 * **It leads with what is free and why it stays free.** Every other pricing
 * page in this category leads with the tier it wants you to buy, and the free
 * column exists to look inadequate beside it. Here the free column is the
 * product, D13 is the reason, and the reason is a link to a dated decision
 * rather than a promise on a marketing page.
 *
 * **Nothing is purchasable yet, and the page says so out loud.** There is no
 * billing code in this repository. A buy button over no checkout is a lie told
 * in a button, and it is exactly the sort of thing a site whose whole position
 * is "check this yourself" cannot do once.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { Built, BuildGroup, BuiltListItem } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Eyebrow } from "@/components/marketing/Eyebrow";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { RefusalList } from "@/components/marketing/RefusalList";
import { Section } from "@/components/marketing/Section";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { CheckIcon } from "@/components/ui/icons";
import { PASS, PRICING_REFUSALS, PRICING_TIERS } from "@/lib/pricing";
import { pageMetadata } from "@/lib/seo";
import { repoFileUrl } from "@/lib/site";
import { softwareApplicationJsonLd } from "@/lib/structured-data";
import { cn } from "@/lib/utils";

/**
 * "Is it actually free" is the query this page exists to answer, so the
 * answer is in the title rather than behind the word "Pricing".
 */
export const metadata: Metadata = pageMetadata({
  // Not "Pricing". The template appends " — Six Seconds Resume", which leaves
  // about forty characters, and spending them on the answer rather than on
  // the category is what makes the result worth clicking. A second em dash
  // would collide with the template's, so this one takes a colon.
  title: "Pricing: every download is free",
  description:
    "Every download is free, permanently, with or without an account. The optional Pass is one " +
    "payment for twelve months — no auto-renew, no card kept on file.",
  path: "/pricing",
});

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <MotionProvider>
      <JsonLdScript data={softwareApplicationJsonLd()} />

      <main id="main-content" tabIndex={-1} data-stage="dark" className="flex flex-1 flex-col">
        <PageHeader containerClassName="max-w-5xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>What costs money, and what never will</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Every download is free, permanently, with or without an account &mdash; PDF, Word,
              plain text and JSON Resume, no watermark, no step at the end where it stops being
              free. That is a decision with a date on it, not an introductory offer.
            </p>
          </Built>
          <Built className="mt-5">
            <p className="text-muted text-small max-w-measure leading-relaxed">
              What the optional Pass buys is us <em>keeping things for you</em> across a whole job
              search. Working signed out stays unlimited and stays on your own machine, because the
              free-tier counts are about what a server stores, not about what you are allowed to
              make.{" "}
              <a
                href={repoFileUrl("docs/DECISIONS.md")}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent rule-grow rounded-sm"
              >
                Read the decision
              </a>
              .
            </p>
          </Built>
        </PageHeader>

        <Section rhythm="tight" labelledBy="tiers-heading" containerClassName="max-w-6xl">
          <h2 id="tiers-heading" className="sr-only">
            Tiers
          </h2>
          <BuildGroup stagger={0.08}>
            <SpotlightGroup>
              <ul className="grid gap-4 lg:grid-cols-3">
                {PRICING_TIERS.map((tier) => (
                  <BuiltListItem
                    key={tier.name}
                    variant="row"
                    className={cn(
                      "spot lift elev-1 flex flex-col rounded-xl border p-6",
                      // The Pass carries the accent because it is the one tier
                      // with a decision in it. The free tiers are the product
                      // and do not need to be sold.
                      tier.price ? "card-tinted" : "border-line bg-surface-0",
                    )}
                  >
                    <h3 className="text-text text-title font-semibold">{tier.name}</h3>

                    <p className="mt-4 flex items-baseline gap-2">
                      {tier.price ? (
                        <>
                          <span className="text-text text-display-3 font-semibold">
                            ${tier.price}
                          </span>
                          <span className="text-faint text-small">{tier.priceNote}</span>
                        </>
                      ) : (
                        <span className="text-text text-display-3 font-semibold">
                          {tier.priceNote}
                        </span>
                      )}
                    </p>

                    <p className="text-muted text-small mt-3 leading-relaxed">{tier.who}</p>

                    <ul className="mt-5 flex flex-col gap-2.5">
                      {tier.features.map((feature) => (
                        <li key={feature} className="text-muted text-small flex gap-2.5">
                          <CheckIcon aria-hidden className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                          <span className="leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-6">
                      {tier.available ? (
                        <CtaLink href="/builder" size="md">
                          Start building
                        </CtaLink>
                      ) : (
                        /*
                         * Not a button. There is no checkout behind this, and a
                         * disabled control that looks like a buy button still
                         * tells the reader that buying is a thing they nearly
                         * did. A statement is the honest shape.
                         */
                        <p className="border-line bg-surface-2 text-faint text-small rounded-md border px-4 py-2.5">
                          <Eyebrow className="text-machine">not yet</Eyebrow>{" "}
                          <span className="ml-1">
                            There is no checkout here yet. Nothing is being taken.
                          </span>
                        </p>
                      )}
                    </div>
                  </BuiltListItem>
                ))}
              </ul>
            </SpotlightGroup>
          </BuildGroup>
        </Section>

        <Section lit="accent" ruled labelledBy="refusals-heading" containerClassName="max-w-5xl">
          <BuildGroup stagger={0.08}>
            <Built>
              <h2 id="refusals-heading" className="text-text text-display-3 font-semibold">
                Things this will never do to you
              </h2>
            </Built>
            <Built className="mt-6">
              <p className="text-muted text-body-l max-w-read">
                The patterns below are what this category actually does, and the largest operator in
                it is in court over the first one. None of them is here, and each is struck out
                because it is a thing we took off the page rather than a thing we forgot.
              </p>
            </Built>
            <Built className="mt-10">
              <RefusalList
                claims={PRICING_REFUSALS}
                className="border-line max-w-read gap-0 border-t"
                itemClassName="text-title border-line border-b py-5 leading-snug"
              />
            </Built>
          </BuildGroup>
        </Section>

        <Section ruled containerClassName="max-w-3xl text-center">
          <BuildGroup stagger={0.09}>
            <Built>
              <h2 className="font-display text-text text-display-2 text-balance">
                Nothing here is behind the ${PASS.price}
              </h2>
            </Built>
            <Built className="mt-5">
              <p className="text-muted text-body-l mx-auto max-w-[46ch]">
                Open the builder and download all four formats. Decide about the rest later, or
                never.
              </p>
            </Built>
            <Built className="mt-9">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                <CtaLink href="/builder">Start building</CtaLink>
                <Link
                  href="/check"
                  className="text-text focus-visible:ring-accent rule-grow text-small rounded-sm font-medium transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  Or check a resume you already have
                </Link>
              </div>
            </Built>
          </BuildGroup>
        </Section>

        <AppFooter />
      </main>
    </MotionProvider>
  );
}
