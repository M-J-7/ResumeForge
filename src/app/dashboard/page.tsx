/**
 * The dashboard (M2-T3, M2-T4).
 *
 * Lists what the account holds and offers to adopt whatever the browser is
 * still holding on its own. The claim prompt is a client component because
 * only the browser can see IndexedDB; everything else is rendered on the
 * server from one indexed query.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionUser } from "@/server/auth/session";
import { listResumes } from "@/server/resumes";
import { ClaimDraftPrompt } from "@/components/dashboard/ClaimDraftPrompt";
import { DeleteAccount } from "@/components/dashboard/DeleteAccount";
import { ResumeList, type ResumeRow } from "@/components/dashboard/ResumeList";
import { signOutAction } from "@/app/signin/actions";

export const metadata: Metadata = {
  title: "Your resumes — ATS Resume Builder",
  description: "Resumes saved to your account.",
};

/** Reads the session and the database; there is nothing here to prerender. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const resumes = await listResumes(user.id);

  // Dates are serialized at the boundary rather than passed as `Date`
  // objects, so the row shape is the same on both sides of it.
  const rows: ResumeRow[] = resumes.map((resume) => ({
    id: resume.id,
    title: resume.title,
    wordCount: resume.wordCount,
    pageCount: resume.pageCount,
    lastScore: resume.lastScore,
    updatedAt: resume.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your resumes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Signed in as {user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/builder"
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            Open the builder
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <ClaimDraftPrompt />

      <ResumeList resumes={rows} />

      <DeleteAccount email={user.email} resumeCount={rows.length} />
    </main>
  );
}
