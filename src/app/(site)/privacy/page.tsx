/**
 * Privacy policy (§9: live before launch, not after).
 *
 * Written to be accurate rather than defensive; a policy that overstates
 * what is collected "to be safe" is as misleading as one that understates
 * it.
 *
 * Revised for M2, which added optional accounts. The previous version said
 * there was "no account system and no database", and it promised this page
 * would be updated before that changed — so this revision is part of
 * shipping accounts, not a follow-up to it. Signing in is still optional and
 * the guest path is unchanged; what changed is that there is now a second
 * path, and it has to be described as precisely as the first.
 */

import type { Metadata } from "next";
import { AppFooter } from "@/components/shell/AppFooter";
import { Built } from "@/components/marketing/Build";
import { PageHeader, PAGE_TITLE_CLASS } from "@/components/marketing/PageHeader";
import { pageMetadata } from "@/lib/seo";
import { ACTION_DESCRIPTIONS, ACTION_EVENTS } from "@/lib/events";

/*
 * These two were fixed by hand once, for `alternates` only — the comment that
 * used to sit here described the canonical half of the bug and missed the
 * `openGraph` half, which had exactly the same cause and was live on every
 * route. `pageMetadata` sets both from one call and `seo.test.ts` fails the
 * build for any page that sets neither. See `lib/seo.ts`.
 */
export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "What this app stores, where it stores it, and what it never collects. " +
    "Without an account, your resume never leaves your browser.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      {/* The shared band rather than a heading and a date in a div.
          These were the last two routes still opening with their own. */}
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
        <PageHeader stage containerClassName="max-w-2xl">
          <Built>
            <h1 className={PAGE_TITLE_CLASS}>Privacy</h1>
          </Built>
          <Built className="mt-4">
            {/* Mono: this is a fact about the document, not a sentence in
                it. The same rule the guides' reading time follows. */}
            <p className="text-faint text-micro font-mono">Last updated 30 September 2026.</p>
          </Built>
        </PageHeader>

        <div className="py-band-tight mx-auto flex w-full max-w-2xl flex-col gap-6 px-6">
          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">
              Without an account, your resume stays in your browser
            </h2>
            <p>
              The builder works without signing in, and that is the default. Everything you type is
              saved to IndexedDB, a storage area belonging to this site inside your own browser. It
              is not transmitted to us. Clearing your browser data, or using the &ldquo;Clear all
              data&rdquo; button in the builder, deletes it permanently.
            </p>
            <p>
              The practical consequence: we cannot recover your resume for you, and we cannot read
              it either. Both follow from the same design.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">If you create an account</h2>
            <p>
              An account exists for one reason: so your resumes follow you between devices. Creating
              one is optional, and nothing you build is sent to us until you explicitly save it.
            </p>
            <p>
              Signing in stores your email address. If you sign in with Google we also store the
              name Google gives us; we do not ask Google for anything else, and we do not store your
              profile picture. Saving a resume stores its content, its title, and when it changed.
            </p>
            <p>
              <strong className="font-medium">There is no password.</strong> You sign in with a link
              emailed to you, or with Google. We never hold a password, so there is none to leak,
              reuse, or reset. Sending that link is the only time your email address is handed to
              another company — a transactional email provider — and the message contains a login
              link and nothing else. No part of your resume is ever included.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">
              Your files are generated on your device
            </h2>
            <p>
              The PDF, DOCX, and text files are built in your browser and handed straight to your
              downloads. They are never uploaded, never generated on a server, and never stored by
              us — with or without an account.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">
              Optional local AI, no third-party analytics
            </h2>
            <p>
              If you choose Enhance in the cover-letter editor, a small model is downloaded once and
              runs in your browser. The selected paragraph and resume evidence stay on your device:
              they are not sent to us, to a language-model API, or to the model host, and they are
              never used for training. The model host receives an ordinary request for its public
              model files, like any other file download.
            </p>
            <p>
              Enhance is optional, proposes wording for you to review, and is free. There are no
              third-party analytics or advertising scripts on the builder.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Server logs</h2>
            <p>
              Serving the site produces ordinary web-server logs — IP address, timestamp, and which
              page was requested. These record that a page was fetched. They never contain resume
              content: error reports are scrubbed of it, and without an account none of it reaches
              the server at all.
            </p>
          </section>

          {/*
            The usage counter, described from the code rather than about it:
            the list below is rendered from `ACTION_DESCRIPTIONS`, which the
            compiler will not let fall behind the list of events, and
            `event-count-table.test.ts` holds the table to the three columns
            this section says it has.
          */}
          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">What we count, and what we do not</h2>
            <p>
              This site keeps a tally of how often each of its pages is viewed and each of its tools
              is used, so we can tell which pages help people and which do not. It is a count and
              nothing more: for each thing below, one number per day. The table it is kept in has a
              column for the name of the thing, one for the day and one for the number, and no
              column where a person, a device, an address or a word of your resume could go.
            </p>
            <p>
              <strong className="font-medium">No cookie, no identifier, no IP address.</strong> The
              count is sent to this site and nowhere else, without the cookie a signed-in visitor
              has — the server refuses one that arrives with a cookie — so it cannot be tied to an
              account. Nothing you type is ever part of it. Crawlers are not counted, and if your
              browser sends Global Privacy Control or Do Not Track, nothing is sent at all.
            </p>
            <p>What is counted:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>which page on this site was viewed;</li>
              <li>
                where a visit came from, as one name from a short list — a search engine, a social
                site, &ldquo;other&rdquo; or &ldquo;direct&rdquo; — and never the page it came from;
              </li>
              {ACTION_EVENTS.map((name) => (
                <li key={name}>that {ACTION_DESCRIPTIONS[name]};</li>
              ))}
            </ul>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">Your rights</h2>
            <p>
              Without an account we hold no personal data about you at all, so there is nothing for
              us to export, correct, or erase — your data is on your device, and the builder can
              delete it.
            </p>
            <p>
              With an account, deletion is in your hands and takes effect immediately. Deleting a
              resume removes it and its history outright; deleting your account removes the account,
              every resume on it, and everything derived from them. There is no trash, no grace
              period, and no backup copy we could restore from, which is the same trade as the guest
              path: we cannot undo it for you because we did not keep it.
            </p>
            <p>
              Export is one click and needs no request: &ldquo;Download everything&rdquo; on your
              dashboard gives you every resume on the account in the open{" "}
              <a
                href="https://jsonresume.org"
                className="text-accent rule-grow rounded-sm"
                rel="noreferrer noopener"
                target="_blank"
              >
                JSON Resume
              </a>{" "}
              format — the full content, not a summary, in a format we did not invent and other
              tools already read. Every resume can also be downloaded as PDF, DOCX, and plain text
              from the builder, for nothing and without limits.
            </p>
          </section>

          <section className="text-muted text-body flex flex-col gap-3 leading-relaxed">
            <h2 className="text-text text-title font-semibold">
              Fields we deliberately do not have
            </h2>
            <p>
              There is no field for a photograph, date of birth, marital status, gender, or
              nationality. These invite discrimination in most hiring markets and are unnecessary in
              nearly all of them, so the app does not collect them at all rather than storing them
              carefully.
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
