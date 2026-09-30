/**
 * `/examples/[role]` — one worked resume, with its plain text (P36).
 *
 * The direct answer to a competitor's 500-example moat. We will not win on
 * count without generating them, which D8 forbids and which produces the
 * thin pages that rank once and disappoint forever. So each of these is
 * better on its own query instead: a real resume, an explanation of the
 * specific choices in it, **the plain text a parser recovers from it**, and
 * the phrase scaffolds for that occupation.
 *
 * ## The plain text is the page's body, and that is the point
 *
 * A crawler can read text and cannot read a picture. Competitors publish
 * their examples as images, so the page ranks on its title and nothing else.
 * Ours publishes the output of the real TXT emitter — `renderText` on the
 * same document the sample above it is drawn from — which means the indexed
 * body is the machine-readable resume itself. It is also the honest
 * demonstration: this is literally what a parser gets.
 *
 * ## Markup, not a render
 *
 * `ResumePaper` states the trade in full. Briefly: rendering the real PDF
 * would pull react-pdf, Yoga and the pdfjs worker onto a marketing page, and
 * §2.2's performance argument applies here at more pages than anywhere else.
 *
 * Everything on this page is server-rendered and needs no JavaScript, which
 * is the acceptance criterion for the whole package.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { ResumePaper } from "@/components/marketing/ResumePaper";
import { EXAMPLE_SLUGS, getRoleExample } from "@/lib/examples/roles";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, roleExampleJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
import { phrasesForTitle } from "@/lib/phrases/lookup";
import { renderText } from "@/lib/emit/text/render";
import { guidesForExample, relatedExamples } from "@/lib/related";
import { formatContentDate } from "@/lib/content-dates";
import { Breadcrumbs } from "@/components/marketing/Breadcrumbs";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

/** One line on whose conventions an example follows. */
const MARKET_LINE = {
  IN: "Written for applications in India. The notes say what to change when applying abroad.",
  US: "Written for applications in the United States. The notes say what to change elsewhere.",
} as const;

export function generateStaticParams() {
  return EXAMPLE_SLUGS.map((role) => ({ role }));
}

export async function generateMetadata({
  params,
}: PageProps<"/examples/[role]">): Promise<Metadata> {
  const { role } = await params;
  const example = getRoleExample(role);
  if (!example) return { title: "Example not found" };

  /*
   * The summary carries the role-specific half, and the fixed clause carries
   * the differentiator. Built this way round because it is the only shape
   * that fits: the summaries run to 105 characters and the sentence this used
   * to append ran to 80, so the longest of these descriptions reached 185 and
   * was cut off in the result at "the plain text a parser reads f…" — losing
   * exactly the phrase that distinguishes this page from five hundred
   * generated ones.
   */
  return pageMetadata({
    title: `${example.role} resume example`,
    description: `${example.summary} With the plain text a parser recovers from it.`,
    path: `/examples/${example.slug}`,
  });
}

export default async function ExamplePage({ params }: PageProps<"/examples/[role]">) {
  const { role } = await params;
  const example = getRoleExample(role);
  if (!example) notFound();

  // The occupation index is loaded on the server here rather than in the
  // browser: the scaffolds are page content, so they have to be in the HTML.
  const phrases = await phrasesForTitle(example.occupationTitle);
  const plainText = renderText(example.resume);
  // One list for the visible trail and the JSON-LD, so a search result and the
  // page cannot describe the page's place differently.
  const trail = [
    { name: "Examples", path: "/examples" },
    { name: `${example.role} resume example`, path: `/examples/${example.slug}` },
  ];

  return (
    <>
      {/*
        §10.4b. Each of these is a long-tail landing page for "<role> resume
        example", which is the search this product should own; the breadcrumb
        is what makes the result read as part of a gallery.
      */}
      <JsonLdScript data={roleExampleJsonLd(example)} />
      <JsonLdScript data={breadcrumbJsonLd(trail)} />
      {/*
        Brought onto the system with `/guides/[slug]` — both hand-rolled a
        heading row, a `bg-accent` anchor and an underlined link where the rest
        of the site uses `PageHeader`, `CtaLink` and `.rule-grow`.

        A dark stage band over a Paper & Ink body, which is also the right
        composition for this page in particular: the masthead is the workbench
        and the rendered resume below it is the document.
      */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-5xl">
          <Built>
            {/* Which index this page belongs to, which the heading below does
                not say — and now a way back to it, where the grouping key it
                replaced was only a label. The field is in "Keep reading". */}
            <Breadcrumbs trail={trail} />
          </Built>
          <Built className="mt-3">
            <h1 className={PAGE_TITLE_CLASS}>{example.role} resume example</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>{example.summary}</p>
          </Built>
          <Built className="mt-4">
            <p className="text-faint text-small max-w-measure leading-relaxed">
              Invented for this page. The name, the employers and every number in it are made up
              &mdash; a real resume is somebody&rsquo;s personal data and is not ours to publish.
            </p>
          </Built>
          {example.market ? (
            <Built className="mt-3">
              {/* Said plainly, because a reader applying elsewhere needs to know
                  which of the choices below to translate — see the notes. */}
              <p className="text-muted text-small max-w-measure leading-relaxed">
                {MARKET_LINE[example.market]}
              </p>
            </Built>
          ) : null}
          <Built className="mt-3">
            {/* Mono, like a guide's reading time: a fact about the page. */}
            <p className="text-faint text-micro font-mono">
              Updated <time dateTime={example.updated}>{formatContentDate(example.updated)}</time>
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-5xl flex-col gap-10 px-6">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <ResumePaper resume={example.resume} />

            <div className="flex flex-col gap-8">
              <section className="flex flex-col gap-3">
                <h2 className="text-text text-title font-semibold">Why it is written this way</h2>
                <ul className="flex flex-col gap-4">
                  {example.notes.map((note) => (
                    <li key={note.title}>
                      <p className="text-text text-body font-semibold">{note.title}</p>
                      <p className="text-muted text-small mt-1 leading-relaxed">{note.body}</p>
                    </li>
                  ))}
                </ul>
              </section>

              {phrases.topics.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h2 className="text-text text-title font-semibold">Shapes to fill in</h2>
                  <p className="text-muted text-small leading-relaxed">
                    Each blank is yours to complete. These are the same scaffolds the builder offers
                    for this occupation — none of them says anything until you fill it in, which is
                    what keeps them useful rather than a lie somebody else wrote.
                  </p>
                  {phrases.topics.slice(0, 3).map((topic) => (
                    <div key={topic.id}>
                      <h3 className="text-text text-small mt-2 font-semibold">{topic.label}</h3>
                      <ul className="mt-1 flex flex-col gap-1">
                        {topic.scaffolds.slice(0, 4).map((scaffold) => (
                          <li key={scaffold} className="text-muted text-small font-mono">
                            {scaffold}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ) : null}

              {phrases.relatedTitles.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h2 className="text-text text-title font-semibold">Also called</h2>
                  <p className="text-muted text-small">
                    {phrases.relatedTitles.slice(0, 10).join(" · ")}
                  </p>
                  <p className="text-faint text-small">
                    From the O*NET occupation database. Worth checking which of these a posting
                    uses, because that is the wording its keyword search will be built on.
                  </p>
                </section>
              ) : null}
            </div>
          </div>

          {/*
          The whole point of the page, and the part a competitor's image
          cannot do: the text a machine gets out of this resume, published as
          text. It is the real TXT emitter's output on the same document
          rendered above, so the two cannot disagree.
        */}
          <section className="flex flex-col gap-3">
            <h2 className="text-text text-title font-semibold">
              What a parser reads from this resume
            </h2>
            <p className="text-muted text-body max-w-read leading-relaxed">
              This is the actual plain-text output for the document above — the same text an
              applicant tracking system extracts, and the same text this app hands you when you
              download the .txt. Nothing is lost between the page and the parser, which is the whole
              argument for a single column of real text.
            </p>
            {/* `text-small`, not `text-micro`: this is the text the page
                exists to publish, and at 11px it was most of the words on
                the page set below what a phone can comfortably read —
                Lighthouse's legibility audit flagged 60% of the page for it. */}
            <pre className="machine-panel text-muted text-small overflow-x-auto rounded-lg border p-4 font-mono whitespace-pre-wrap">
              {plainText}
            </pre>
          </section>

          <RelatedLinks
            groups={[
              {
                title: "More examples",
                items: relatedExamples(example).map((related) => ({
                  href: `/examples/${related.slug}`,
                  label: `${related.role} resume example`,
                  detail: related.summary,
                })),
              },
              {
                title: "Guides that apply",
                items: guidesForExample(example).map((guide) => ({
                  href: `/guides/${guide.slug}`,
                  label: guide.title,
                  detail: guide.summary,
                })),
              },
            ]}
          />

          <section className="border-line flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-8">
            {/* `MotionProvider` because `CtaLink` is an `m.*` component and
              `LazyMotion strict` throws outside one. The band above carries its
              own; `domAnimation` is a module-level import either way, so the
              second provider costs a context and nothing else. */}
            <MotionProvider>
              <CtaLink href="/builder" size="md">
                Write yours
              </CtaLink>
            </MotionProvider>
            <Link
              href="/examples"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              All examples
            </Link>
            <Link
              href="/templates"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Templates
            </Link>
            <Link href="/check" className="text-accent rule-grow text-small rounded-sm font-medium">
              Check a resume you already have
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
