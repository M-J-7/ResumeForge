/**
 * Saved cover letters (P29-J2).
 *
 * Open to everyone, signed in or not — a guest's letters live in IndexedDB
 * and this page reads them from the browser (D6). That is the same shape as
 * the builder: an account is where your work is *kept*, never the price of
 * doing the work.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { listCoverLetters } from "@/server/cover-letters";
import { LettersBrowser } from "@/components/letters/LettersBrowser";
import { AppFooter } from "@/components/shell/AppFooter";

export const metadata: Metadata = {
  title: "Cover letters",
  description:
    "Cover letters assembled from your own resume — no invented sentences, and yours to edit.",
};

/** Reads the session and possibly the database; nothing here is prerenderable. */
export const dynamic = "force-dynamic";

export default async function LettersPage() {
  const user = await getSessionUser();
  const letters = user ? await listCoverLetters(user.id) : [];

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-text text-2xl font-semibold">Cover letters</h1>
            <p className="text-muted mt-1 max-w-2xl text-sm">
              {user
                ? "Each one is assembled from sentences already in your resume. Nothing is written for you, and every paragraph is yours to edit."
                : "You are not signed in, so these stay in this browser and are never uploaded. Each one is assembled from sentences already in your resume."}
            </p>
          </div>
          <Link
            href="/letters/new"
            className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
          >
            Write a cover letter
          </Link>
        </header>

        <LettersBrowser signedIn={Boolean(user)} initial={letters} />
      </main>
      <AppFooter />
    </>
  );
}
