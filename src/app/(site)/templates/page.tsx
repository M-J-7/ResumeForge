/**
 * `/templates` — the public, indexable gallery (P32-B3).
 *
 * The gap this closes is perception, not capability. Five font pairs behind
 * a "Design" dialog reads as *no templates* beside a competitor's thumbnailed
 * gallery, and a visitor comparison-shopping leaves before finding out the
 * document engine is better. Naming the combinations and showing them is the
 * whole fix.
 *
 * ## Every thumbnail is a real render
 *
 * Not a picture of a template — the actual PDF pipeline, run in the
 * visitor's browser against a sample resume. So the gallery cannot promise a
 * layout the emitter would not produce, and there is no separate mock-up
 * asset to fall out of date. See `components/templates/TemplateThumbnail.tsx`.
 *
 * The renders are client-side, always: **never render a resume server-side**
 * (D2, landmine 7's neighbour). Two dozen of them per request would be worse
 * still. The page's own text is server-rendered and needs no JavaScript,
 * which is what a crawler reads.
 *
 * ## Three groups, not one wall
 *
 * At twelve templates a single grid was the page. At twenty-four it needed
 * an argument for why a visitor should scroll past the first row, and the
 * honest one is that the later rows are not more of the same: they are
 * shaped by *where* you are applying and *what* you do. Those are the two
 * axes on which real hiring conventions differ — Letter paper and one page
 * in North America, A4 and two in the UK, a licence read before a job
 * history in nursing — and they are the parts of a convention this engine
 * can express without inventing a second layout path.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PublicTemplateGallery } from "@/components/templates/PublicTemplateGallery";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { TEMPLATES, TEMPLATE_COUNT } from "@/lib/resume/templates";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Free resume templates",
  // Under 160: a description that runs past it is truncated mid-sentence in
  // the result, and the half that gets cut is always the half with the offer
  // in it. This one ends on the word that matters.
  description:
    `${TEMPLATE_COUNT} free resume templates for the US, UK, Europe, Australia and India — ` +
    "each a single column of real text with standard headings. No watermark, no account.",
  path: "/templates",
});

export default function TemplatesPage() {
  return (
    <>
      {/* §10.4b — see `/examples` for the reasoning. */}
      <JsonLdScript
        data={itemListJsonLd(
          "Resume templates",
          TEMPLATES.map((template) => ({
            name: template.name,
            // The gallery is one page; each template is an anchor on it, not
            // a route of its own. Naming a URL that does not exist would be
            // markup that does not match the page.
            path: "/templates",
          })),
        )}
      />
      {/*
        A dark stage throughout, rather than a dark band over a light body.
        This page is two dozen renders of white paper, and on near-black they
        stop being thumbnails and become what they are — lit documents on a
        workbench. `data-stage` here also carries onto `<body>` and the
        sticky header, through the `:has()` half of the scope in `globals.css`.
      */}
      <main id="main-content" tabIndex={-1} data-stage="dark" className="flex flex-1 flex-col">
        <PageHeader containerClassName="max-w-6xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Resume templates</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              {TEMPLATE_COUNT} starting points, in three groups: ones to pick on looks, ones shaped
              by where in the world you are applying, and ones shaped by the field you are in.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-muted text-small max-w-measure leading-relaxed">
              They do not differ in structure. Every one is a single column of real text with
              standard section headings, because that is the arrangement software reads most
              reliably — and a template that looked more interesting by putting your job titles in a
              table would read worse for the only audience that matters first. What changes between
              them is the typeface, the paper size, how much fits, and the order a person meets your
              sections in.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
          {/*
            There used to be an `sr-only` <ul> here repeating every name and
            description, on the theory that the gallery needed a text-only
            twin for crawlers. It did not, and the fetched HTML says so:
            `TemplateGallery` is a client component, so React renders it on
            the server anyway, and every name, `forWho` line and card
            `aria-label` is already in the response with JavaScript disabled.
            `e2e/templates.spec.ts` asserts exactly that, against the real
            markup rather than against a shadow copy of it.

            Grouping is what made the duplication actually harmful rather
            than merely wasteful. Each of those entries was an <h2>, so the
            heading outline opened with two dozen bare template names and
            only then reached "General purpose" — a screen-reader user
            skimming by heading met the whole gallery twice, once with no
            context at all, before any of it was explained.
          */}
          <PublicTemplateGallery />

          <section className="border-line max-w-read flex flex-col gap-3 border-t pt-8">
            <h2 className="text-text text-display-3 font-semibold">
              What a template does not change
            </h2>
            <p className="text-muted text-body leading-relaxed">
              Your downloads. PDF, Word and plain text are free on every template, permanently, with
              or without an account — there is no version of this where picking the good-looking one
              costs money.
            </p>
            <p className="text-muted text-body leading-relaxed">
              And it does not change what a parser reads. You can check that yourself rather than
              take our word for it:{" "}
              <Link href="/check" className="text-accent rule-grow rounded-sm">
                drop a finished resume into the checker
              </Link>{" "}
              and see the text a machine gets out of it.
            </p>
            <p className="text-muted text-body">
              <Link href="/builder" className="text-accent rule-grow rounded-sm">
                Start building
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
