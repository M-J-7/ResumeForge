/**
 * `/examples` — the index (P36).
 *
 * Eight examples, grouped by field. Deliberately not a paginated wall of
 * five hundred: the argument for this set is that each page answers its
 * query completely, and an index that implies breadth we do not have would
 * undercut the one thing they are good at.
 *
 * Server-rendered, no JavaScript required. It is a list of links, and the
 * only reason a list of links would need a runtime is if somebody put one
 * there.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { Card } from "@/components/ui/card";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";

/*
 * "Formats" beside "examples" because that is the Indian query, and the
 * download because since 2026-10-02 every example is one — see
 * `lib/examples/search.ts`. Under sixty without the site name, like the
 * example pages themselves; under 160 for the description.
 */
const TITLE = "Resume examples and formats by role — free Word & PDF";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  absoluteTitle: TITLE,
  description:
    `${ROLE_EXAMPLES.length} resume examples and formats for India and the US, freshers to ` +
    "trades. Each downloads free in Word or PDF, with the text a parser reads from it.",
  path: "/examples",
});

/** Fields in the order they first appear, so the grouping is data-driven. */
function fields(): string[] {
  return [...new Set(ROLE_EXAMPLES.map((example) => example.field))];
}

export default function ExamplesIndexPage() {
  return (
    <>
      {/*
        §10.4b. An `ItemList` is what lets a gallery of role pages surface as
        a set rather than as one result, and every entry is a URL that exists.
      */}
      <JsonLdScript
        data={itemListJsonLd(
          "Resume examples by role",
          ROLE_EXAMPLES.map((example) => ({
            name: `${example.role} resume example`,
            path: `/examples/${example.slug}`,
          })),
        )}
      />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {/*
          A dark stage *band*, over a Paper & Ink body — the deliberate
          exception in the redesign. `/examples` and `/guides` are the pages a
          stranger lands on from a search, and long-form reading on near-black
          is a real comprehension cost. They get the masthead and then a
          comfortable reading surface. `stage` on the band rather than on
          `<main>` is what keeps the page below it light: the scope's `:has()`
          half uses a child combinator precisely so a nested band cannot flip
          the whole document.
        */}
        <PageHeader stage containerClassName="max-w-5xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Resume examples</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Complete resumes, not fragments. Each one comes with the plain text a parser recovers
              from it and a short explanation of the choices in it — which is the part that is
              actually worth reading, and the part a generated example cannot have.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-faint text-small max-w-measure">
              Every example is invented. Names, employers and numbers are made up, because a real
              resume is somebody&rsquo;s personal data.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-5xl flex-col gap-10 px-6">
          {fields().map((field) => (
            <section
              key={field}
              /* The field label sits in a gutter rather than over the grid.
                 Several fields have a single example, and a full-width label
                 above one card left the row visibly half-empty — as a gutter
                 it reads as an index, which is what it is. It is also the one
                 tracked-out label left on the site: a grouping key, never an
                 eyebrow above a heading that already announces itself. */
              className="grid gap-4 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-8"
            >
              <h2 className="text-faint text-small font-semibold tracking-wide uppercase sm:pt-1.5">
                {field}
              </h2>
              <SpotlightGroup>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {ROLE_EXAMPLES.filter((example) => example.field === field).map((example) => (
                    <li key={example.slug} className="relative">
                      <Card className="spot lift hover:border-line-strong h-full p-5">
                        <h3 className="text-text text-body font-semibold">
                          <Link
                            href={`/examples/${example.slug}`}
                            /* The whole card lifts; the link inside only needs to
                           say which words are the link. `after:absolute` makes
                           the card's whole area the target without nesting an
                           anchor around a heading. */
                            className="hover:text-accent rounded-sm after:absolute after:inset-0"
                          >
                            {example.role}
                          </Link>
                        </h3>
                        <p className="text-muted text-small mt-2 leading-relaxed">
                          {example.summary}
                        </p>
                        {example.market === "IN" ? (
                          <p className="text-faint text-micro mt-3 font-mono">For India</p>
                        ) : example.market === "US" ? (
                          <p className="text-faint text-micro mt-3 font-mono">For the US</p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              </SpotlightGroup>
            </section>
          ))}

          <section className="border-line flex flex-wrap items-center gap-5 border-t pt-8">
            <Link
              href="/builder"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Start building
            </Link>
            <Link
              href="/templates"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Templates
            </Link>
            <Link
              href="/guides"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Guides
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
