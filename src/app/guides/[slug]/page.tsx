/**
 * `/guides/[slug]` — one guide (P36).
 *
 * Four of them, and the count is the decision. A thin page that ranks and
 * disappoints costs the reader a click and costs us the one impression we
 * had; forty of those is worse than four that answer their question
 * completely.
 *
 * Content comes from `lib/guides/guides.ts` as structured blocks rather than
 * markdown, for the reason stated there: a markdown pipeline is a parser, a
 * sanitiser and a styling layer that none of this needs.
 *
 * Server-rendered with no client JavaScript, which is the package's
 * acceptance criterion and also just what a page of prose should be.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppFooter } from "@/components/shell/AppFooter";
import { GUIDE_SLUGS, getGuide, type GuideBlock } from "@/lib/guides/guides";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, guideArticleJsonLd, guideFaqJsonLd } from "@/lib/structured-data";

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };

  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <>
      {/*
        §10.4b. `Article` and a breadcrumb trail on every guide; `FAQPage`
        only on the ones that genuinely pose questions — "What an applicant
        tracking system actually does" and "PDF, Word, or plain text" are
        exactly the shape that wins the "People also ask" slot, and marking up
        a page that answers none would be both false and a manual-action risk.
      */}
      <JsonLdScript data={guideArticleJsonLd(guide)} />
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Guides", path: "/guides" },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ])}
      />
      <JsonLdScript data={guideFaqJsonLd(guide)} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-text text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-tight text-balance">
            {guide.title}
          </h1>
          <p className="text-muted text-sm leading-relaxed">{guide.summary}</p>
          <p className="text-faint text-xs">{guide.minutes} minute read</p>
        </header>

        {guide.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-text text-lg font-semibold">{section.heading}</h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}

        <section className="border-line flex flex-wrap items-center gap-4 border-t pt-8">
          <Link
            href="/builder"
            className="bg-accent text-on-accent hover:bg-accent-hover rounded-md px-5 py-3 text-sm font-medium transition"
          >
            Start building
          </Link>
          <Link href="/guides" className="text-accent text-sm underline underline-offset-2">
            All guides
          </Link>
          <Link href="/examples" className="text-accent text-sm underline underline-offset-2">
            Examples
          </Link>
          {/*
            Internal linking (§10.4b). Crawl depth from the landing page was
            three for these pages; cross-linking guides ↔ examples ↔ the
            check tool makes it two, and gives a reader who finished this the
            obvious next thing rather than a dead end.
          */}
          <Link href="/check" className="text-accent text-sm underline underline-offset-2">
            Check a resume
          </Link>
          <Link href="/templates" className="text-accent text-sm underline underline-offset-2">
            Templates
          </Link>
        </section>
      </main>
      <AppFooter />
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "prose":
      return <p className="text-muted text-sm leading-relaxed">{block.text}</p>;

    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item} className="text-muted flex gap-2 text-sm leading-relaxed">
              <span aria-hidden className="text-faint">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <p className="border-accent bg-accent-weak text-text rounded-r-md border-l-2 px-4 py-3 text-sm leading-relaxed">
          {block.text}
        </p>
      );
  }
}
