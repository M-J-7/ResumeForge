/**
 * `/resume-keyword-scanner` — a posting and a resume, compared (ROADMAP
 * Phase 3).
 *
 * "Resume keyword scanner" is the search a whole paid product category is
 * built on. This page answers it with the builder's own match engine, in the
 * browser, and with the three things that engine does differently stated on
 * the page: a requirement is weighted by the section it came from, a skill
 * counts as *demonstrated* only where it appears outside the skills list, and
 * repeating a keyword to game the number is penalised rather than rewarded.
 *
 * And the claim it does not make, stated as plainly (D14): no employer's
 * system is known to work like this, and nobody outside an employer can say
 * how theirs ranks. What this shows is which of the posting's asks your
 * resume demonstrates — the comparison a person reading both would make.
 *
 * The explanation is server-rendered, and the section weights are read from
 * `SECTION_WEIGHTS` rather than retyped, so the page cannot describe a
 * weighting the engine does not use.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { CtaLink } from "@/components/marketing/CtaLink";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { JsonLdScript } from "@/components/seo/JsonLd";
import { KeywordScanner } from "@/components/tools/KeywordScanner";
import { webApplicationJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
import { SECTION_WEIGHTS } from "@/lib/jd/parse";
import { GUIDES } from "@/lib/guides/guides";

const PATH = "/resume-keyword-scanner";
const TITLE = "Resume keyword scanner";
const DESCRIPTION =
  "Compare your resume with a job description: which requirements your resume shows, which it " +
  "only lists, and which are missing. Free, in your browser, nothing uploaded.";

export const metadata: Metadata = pageMetadata({
  title: `Free ${TITLE.toLowerCase()}`,
  description: DESCRIPTION,
  path: PATH,
});

/** The sections a reader recognises, in the order the weights run. */
const WEIGHTED_SECTIONS = [
  { kind: "required", label: "Requirements", example: "“Requirements”, “You must have”" },
  { kind: "responsibilities", label: "Responsibilities", example: "“What you’ll do”" },
  { kind: "preferred", label: "Nice to have", example: "“Preferred”, “Bonus points”" },
  { kind: "benefits", label: "Benefits and perks", example: "Salary, holiday, equipment" },
  { kind: "about", label: "About the company", example: "The company describing itself" },
] as const;

const STATUSES = [
  {
    name: "Demonstrated",
    body: "Your resume names it somewhere other than the skills list. An experience or project bullet counts most; a job title, a certification, your education or your summary count for less. That is evidence rather than a claim.",
  },
  {
    name: "Listed only",
    body: "It appears in your skills list and nowhere else. A claim, not evidence — usually the quickest thing to fix, by naming it in the bullet where you used it.",
  },
  {
    name: "Missing",
    body: "The posting asks for it and your resume does not mention it. Sometimes that is a gap; sometimes you have it and never wrote it down.",
  },
];

export default function KeywordScannerPage() {
  return (
    <>
      <JsonLdScript
        data={webApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })}
      />

      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-5xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>{TITLE}</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Paste a job description and your resume, and see which of the posting&rsquo;s asks
              your resume demonstrates, which it only lists, and which it does not mention. It is
              the same match engine the builder uses, running in this tab.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-5xl flex-col gap-12 px-6">
          <section aria-label="Keyword scanner">
            <KeywordScanner />
          </section>

          <div className="grid gap-12 lg:grid-cols-2">
            <section aria-labelledby="weights-heading" className="flex flex-col gap-4">
              <h2 id="weights-heading" className="text-text text-title font-semibold">
                How it reads a posting
              </h2>
              <p className="text-muted text-body leading-relaxed">
                A skill under &ldquo;Requirements&rdquo; is a bar; the same skill in the company
                blurb is decoration. So the posting is split at its headings and each part counts
                for what it is:
              </p>
              <table className="border-line w-full overflow-hidden rounded-lg border text-left text-sm">
                <thead className="bg-surface-1 text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Section
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Counts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WEIGHTED_SECTIONS.map((section) => {
                    const weight = SECTION_WEIGHTS[section.kind];
                    return (
                      <tr key={section.kind} className="border-line border-t">
                        <th scope="row" className="px-4 py-2.5 font-medium">
                          <span className="text-text">{section.label}</span>
                          <span className="text-faint block text-xs font-normal">
                            {section.example}
                          </span>
                        </th>
                        <td className="text-text px-4 py-2.5 font-mono">
                          {weight === 0 ? "ignored" : `${weight}×`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section aria-labelledby="statuses-heading" className="flex flex-col gap-4">
              <h2 id="statuses-heading" className="text-text text-title font-semibold">
                Demonstrated, listed, or missing
              </h2>
              <dl className="flex flex-col gap-3">
                {STATUSES.map((status) => (
                  <div key={status.name} className="border-line bg-surface-0 rounded-lg border p-4">
                    <dt className="text-text text-body font-semibold">{status.name}</dt>
                    <dd className="text-muted text-small mt-1 leading-relaxed">{status.body}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section aria-labelledby="stuffing-heading" className="flex max-w-3xl flex-col gap-3">
            <h2 id="stuffing-heading" className="text-text text-title font-semibold">
              Why repeating keywords does not work here
            </h2>
            <p className="text-muted text-body leading-relaxed">
              The easy way to raise a keyword number is to paste the posting&rsquo;s words into your
              resume until they match. This engine was built so that does not pay: a skill repeated
              far more often than writing needs lowers the result instead of raising it, and a
              &ldquo;bullet&rdquo; that is really a list of keywords counts as a list, not as
              evidence. The honest resume should come out ahead of the stuffed one against the same
              posting &mdash; that is tested, not hoped.
            </p>
          </section>

          <section aria-labelledby="not-heading" className="flex max-w-3xl flex-col gap-3">
            <h2 id="not-heading" className="text-text text-title font-semibold">
              What this is not
            </h2>
            <p className="text-muted text-body leading-relaxed">
              It is not a prediction of what any employer&rsquo;s system will do with your
              application. Nobody outside an employer knows how theirs ranks candidates, and a tool
              that says otherwise is guessing. What this shows is the comparison a careful person
              would make with both documents side by side: what the posting asks for, and where your
              resume shows it.
            </p>
            <p className="text-muted text-body leading-relaxed">
              It recognises software and engineering tools, and the terms of healthcare, teaching,
              office, finance, retail, HR and sales work. It is not exhaustive: where a posting
              names nothing it knows, it says so, rather than inventing a result.
            </p>
          </section>

          <RelatedLinks
            groups={[
              {
                title: "Before you compare",
                items: [
                  {
                    href: "/check",
                    label: "Free ATS resume checker",
                    detail: "See the text a parser recovers from your PDF or Word file first.",
                  },
                  {
                    href: "/bullet-point-checker",
                    label: "Resume bullet point checker",
                    detail: "Check that each bullet says what you did, how, and what changed.",
                  },
                ],
              },
              {
                title: "Read more",
                items: GUIDES.filter((guide) =>
                  ["what-an-ats-actually-does", "how-to-quantify-a-bullet"].includes(guide.slug),
                ).map((guide) => ({
                  href: `/guides/${guide.slug}`,
                  label: guide.title,
                  detail: guide.summary,
                })),
              },
            ]}
          />

          <section className="border-line flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-8">
            <MotionProvider>
              <CtaLink href="/builder" size="md">
                Build a resume that shows it
              </CtaLink>
            </MotionProvider>
            <Link
              href="/examples"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              See examples
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
