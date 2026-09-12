/**
 * `/check` — the free ATS check (P31-A4).
 *
 * The category's standard top-of-funnel move, with the two things that make
 * ours different: it is free, and it shows its working. A competitor's
 * equivalent is a trademarked name over a number nobody can check; this
 * re-parses the visitor's own file in their own browser and shows what came
 * back, field by field, beside the raw text it came from.
 *
 * Within D14 throughout. The page describes what a parser recovered from a
 * file. It never claims what an employer's system will do with it, because
 * nobody — including us — can know that.
 *
 * Nothing is uploaded, and that is a property of the code rather than a
 * promise on a page: `CheckTool` is a client component, the parse runs in
 * the visitor's tab, and there is no route on this server that accepts a
 * resume file at all. `e2e/import.spec.ts` asserts it by watching the
 * network.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckTool } from "@/components/check/CheckTool";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Check what a resume parser reads",
  description:
    "Drop in a PDF or Word resume and see the text and fields a parser recovers from it. " +
    "Free, no account, and the file never leaves your browser.",
  alternates: { canonical: "/check" },
};

/** Reads the runtime origin for its metadata — see `privacy/page.tsx`. */
export const dynamic = "force-dynamic";

export default function CheckPage() {
  return (
    <>
      <main className="flex flex-1 flex-col">
        {/* This is the machine's own page, so the heading is the one place
            the band's light is the parser's colour rather than the accent. */}
        <PageHeader containerClassName="max-w-3xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>See what a machine reads from your resume</h1>
          </Built>
          <Built className="mt-5">
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              Applicant tracking systems do not read your resume the way you do. They extract text
              from the file and try to find fields in it. This runs that extraction on your file and
              shows you the result — the text it recovered, the fields it found, and the lines where
              two different parsers would disagree about the reading order.
            </p>
          </Built>
          <Built className="mt-3">
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              It runs entirely in your browser. Your file is never uploaded, there is no account,
              and there is nothing to pay for.
            </p>
          </Built>
        </PageHeader>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
          <CheckTool />

          <section className="border-line flex flex-col gap-3 border-t pt-8">
            <h2 className="font-display text-text text-2xl font-semibold tracking-tight">
              What this does not tell you
            </h2>
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              It cannot tell you whether a particular employer&rsquo;s system will accept your
              resume. Nobody can: those systems are private, they differ from each other, and anyone
              selling you a &ldquo;guaranteed to pass&rdquo; score is guessing. What this shows is
              narrower and checkable — the text a parser gets out of your file, and which fields are
              recoverable from it. If your name, your email or your job titles do not come back
              here, that is a real problem in the file itself, and it is fixable.
            </p>
            <p className="text-muted text-sm">
              <Link href="/builder" className="text-accent rule-grow rounded-sm">
                Build a resume from scratch
              </Link>{" "}
              instead, or{" "}
              <Link href="/privacy" className="text-accent rule-grow rounded-sm">
                read what we store
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
