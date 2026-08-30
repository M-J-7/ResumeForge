/**
 * Privacy policy (§9: live before launch, not after).
 *
 * Short because there is genuinely little to disclose in M0 — no server, no
 * account, no analytics on the builder. Written to be accurate rather than
 * defensive; a policy that overstates what is collected "to be safe" is as
 * misleading as one that understates it.
 *
 * When M2 adds accounts and cloud sync, this needs revising.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — ATS Resume Builder",
  description: "What this app stores, where it stores it, and what it never collects.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Privacy</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated 30 August 2026.
        </p>
      </div>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Your resume stays in your browser
        </h2>
        <p>
          Everything you type is saved to IndexedDB, a storage area belonging to this site inside
          your own browser. It is not transmitted to us, because there is no account system and no
          database to transmit it to. Clearing your browser data, or using the &ldquo;Clear all
          data&rdquo; button in the builder, deletes it permanently.
        </p>
        <p>
          The practical consequence: we cannot recover your resume for you, and we cannot read it
          either. Both follow from the same design.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Your files are generated on your device
        </h2>
        <p>
          The PDF, DOCX, and text files are built in your browser and handed straight to your
          downloads. They are never uploaded, never generated on a server, and never stored by us.
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
          was requested. These record that a page was fetched; they do not and cannot contain any
          part of your resume, since none of it is sent to the server.
        </p>
      </section>

      <section className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your rights</h2>
        <p>
          Because we hold no personal data about you, there is nothing for us to export, correct, or
          erase on request. Your data is already entirely under your control: it is on your device,
          and the builder can delete it. If that ever changes — for example when optional accounts
          are added — this page will be updated before the change ships.
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
