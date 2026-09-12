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
 * (D2, landmine 7's neighbour). Twelve of them per request would be worse
 * still. The page's own text is server-rendered and needs no JavaScript,
 * which is what a crawler reads.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PublicTemplateGallery } from "@/components/templates/PublicTemplateGallery";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { TEMPLATES } from "@/lib/resume/templates";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Resume templates",
  description:
    "Twelve free resume templates. Every one is single-column, real text, with standard section " +
    "headings — the structure that reads most reliably. Download as PDF, DOCX or plain text.",
  alternates: { canonical: "/templates" },
};

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

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
      <main className="flex flex-1 flex-col">
        <PageHeader containerClassName="max-w-6xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Resume templates</h1>
          </Built>
          <Built className="mt-5">
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              Twelve starting points. They differ in typeface, in where the header sits, in how
              section headings are set, and in what order the sections come in.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              They do not differ in structure. Every one is a single column of real text with
              standard section headings, because that is the arrangement software reads most
              reliably — and a template that looked more interesting by putting your job titles in a
              table would read worse for the only audience that matters first. Pick on how it looks
              to a person; the machine sees the same document either way.
            </p>
          </Built>
        </PageHeader>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
          {/*
          The list below is server-rendered and present without JavaScript,
          so a crawler reads all twelve names and descriptions even though the
          thumbnails above need a browser to draw. It is visually hidden
          rather than duplicated on screen.
        */}
          <ul className="sr-only">
            {TEMPLATES.map((template) => (
              <li key={template.id}>
                <h2>{template.name}</h2>
                <p>{template.forWho}</p>
              </li>
            ))}
          </ul>

          <PublicTemplateGallery />

          <section className="border-line flex max-w-prose flex-col gap-3 border-t pt-8">
            <h2 className="font-display text-text text-2xl font-semibold tracking-tight">
              What a template does not change
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              Your downloads. PDF, Word and plain text are free on every template, permanently, with
              or without an account — there is no version of this where picking the good-looking one
              costs money.
            </p>
            <p className="text-muted text-sm leading-relaxed">
              And it does not change what a parser reads. You can check that yourself rather than
              take our word for it:{" "}
              <Link href="/check" className="text-accent rule-grow rounded-sm">
                drop a finished resume into the checker
              </Link>{" "}
              and see the text a machine gets out of it.
            </p>
            <p className="text-muted text-sm">
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
