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
import { Built } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { GUIDE_SLUGS, getGuide, type GuideBlock } from "@/lib/guides/guides";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, guideArticleJsonLd, guideFaqJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };

  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/guides/${guide.slug}`,
  });
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

      {/*
        This route and `/examples/[role]` never received the redesign: they
        hand-rolled a heading row inside `<main>`, a `bg-accent rounded-md`
        anchor where every other surface uses `CtaLink`, and
        `underline underline-offset-2` where the system draws `.rule-grow`.
        They are on the system now.

        A dark stage *band* over a Paper & Ink body. This is the exception the
        redesign makes on purpose: long-form reading on near-black costs
        comprehension, and these are the pages a stranger reaches from a
        search.
      */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-2xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>{guide.title}</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>{guide.summary}</p>
          </Built>
          <Built className="mt-4">
            {/* Mono, because it is a measurement of the page rather than a
                sentence we wrote about it. */}
            <p className="text-faint text-micro font-mono">{guide.minutes} minute read</p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-2xl flex-col gap-8 px-6">
          {guide.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-text text-title font-semibold">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}

          <section className="border-line flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-8">
            {/* `MotionProvider` because `CtaLink` is an `m.*` component and
                `LazyMotion strict` throws outside one. The band above carries
                its own; `domAnimation` is a module-level import either way, so
                the second provider costs nothing but a context. */}
            <MotionProvider>
              <CtaLink href="/builder" size="md">
                Start building
              </CtaLink>
            </MotionProvider>
            <Link
              href="/guides"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              All guides
            </Link>
            <Link
              href="/examples"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Examples
            </Link>
            {/*
              Internal linking (§10.4b). Crawl depth from the landing page was
              three for these pages; cross-linking guides ↔ examples ↔ the
              check tool makes it two, and gives a reader who finished this the
              obvious next thing rather than a dead end.
            */}
            <Link href="/check" className="text-accent rule-grow text-small rounded-sm font-medium">
              Check a resume
            </Link>
            <Link
              href="/templates"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              Templates
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "prose":
      return <p className="text-muted text-body leading-relaxed">{block.text}</p>;

    case "list":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item} className="text-muted text-body flex gap-2 leading-relaxed">
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
        <p className="border-accent bg-accent-weak text-text text-body rounded-r-md border-l-2 px-4 py-3 leading-relaxed">
          {block.text}
        </p>
      );
  }
}
