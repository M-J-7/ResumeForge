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
import { Faq } from "@/components/marketing/Faq";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { TEMPLATES, TEMPLATE_COUNT } from "@/lib/resume/templates";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { faqPageJsonLd, itemListJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
import { TEMPLATE_AUDIENCES, TEMPLATE_FAQ } from "@/lib/template-content";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Free resume templates",
    // Under 160: a description that runs past it is truncated mid-sentence in
    // the result, and the half that gets cut is always the half with the offer
    // in it. This one ends on the word that matters.
    description:
      `${TEMPLATE_COUNT} free ATS-friendly resume templates for freshers and experienced applicants. ` +
      "Edit online or download Word and PDF. No sign-up or watermark.",
    path: "/templates",
  }),
  // Keep the short sharing title; the search title describes the download intent.
  title: { absolute: "Free ATS-friendly resume templates — Word & PDF" },
};

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
            path: `/templates#template-${template.id}`,
          })),
        )}
      />
      <JsonLdScript data={faqPageJsonLd(TEMPLATE_FAQ)} />
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
            <h1 className={PAGE_TITLE_CLASS}>Resume templates: free and ATS-friendly</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              {TEMPLATE_COUNT} free ATS-friendly resume templates for freshers, experienced
              professionals and career changers. Choose by appearance, where you are applying or the
              field you work in. Every one downloads free as a Word file or a PDF, with a sample
              resume in it to write over — or opens in the builder, where you fill it in and
              download it as yourself.
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
          <section aria-labelledby="choose-template-heading" className="flex flex-col gap-5">
            <h2 id="choose-template-heading" className="text-text text-title font-semibold">
              Choose a template for your experience
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {TEMPLATE_AUDIENCES.map((audience) => (
                <div
                  key={audience.template}
                  className="border-line flex flex-col gap-3 border-t pt-4"
                >
                  <h3 className="text-text text-body font-semibold">{audience.title}</h3>
                  <p className="text-muted text-small max-w-measure leading-relaxed">
                    {audience.body}
                  </p>
                  <div className="text-small flex flex-wrap gap-x-5 gap-y-2">
                    <a
                      href={`#template-${audience.template}`}
                      className="text-accent rule-grow rounded-sm"
                    >
                      See {audience.label}
                    </a>
                    <Link href={audience.guide} className="text-accent rule-grow rounded-sm">
                      {audience.guideLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
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

          <section
            aria-labelledby="template-steps-heading"
            className="border-line max-w-read flex flex-col gap-4 border-t pt-8"
          >
            <h2 id="template-steps-heading" className="text-text text-title font-semibold">
              Create and download your resume in three steps
            </h2>
            <ol className="text-muted text-body flex list-decimal flex-col gap-3 pl-6 leading-relaxed">
              <li>
                <strong className="text-text">Choose your template.</strong> Use the preview and
                description to choose a layout. Download Word for an editable sample, or select Use
                this template to start in the online builder.
              </li>
              <li>
                <strong className="text-text">Add your own information.</strong> Replace every
                sample detail. Include relevant experience, education, projects and skills; students
                can lead with education and projects.
              </li>
              <li>
                <strong className="text-text">Preview and download.</strong> Check the page breaks
                and contact details, then download PDF, Word or plain text for free. Keep a JSON
                Resume backup if you want a portable copy to import later.
              </li>
            </ol>
          </section>

          <section
            aria-labelledby="ats-template-heading"
            className="border-line max-w-read flex flex-col gap-4 border-t pt-8"
          >
            <h2 id="ats-template-heading" className="text-text text-title font-semibold">
              What makes a resume template ATS-friendly?
            </h2>
            <p className="text-muted text-body leading-relaxed">
              An applicant tracking system collects applications and may extract your document into
              fields. These templates use one column of selectable text, standard headings and
              consistent employment details. They keep names, dates and skills out of images, charts
              and decorative sidebars. A simple format helps a parser recover information; it cannot
              determine whether your qualifications meet an employer&rsquo;s requirements.
            </p>
            <p className="text-muted text-body leading-relaxed">
              Follow the application&rsquo;s file instructions, replace all sample content and check
              the downloaded file. Use the{" "}
              <Link href="/resume-keyword-scanner" className="text-accent rule-grow rounded-sm">
                resume keyword scanner
              </Link>{" "}
              to compare your own experience with a posting. Include relevant skills only where they
              are true of you.
            </p>
          </section>

          <section
            aria-labelledby="template-faq-heading"
            className="border-line max-w-read border-t pt-8"
          >
            <h2 id="template-faq-heading" className="text-text text-title font-semibold">
              Questions about free resume templates
            </h2>
            <MotionProvider>
              <Faq items={TEMPLATE_FAQ} />
            </MotionProvider>
          </section>

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
