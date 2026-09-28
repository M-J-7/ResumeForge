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
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { Card } from "@/components/ui/card";
import { GUIDES } from "@/lib/guides/guides";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Resume guides",
  description:
    "What an applicant tracking system actually does, writing a resume with no work experience, " +
    "putting numbers on your bullets, and which file format to send.",
  path: "/guides",
});

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
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        {/* Dark band, Paper & Ink body — see `/examples` for why these two
            routes are the exception. */}
        <PageHeader stage containerClassName="max-w-3xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Resume guides</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Four of them, and each answers its question completely or it would not be here. No
              filler, and no advice repeated because everyone repeats it &mdash; where the honest
              answer is &ldquo;it depends&rdquo;, it says so and then says what it depends on. Every
              card carries a reading time, so you can decide not to start.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
          <SpotlightGroup>
            <ul className="flex flex-col gap-4">
              {GUIDES.map((guide) => (
                <li key={guide.slug} className="relative">
                  <Card className="spot lift hover:border-line-strong p-5">
                    <h2 className="text-text text-title font-semibold">
                      <Link
                        href={`/guides/${guide.slug}`}
                        className="hover:text-accent rounded-sm after:absolute after:inset-0"
                      >
                        {guide.title}
                      </Link>
                    </h2>
                    <p className="text-muted text-small mt-2 leading-relaxed">{guide.summary}</p>
                    <p className="text-faint text-micro mt-3 font-mono">
                      {guide.minutes} minute read
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </SpotlightGroup>

          <section className="border-line flex flex-wrap items-center gap-5 border-t pt-8">
            <Link
              href="/builder"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Start building
            </Link>
            <Link
              href="/examples"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Examples
            </Link>
            <Link href="/check" className="text-accent rule-grow text-small rounded-sm font-medium">
              Check a resume
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
