/**
 * Terms of use (§9: live before launch).
 *
 * Deliberately short and readable. The substantive points are that the user
 * owns what they write, that the honest-claims position in D14 is stated as
 * a term rather than only as marketing, and that a browser-local tool comes
 * with a data-loss caveat it would be dishonest to bury.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — ATS Resume Builder",
  description: "The terms covering use of this resume builder.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Terms of use</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated 30 August 2026.
        </p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Your work is yours
        </h2>
        <p>
          You own everything you write here and every file you generate from it. We claim no licence
          over your content, and could not exercise one in any case, since it never reaches us.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          What this tool does and does not claim
        </h2>
        <p>
          This builder produces a single-column document with real text and standard section
          headings — the structure that is most reliably readable across the widest range of
          applicant tracking systems. That is the whole of the claim.
        </p>
        <p>
          It is not a guarantee that any particular system will parse your resume correctly, that
          you will pass any screen, or that you will receive any interview. Those depend on the
          employer, their configuration, and your experience, none of which this tool controls.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Keep your own copy
        </h2>
        <p>
          Your draft lives in your browser&rsquo;s storage. Clearing site data, using private
          browsing, switching browsers or devices, or a browser reclaiming storage under pressure
          will remove it, and we cannot recover it. Download your resume once you have something you
          would be sorry to lose.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fair use</h2>
        <p>
          Use this to build resumes — your own, or one you are helping someone else with. Do not use
          it to misrepresent anyone&rsquo;s history, and do not attempt to disrupt the service for
          other people.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Provided as-is</h2>
        <p>
          This is offered free and without warranty. We are not liable for the outcomes of your job
          search, nor for data lost from your browser&rsquo;s storage.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fonts</h2>
        <p>
          Generated documents embed open-licensed fonts under the SIL Open Font License. Their
          licences ship alongside them in this project&rsquo;s source.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/" className="underline underline-offset-2">
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
