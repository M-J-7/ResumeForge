/**
 * `/guides` — the index (P36).
 *
 * Four guides, listed with what each one answers and how long it takes.
 * Reading time is there so somebody can decide not to read it, which is a
 * better outcome for both of us than a bounce three paragraphs in.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { Card } from "@/components/ui/card";
import { GUIDES } from "@/lib/guides/guides";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Resume guides",
  description:
    "What an applicant tracking system actually does, writing a resume with no work experience, putting numbers on your bullets, and which file format to send.",
  alternates: { canonical: "/guides" },
};

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

export default function GuidesIndexPage() {
  return (
    <>
      {/* §10.4b — see `/examples` for the reasoning. */}
      <JsonLdScript
        data={itemListJsonLd(
          "Resume guides",
          GUIDES.map((guide) => ({ name: guide.title, path: `/guides/${guide.slug}` })),
        )}
      />
      <main className="flex flex-1 flex-col">
        <PageHeader containerClassName="max-w-3xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Guides</h1>
          </Built>
          <Built className="mt-5">
            <p className="text-muted text-sm leading-relaxed">
              Four of them, which is deliberate. A thin page that ranks and then disappoints costs
              you a click and costs us the one impression we had, so these answer their question
              completely or they are not here.
            </p>
          </Built>
        </PageHeader>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
          <SpotlightGroup>
            <ul className="flex flex-col gap-4">
              {GUIDES.map((guide) => (
                <li key={guide.slug} className="relative">
                  <Card className="spot lift hover:border-line-strong p-5">
                    <h2 className="text-text text-base font-semibold">
                      <Link
                        href={`/guides/${guide.slug}`}
                        className="hover:text-accent rounded-sm after:absolute after:inset-0"
                      >
                        {guide.title}
                      </Link>
                    </h2>
                    <p className="text-muted mt-2 text-sm leading-relaxed">{guide.summary}</p>
                    <p className="text-faint mt-2 text-xs">{guide.minutes} minute read</p>
                  </Card>
                </li>
              ))}
            </ul>
          </SpotlightGroup>

          <section className="border-line flex flex-wrap items-center gap-5 border-t pt-8">
            <Link href="/builder" className="text-accent rule-grow rounded-sm text-sm font-medium">
              Start building
            </Link>
            <Link href="/examples" className="text-accent rule-grow rounded-sm text-sm font-medium">
              Examples
            </Link>
            <Link href="/check" className="text-accent rule-grow rounded-sm text-sm font-medium">
              Check a resume
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
