/**
 * Terms of use (§9: live before launch).
 *
 * Deliberately short and readable. The substantive points are that the user
 * owns what they write, that the honest-claims position in D14 is stated as
 * a term rather than only as marketing, and that a browser-local tool comes
 * with a data-loss caveat it would be dishonest to bury.
 */

import type { Metadata } from "next";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { pageMetadata } from "@/lib/seo";

/* See `privacy/page.tsx` and `lib/seo.ts` for what this call replaced. */
export const metadata: Metadata = pageMetadata({
  title: "Terms of use",
  // "The terms covering use of this resume builder" described the page's
  // genre and nothing in it. These are the three things a reader actually
  // wants to know before opening a legal page, and they are all true here.
  description:
    "Short, readable terms. You own what you write, we make no claim about any employer's " +
    "hiring software, and a browser-local tool comes with a data-loss caveat we state plainly.",
  path: "/terms",
});

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
    <>
      {/* The shared band rather than a heading and a date in a div.
          These were the last two routes still opening with their own. */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-2xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Terms of use</h1>
          </Built>
          <Built className="mt-4">
            {/* Mono: this is a fact about the document, not a sentence in
                it. The same rule the guides' reading time follows. */}
            <p className="text-faint text-micro font-mono">Last updated 30 August 2026.</p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-2xl flex-col gap-6 px-6">
          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Your work is yours</h2>
            <p>
              You own everything you write here and every file you generate from it. We claim no
              licence over your content, and could not exercise one in any case, since it never
              reaches us.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">
              What this tool does and does not claim
            </h2>
            <p>
              This builder produces a single-column document with real text and standard section
              headings — the structure that is most reliably readable across the widest range of
              applicant tracking systems. That is the whole of the claim.
            </p>
            <p>
              It is not a guarantee that any particular system will parse your resume correctly,
              that you will pass any screen, or that you will receive any interview. Those depend on
              the employer, their configuration, and your experience, none of which this tool
              controls.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Keep your own copy</h2>
            <p>
              Your draft lives in your browser&rsquo;s storage. Clearing site data, using private
              browsing, switching browsers or devices, or a browser reclaiming storage under
              pressure will remove it, and we cannot recover it. Download your resume once you have
              something you would be sorry to lose.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">If you create an account</h2>
            <p>
              An account is optional and free, and exists so your resumes follow you between
              devices. There is no password — you sign in with a link sent to your address, or with
              Google. Keep access to that address; without it we cannot let you back in, because
              there is no other proof that the account is yours.
            </p>
            <p>
              You can delete any resume, or the whole account, at any time from your dashboard.
              Deletion is immediate and permanent: no trash, no grace period, and no backup copy we
              can restore from. Export everything first if you might want it — the button is on the
              same page, and the format is one other tools read.
            </p>
            <p>
              We may close an account that is being used to send sign-in mail to people who did not
              ask for it, or to attack the service. That is the only reason we would, and your
              resumes remain downloadable to you first wherever we are able to reach you.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Fair use</h2>
            <p>
              Use this to build resumes — your own, or one you are helping someone else with. Do not
              use it to misrepresent anyone&rsquo;s history, and do not attempt to disrupt the
              service for other people.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Provided as-is</h2>
            <p>
              This is offered free and without warranty. We are not liable for the outcomes of your
              job search, nor for data lost from your browser&rsquo;s storage, nor for interruptions
              to the service. Backups are taken and tested, but no backup is a promise — keep your
              own copy of anything you would be sorry to lose. That advice is the same with an
              account as without one, and it is honest rather than defensive: it is what we would
              tell a friend.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Fonts</h2>
            <p>
              Generated documents embed open-licensed fonts under the SIL Open Font License. Their
              licences ship alongside them in this project&rsquo;s source.
            </p>
          </section>
        </div>
      </main>

      {/* The footer supersedes the lone "Back to the home page" link this page
          used to end on: these two are linked *from* every footer in the app,
          and a legal page that offers one way out is a dead end for the
          visitor who arrived at it from one. */}
      <AppFooter />
    </>
  );
}
