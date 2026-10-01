/**
 * `/about` — what this is, why it exists, and the rules every page follows
 * (ROADMAP Phase 3, trust signals).
 *
 * Search engines weigh who stands behind advice pages, and so do readers. A
 * named author is the owner's decision (`docs/OWNER-ACTIONS.md`, item 9), so
 * this page is written around what can be checked instead: the editorial
 * rules, each tied to the test that enforces it, and where to send a
 * correction. Every rule below is true of the code today; if one stops being
 * true, this page is wrong, and it should change in the same commit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_LEAD_CLASS, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { pageMetadata } from "@/lib/seo";
import { REPO_URL } from "@/lib/site";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "What this free resume builder is, why it refuses AI writing and outcome promises, and the " +
    "rules every guide, example and measurement on the site follows.",
  path: "/about",
});

const RULES: readonly { title: string; body: string }[] = [
  {
    title: "No promised outcomes",
    body: "No page here promises interviews, offers or a pass rate. Nobody outside an employer's own system can know those, and a test fails the build if any page claims one.",
  },
  {
    title: "Nothing written for you",
    body: "There is no AI writer. The coach asks questions and never supplies a sentence or a number, because a figure invented on your behalf is one you cannot defend in an interview.",
  },
  {
    title: "Examples are invented, and held to the same bar as yours",
    body: "Every name, employer and number on an example resume is made up. Each one passes the same checks the builder runs on your resume, and every bullet answers the coach's questions.",
  },
  {
    title: "Dates mean what they say",
    body: "A page's “Updated” date changes only when the page does. The build fingerprints each guide and example, and fails if the content changes without its date.",
  },
  {
    title: "Measurements can be re-run",
    body: "When a guide reports a measurement, the code that made it is public, the numbers are re-measured on every build, and the guide says what the measurement does not show.",
  },
  {
    title: "Official rules are sourced",
    body: "Where a guide relies on a rule someone else sets — the two-page limit on US federal resumes, for instance — it names who set it and when.",
  },
  {
    title: "Conventions are labelled by market",
    body: "India and the US expect different things on a resume. Guides and examples written for one market say so, so a reader in the other knows what to translate.",
  },
];

export default function AboutPage() {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-2xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>About {PRODUCT_NAME}</h1>
          </Built>
          <Built className="mt-5">
            <p className={PAGE_LEAD_CLASS}>
              A free resume builder that runs in your browser, shows you what software reads from your
              file, and refuses the three things resume tools usually sell: paid downloads, promised
              outcomes, and an AI writing your experience for you.
            </p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-2xl flex-col gap-10 px-6">
          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">What it is</h2>
            <p>
              You build a one-column resume of real text and download it as PDF, Word or plain text,
              free, with no account and no watermark. Beside the preview, four views show you the
              document the way others will meet it: what a parser extracts from the exact file
              (X-Ray), where your name and current role land on page one (Six seconds), how your
              page answers a job posting you paste (Match), and every figure you may be asked to
              explain (Interview).
            </p>
            <p>
              Without an account, your resume never leaves your browser. An account is optional and
              exists so your resumes follow you between devices; the{" "}
              <Link href="/privacy" className="text-accent rule-grow rounded-sm font-medium">
                privacy page
              </Link>{" "}
              lists everything that is stored and counted.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Why it exists</h2>
            <p>
              A resume is evidence about a person, and most tools treat it as something to generate
              and score. They charge for the file you wrote, quote pass rates nobody outside an
              employer can know, and offer to write the bullets — which leaves you defending numbers
              you never had. This one shows you how your own words read, to a parser and to a
              person, and leaves the writing to you.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Who makes it</h2>
            <p>
              {PRODUCT_NAME} is built and maintained independently, by one developer, and carries no
              advertising. The code is public on{" "}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-accent rule-grow rounded-sm font-medium"
              >
                GitHub
              </a>
              , and every change that reaches the site is recorded, with its date, on{" "}
              <Link href="/changelog" className="text-accent rule-grow rounded-sm font-medium">
                what changed
              </Link>
              .
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-text text-title font-semibold">The rules every page follows</h2>
            <ul className="flex flex-col gap-4">
              {RULES.map((rule) => (
                <li key={rule.title} className="border-line border-l-2 pl-4">
                  <h3 className="text-text text-body font-semibold">{rule.title}</h3>
                  <p className="text-muted text-body mt-1 leading-relaxed">{rule.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Corrections and questions</h2>
            <p>
              If a guide is wrong, or the builder misreads your resume, open an issue on{" "}
              <a
                href={`${REPO_URL}/issues`}
                target="_blank"
                rel="noreferrer"
                className="text-accent rule-grow rounded-sm font-medium"
              >
                GitHub
              </a>{" "}
              and say which sentence or which file. Corrections change the page&rsquo;s date and are
              listed on the changelog, so a fix is visible rather than silent.
            </p>
          </section>

          <section className="border-line flex flex-wrap items-center gap-5 border-t pt-8">
            <Link href="/builder" className="text-accent rule-grow text-small rounded-sm font-medium">
              Start building
            </Link>
            <Link href="/guides" className="text-accent rule-grow text-small rounded-sm font-medium">
              Guides
            </Link>
            <Link
              href="/guides/two-column-resume-ats"
              className="text-accent rule-grow text-small rounded-sm font-medium"
            >
              A measurement
            </Link>
          </section>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
