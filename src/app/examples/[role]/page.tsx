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
import { ResumePaper } from "@/components/marketing/ResumePaper";
import { EXAMPLE_SLUGS, getRoleExample } from "@/lib/examples/roles";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, roleExampleJsonLd } from "@/lib/structured-data";
import { phrasesForTitle } from "@/lib/phrases/lookup";
import { renderText } from "@/lib/emit/text/render";

export function generateStaticParams() {
  return EXAMPLE_SLUGS.map((role) => ({ role }));
}

export async function generateMetadata({
  params,
}: PageProps<"/examples/[role]">): Promise<Metadata> {
  const { role } = await params;
  const example = getRoleExample(role);
  if (!example) return { title: "Example not found" };

  return {
    title: `${example.role} resume example`,
    description: `${example.summary} A complete ${example.role.toLowerCase()} resume, the plain text a parser reads from it, and the choices behind each line.`,
    alternates: { canonical: `/examples/${example.slug}` },
  };
}

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

export default async function ExamplePage({ params }: PageProps<"/examples/[role]">) {
  const { role } = await params;
  const example = getRoleExample(role);
  if (!example) notFound();

  // The occupation index is loaded on the server here rather than in the
  // browser: the scaffolds are page content, so they have to be in the HTML.
  const phrases = await phrasesForTitle(example.occupationTitle);
  const plainText = renderText(example.resume);

  return (
    <>
      {/*
        §10.4b. Each of these is a long-tail landing page for "<role> resume
        example", which is the search this product should own; the breadcrumb
        is what makes the result read as part of a gallery.
      */}
      <JsonLdScript data={roleExampleJsonLd(example)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Examples", path: "/examples" },
          { name: `${example.role} resume example`, path: `/examples/${example.slug}` },
        ])}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
        <header className="flex max-w-prose flex-col gap-3">
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">
            {example.field}
          </p>
          <h1 className="font-display text-text text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-tight text-balance">
            {example.role} resume example
          </h1>
          <p className="text-muted text-sm leading-relaxed">{example.summary}</p>
          <p className="text-faint text-xs">
            Invented for this page. The name, the employers and every number in it are made up — a
            real resume is somebody&rsquo;s personal data and is not ours to publish.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <ResumePaper resume={example.resume} />

          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h2 className="text-text text-lg font-semibold">Why it is written this way</h2>
              <ul className="flex flex-col gap-4">
                {example.notes.map((note) => (
                  <li key={note.title}>
                    <p className="text-text text-sm font-medium">{note.title}</p>
                    <p className="text-muted mt-1 text-sm leading-relaxed">{note.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            {phrases.topics.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h2 className="text-text text-lg font-semibold">Shapes to fill in</h2>
                <p className="text-muted text-sm leading-relaxed">
                  Each blank is yours to complete. These are the same scaffolds the builder offers
                  for this occupation — none of them says anything until you fill it in, which is
                  what keeps them useful rather than a lie somebody else wrote.
                </p>
                {phrases.topics.slice(0, 3).map((topic) => (
                  <div key={topic.id}>
                    <h3 className="text-text mt-2 text-sm font-medium">{topic.label}</h3>
                    <ul className="mt-1 flex flex-col gap-1">
                      {topic.scaffolds.slice(0, 4).map((scaffold) => (
                        <li key={scaffold} className="text-muted font-mono text-xs">
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
                <h2 className="text-text text-lg font-semibold">Also called</h2>
                <p className="text-muted text-sm">
                  {phrases.relatedTitles.slice(0, 10).join(" · ")}
                </p>
                <p className="text-faint text-xs">
                  From the O*NET occupation database. Worth checking which of these a posting uses,
                  because that is the wording its keyword search will be built on.
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
          <h2 className="text-text text-lg font-semibold">What a parser reads from this resume</h2>
          <p className="text-muted max-w-prose text-sm leading-relaxed">
            This is the actual plain-text output for the document above — the same text an applicant
            tracking system extracts, and the same text this app hands you when you download the
            .txt. Nothing is lost between the page and the parser, which is the whole argument for a
            single column of real text.
          </p>
          <pre className="border-line bg-surface-1 text-muted overflow-x-auto rounded-lg border p-4 font-mono text-xs whitespace-pre-wrap">
            {plainText}
          </pre>
        </section>

        <section className="border-line flex flex-wrap items-center gap-4 border-t pt-8">
          <Link
            href="/builder"
            className="bg-accent text-on-accent hover:bg-accent-hover rounded-md px-5 py-3 text-sm font-medium transition"
          >
            Write yours
          </Link>
          <Link href="/examples" className="text-accent text-sm underline underline-offset-2">
            All examples
          </Link>
          <Link href="/templates" className="text-accent text-sm underline underline-offset-2">
            Templates
          </Link>
          <Link href="/check" className="text-accent text-sm underline underline-offset-2">
            Check a resume you already have
          </Link>
        </section>
      </main>
      <AppFooter />
    </>
  );
}
