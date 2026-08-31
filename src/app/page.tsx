/**
 * Landing page (M0-T13).
 *
 * Positioning is constrained by D14 and §9: no "beat the bots", no
 * "guaranteed to pass", no invented interview-rate lift. Every claim here is
 * one we can actually substantiate — the downloads really are free, the
 * builder really does work without an account, and nothing is sent anywhere
 * until the user signs in and asks for it.
 *
 * Revised when M2 added optional accounts. The hero used to say "there is no
 * account", which stopped being true — and a landing page that overstates a
 * privacy position is the same failure as one that overstates a result.
 *
 * The honest version is also the stronger one: "we won't write lies for you"
 * and "here is what the machine actually reads" are things no competitor
 * making the usual claims can say.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // `absolute` so the root layout's "%s — ATS Resume Builder" template does
  // not append the product name to a title that already carries it.
  title: { absolute: "ATS Resume Builder — free downloads, nothing uploaded" },
  description:
    "Build a resume that parses cleanly. PDF, DOCX, and plain text, free forever. Works without an account, and your resume never leaves your browser.",
};

const PROMISES = [
  {
    title: "Downloads are free, permanently",
    body: "PDF, DOCX, and plain text. No paywall at the last step, no watermark, no account needed to get your own work back out.",
  },
  {
    title: "Nothing is uploaded unless you ask",
    body: "Without an account your resume is written to storage inside your browser and stays there. An account is optional, adds syncing between devices, and deletes on request — every resume, immediately, with no copy kept.",
  },
  {
    title: "No AI writes your resume",
    body: "We will not invent accomplishments you would then have to defend in an interview. The coaching here asks you questions; the words stay yours.",
  },
  {
    title: "Three formats, because they parse differently",
    body: "DOCX reads most reliably through the older application systems. PDF preserves exactly what you laid out. We tell you which to use where.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "Write it",
    body: "Fill in the sections. Every field validates as you type, and the checklist tells you what is still worth fixing — and why it matters, not just that it does.",
  },
  {
    step: "See the real document",
    body: "The preview is not an approximation of your PDF. It is the PDF, rendered live, so what you see is byte-for-byte what you download.",
  },
  {
    step: "Download and apply",
    body: "All three formats, named the way a recruiter's downloads folder wants them.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl dark:text-zinc-50">
            A resume builder that does not hold your resume hostage
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Build a single-column resume in three formats, download all of them for nothing, and
            keep every word you wrote. It runs in your browser, and works without an account —
            nothing is sent anywhere unless you sign in and save it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/builder"
              className="rounded-md bg-sky-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              Start building
            </Link>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              No sign-up needed. Nothing to cancel.
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 px-6 py-16 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            What we actually promise
          </h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div key={promise.title}>
                <dt className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {promise.title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {promise.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-zinc-200 px-6 py-16 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            How it works
          </h2>
          <ol className="mt-8 flex flex-col gap-8">
            {HOW_IT_WORKS.map((item, index) => (
              <li key={item.step} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.step}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/*
        The honesty section. Every competitor in this category claims to
        guarantee ATS success; none can. Saying plainly what is and is not
        knowable is the differentiator, per D14 — and it is the only claim
        here that would survive being checked.
      */}
      <section className="border-b border-zinc-200 px-6 py-16 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            What we will not tell you
          </h2>
          <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <p>
              We will not promise this resume &ldquo;beats the bots&rdquo; or is &ldquo;guaranteed
              to pass ATS&rdquo;. Nobody can promise that. Applicant tracking systems differ from
              each other, are configured differently by every employer, and are only one step before
              a human decides.
            </p>
            <p>
              What we can say is narrower and true: a single-column layout with real text, standard
              section headings, and no images is the most reliably readable structure across the
              widest range of parsers. That is what this tool produces, and it is the only kind of
              claim we will make.
            </p>
            <p className="text-zinc-500 dark:text-zinc-500">
              The filename convention we use is for the recruiter&rsquo;s downloads folder, not
              because an ATS searches on it.
            </p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <p>Built to be honest about what a resume can and cannot do.</p>
          <nav className="flex gap-4">
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Terms
            </Link>
            <Link
              href="/builder"
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Start building
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
