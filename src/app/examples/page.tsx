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
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { Card } from "@/components/ui/card";
import { ROLE_EXAMPLES } from "@/lib/examples/roles";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Resume examples",
  description:
    "Complete resume examples across technology, healthcare, finance, education and sales — each with the plain text a parser reads from it and the reasoning behind every line.",
  alternates: { canonical: "/examples" },
};

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

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
      <main className="flex flex-1 flex-col">
        <PageHeader containerClassName="max-w-5xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Resume examples</h1>
          </Built>
          <Built className="mt-5">
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              Complete resumes, not fragments. Each one comes with the plain text a parser recovers
              from it and a short explanation of the choices in it — which is the part that is
              actually worth reading, and the part a generated example cannot have.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-faint text-xs">
              Every example is invented. Names, employers and numbers are made up, because a real
              resume is somebody&rsquo;s personal data.
            </p>
          </Built>
        </PageHeader>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
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
              <h2 className="text-faint text-xs font-semibold tracking-wide uppercase sm:pt-1.5">
                {field}
              </h2>
              <SpotlightGroup>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {ROLE_EXAMPLES.filter((example) => example.field === field).map((example) => (
                    <li key={example.slug} className="relative">
                      <Card className="spot lift hover:border-line-strong h-full p-5">
                        <h3 className="text-text text-base font-semibold">
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
                        <p className="text-muted mt-2 text-sm leading-relaxed">{example.summary}</p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </SpotlightGroup>
            </section>
          ))}

          <section className="border-line flex flex-wrap items-center gap-5 border-t pt-8">
            <Link href="/builder" className="text-accent rule-grow rounded-sm text-sm font-medium">
              Start building
            </Link>
            <Link
              href="/templates"
              className="text-accent rule-grow rounded-sm text-sm font-medium"
            >
              Templates
            </Link>
            <Link href="/guides" className="text-accent rule-grow rounded-sm text-sm font-medium">
              Guides
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
