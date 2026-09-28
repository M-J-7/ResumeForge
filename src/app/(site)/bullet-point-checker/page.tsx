/**
 * `/bullet-point-checker` — paste a bullet, see what it is missing
 * (ROADMAP Phase 3).
 *
 * A free tool that answers the most common resume question after "which
 * template": *is this bullet any good?* It runs the builder's own Bullet
 * Coach and lint engine on whatever is pasted, in the browser, and says which
 * of the four parts a bullet has and what to ask about the one it lacks.
 *
 * What it will not do is the point of it, and the page says so: it does not
 * rewrite the bullet (D8). Most versions of this tool elsewhere are an AI
 * rewrite button, and a rewritten bullet is a claim somebody else made about
 * your work that you then have to defend in an interview.
 *
 * The page is prerendered; only `BulletChecker` runs in the browser. The
 * explanation below it is server-rendered text, which is what a crawler reads
 * and what the page is found by.
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
import { BulletChecker } from "@/components/tools/BulletChecker";
import { webApplicationJsonLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
import { GUIDES } from "@/lib/guides/guides";
import { ACTION_VERBS_PATH, ALL_ACTION_VERBS } from "@/lib/verbs/action-verbs";

const PATH = "/bullet-point-checker";
const TITLE = "Resume bullet point checker";
const DESCRIPTION =
  "Paste your resume bullets and see which of the four parts each one has — what you did, to " +
  "what, how, and the result — and what to ask about the part it lacks. Free, in your browser.";

export const metadata: Metadata = pageMetadata({
  title: `Free ${TITLE.toLowerCase()}`,
  description: DESCRIPTION,
  path: PATH,
});

/** What each part is, for the reader and the crawler. */
const PARTS = [
  {
    name: "Action",
    body: "A verb that names what you did. Not “responsible for”, which says the task existed, and not “helped”, which hides your share of it.",
  },
  {
    name: "What",
    body: "What you did it to: the system, the process, the team, the account. Without it the verb has nothing to act on.",
  },
  {
    name: "How",
    body: "The method, introduced by “by”, “through” or “using”. It is the part that makes the result believable.",
  },
  {
    name: "Outcome",
    body: "What changed because you did it — a count, a time, an amount, a scale. The commonest part to leave out, and the one a reader looks for first.",
  },
];

export default function BulletCheckerPage() {
  return (
    <>
      <JsonLdScript
        data={webApplicationJsonLd({ name: TITLE, description: DESCRIPTION, path: PATH })}
      />

      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-3xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>{TITLE}</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              Paste your bullets and see which of the four parts each one has, with the question to
              ask about the part it is missing. It is the same coach and the same checker the
              builder uses &mdash; and it will not rewrite a word of it for you.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-3xl flex-col gap-12 px-6">
          <section aria-label="Bullet checker">
            <BulletChecker />
          </section>

          <section aria-labelledby="parts-heading" className="flex flex-col gap-4">
            <h2 id="parts-heading" className="text-text text-title font-semibold">
              What it checks
            </h2>
            <p className="text-muted text-body leading-relaxed">
              A bullet that a reader remembers usually has four parts. The checker looks for each
              one and asks about each that is missing, the most consequential first.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {PARTS.map((part) => (
                <div key={part.name} className="border-line bg-surface-0 rounded-lg border p-4">
                  <dt className="text-text text-body font-semibold">{part.name}</dt>
                  <dd className="text-muted text-small mt-1 leading-relaxed">{part.body}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted text-body leading-relaxed">
              It also flags what the builder&rsquo;s checker flags on a single line: a bullet that
              has grown into a paragraph, a first-person pronoun, an opening that describes being
              present rather than what you did. None of that is a score. It is a count of what is
              left, which is the thing you can act on.
            </p>
          </section>

          <section aria-labelledby="wont-heading" className="flex flex-col gap-3">
            <h2 id="wont-heading" className="text-text text-title font-semibold">
              What it will not do
            </h2>
            <p className="text-muted text-body leading-relaxed">
              Rewrite your bullet. Most tools like this are a button that does exactly that, and the
              result is a sentence somebody else wrote about your work &mdash; sometimes with
              numbers you did not give it, which you will be asked about in an interview. This one
              asks the question and leaves the answer to the person who knows it.
            </p>
            <p className="text-muted text-body leading-relaxed">
              It also does not keep anything. The check runs in this tab as you type; nothing is
              sent to a server and nothing is saved.
            </p>
          </section>

          <RelatedLinks
            groups={[
              {
                title: "When a part is missing",
                items: [
                  {
                    href: ACTION_VERBS_PATH,
                    label: "Resume action verbs, grouped by what you did",
                    detail: `${ALL_ACTION_VERBS.length} verbs to open a bullet with, and the sentence shapes that go with them.`,
                  },
                  ...GUIDES.filter((guide) => guide.slug === "how-to-quantify-a-bullet").map(
                    (guide) => ({
                      href: `/guides/${guide.slug}`,
                      label: guide.title,
                      detail: guide.summary,
                    }),
                  ),
                ],
              },
              {
                title: "See it done",
                items: [
                  {
                    href: "/examples/sales-representative",
                    label: "Sales Representative resume example",
                    detail: "Bullets where the outcome is a number a reader can check.",
                  },
                  {
                    href: "/examples/graduate-no-experience",
                    label: "Graduate with no work experience resume example",
                    detail: "Four parts to every bullet, with no job title to lean on.",
                  },
                ],
              },
            ]}
          />

          <section className="border-line flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-8">
            <MotionProvider>
              <CtaLink href="/builder" size="md">
                Build the whole resume
              </CtaLink>
            </MotionProvider>
            <Link href="/check" className="text-accent rule-grow text-small rounded-sm font-medium">
              Check a resume file
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
