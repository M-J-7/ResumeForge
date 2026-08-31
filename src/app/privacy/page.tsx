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
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this app stores, where it stores it, and what it never collects.",
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

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Privacy</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated 31 August 2026.
        </p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Without an account, your resume stays in your browser
        </h2>
        <p>
          The builder works without signing in, and that is the default. Everything you type is
          saved to IndexedDB, a storage area belonging to this site inside your own browser. It is
          not transmitted to us. Clearing your browser data, or using the &ldquo;Clear all
          data&rdquo; button in the builder, deletes it permanently.
        </p>
        <p>
          The practical consequence: we cannot recover your resume for you, and we cannot read it
          either. Both follow from the same design.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          If you create an account
        </h2>
        <p>
          An account exists for one reason: so your resumes follow you between devices. Creating one
          is optional, and nothing you build is sent to us until you explicitly save it.
        </p>
        <p>
          Signing in stores your email address. If you sign in with Google we also store the name
          Google gives us; we do not ask Google for anything else, and we do not store your profile
          picture. Saving a resume stores its content, its title, and when it changed.
        </p>
        <p>
          <strong className="font-medium">There is no password.</strong> You sign in with a link
          emailed to you, or with Google. We never hold a password, so there is none to leak, reuse,
          or reset. Sending that link is the only time your email address is handed to another
          company — a transactional email provider — and the message contains a login link and
          nothing else. No part of your resume is ever included.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Your files are generated on your device
        </h2>
        <p>
          The PDF, DOCX, and text files are built in your browser and handed straight to your
          downloads. They are never uploaded, never generated on a server, and never stored by us —
          with or without an account.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          No AI, no third-party analytics
        </h2>
        <p>
          Your resume is never sent to a language model or any other third-party service, and is
          never used to train anything. There are no third-party analytics or advertising scripts on
          the builder.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Server logs</h2>
        <p>
          Serving the site produces ordinary web-server logs — IP address, timestamp, and which page
          was requested. These record that a page was fetched. They never contain resume content:
          error reports are scrubbed of it, and without an account none of it reaches the server at
          all.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your rights</h2>
        <p>
          Without an account we hold no personal data about you at all, so there is nothing for us
          to export, correct, or erase — your data is on your device, and the builder can delete it.
        </p>
        <p>
          With an account, deletion is in your hands and takes effect immediately. Deleting a resume
          removes it and its history outright; deleting your account removes the account, every
          resume on it, and everything derived from them. There is no trash, no grace period, and no
          backup copy we could restore from, which is the same trade as the guest path: we cannot
          undo it for you because we did not keep it.
        </p>
        <p>
          Export is one click and needs no request: &ldquo;Download everything&rdquo; on your
          dashboard gives you every resume on the account in the open{" "}
          <a
            href="https://jsonresume.org"
            className="underline underline-offset-2"
            rel="noreferrer noopener"
            target="_blank"
          >
            JSON Resume
          </a>{" "}
          format — the full content, not a summary, in a format we did not invent and other tools
          already read. Every resume can also be downloaded as PDF, DOCX, and plain text from the
          builder, for nothing and without limits.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Fields we deliberately do not have
        </h2>
        <p>
          There is no field for a photograph, date of birth, marital status, gender, or nationality.
          These invite discrimination in most hiring markets and are unnecessary in nearly all of
          them, so the app does not collect them at all rather than storing them carefully.
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
