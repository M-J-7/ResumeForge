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
  title: "Terms",
  description: "The terms covering use of this resume builder.",
};

/**
 * Rendered per request so its metadata reads the runtime environment.
 *
 * `metadataBase` — and with it every canonical and Open Graph URL — comes
 * from the deployment's origin. Prerendering this page would freeze the
 * origin as it was at *build* time, and an image built in CI has no idea
 * what host it will be run on. The symptom is silent: correct-looking pages
 * whose canonical links and social cards all point at `localhost`.
 *
 * The cost is rendering a page of static text per request, which for a
 * single-container deployment with no CDN in front of it is nothing.
 */
export const dynamic = "force-dynamic";

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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          If you create an account
        </h2>
        <p>
          An account is optional and free, and exists so your resumes follow you between devices.
          There is no password — you sign in with a link sent to your address, or with Google. Keep
          access to that address; without it we cannot let you back in, because there is no other
          proof that the account is yours.
        </p>
        <p>
          You can delete any resume, or the whole account, at any time from your dashboard. Deletion
          is immediate and permanent: no trash, no grace period, and no backup copy we can restore
          from. Export everything first if you might want it — the button is on the same page, and
          the format is one other tools read.
        </p>
        <p>
          We may close an account that is being used to send sign-in mail to people who did not ask
          for it, or to attack the service. That is the only reason we would, and your resumes
          remain downloadable to you first wherever we are able to reach you.
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
          search, nor for data lost from your browser&rsquo;s storage, nor for interruptions to the
          service. Backups are taken and tested, but no backup is a promise — keep your own copy of
          anything you would be sorry to lose. That advice is the same with an account as without
          one, and it is honest rather than defensive: it is what we would tell a friend.
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
