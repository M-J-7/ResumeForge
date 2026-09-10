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
import { countCoverLettersByResume } from "@/server/cover-letters";
import { ClaimDraftPrompt } from "@/components/dashboard/ClaimDraftPrompt";
import { DeleteAccount } from "@/components/dashboard/DeleteAccount";
import { ResumeList, type ResumeRow } from "@/components/dashboard/ResumeList";
import { NewResumeButton } from "@/components/dashboard/NewResumeButton";
import { ChevronDownIcon } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Your resumes",
  description: "Resumes saved to your account.",
};

/** Reads the session and the database; there is nothing here to prerender. */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const [resumes, letterCounts] = await Promise.all([
    listResumes(user.id),
    // One grouped count for the whole page, rather than a query per card.
    countCoverLettersByResume(user.id),
  ]);

  // Dates are serialized at the boundary rather than passed as `Date`
  // objects, so the row shape is the same on both sides of it.
  const rows: ResumeRow[] = resumes.map((resume) => ({
    id: resume.id,
    title: resume.title,
    wordCount: resume.wordCount,
    pageCount: resume.pageCount,
    lastScore: resume.lastScore,
    updatedAt: resume.updatedAt.toISOString(),
    coverLetterCount: letterCounts.get(resume.id) ?? 0,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
      {/*
        Sign-out lives in `AppHeader` now, on every page rather than only this
        one. Keeping a second copy here would be two controls doing one thing —
        and it broke `auth.spec.ts`, which reasonably assumes there is exactly
        one button named "Sign out" on the page.
      */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-text text-2xl font-semibold">Your resumes</h1>
          <p className="text-muted mt-1 text-sm">Signed in as {user.email}</p>
        </div>
        {/*
          Both links stay, deliberately. "Open the builder" is the one
          `e2e/auth.spec.ts` already relies on existing — its own comment
          notes it's why the "Open" links on resume cards need `exact: true`
          to avoid a substring collision with this one. "New resume" is the
          new, separate action: it always starts a blank resume, where this
          one opens whatever the guest draft holds.
        */}
        <div className="flex items-center gap-2">
          <Link
            href="/builder"
            className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Open the builder
          </Link>
          <NewResumeButton />
        </div>
      </header>

      <ClaimDraftPrompt />

      <ResumeList resumes={rows} />

      {/*
        Account controls, grouped under one disclosure rather than given equal
        visual weight to the resume list above them.
        Open by default, deliberately: `e2e/auth.spec.ts`'s account-deletion
        test clicks "Delete my account" directly, with no step that opens a
        collapsed `<details>` first, and a closed one keeps its content out
        of the accessibility tree until expanded — so a real disclosure would
        make that button unreachable and fail the test. `open` keeps the
        content visible on load while still leaving the collapse control
        there for anyone who wants a tidier page.
      */}
      <details open className="border-line group rounded-lg border">
        <summary className="text-text focus-visible:ring-accent flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-semibold select-none focus-visible:ring-2 focus-visible:outline-none">
          Account
          <ChevronDownIcon className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="border-line flex flex-col gap-6 border-t px-4 py-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-text text-sm font-semibold">Take your data with you</h2>
            <p className="text-muted text-sm">
              Every resume on this account, in the open{" "}
              <a
                href="https://jsonresume.org"
                className="text-accent underline underline-offset-2"
                rel="noreferrer noopener"
                target="_blank"
              >
                JSON Resume
              </a>{" "}
              format — the whole content, not a summary of it. Other tools read it, and so does
              the import button in the builder.
            </p>
            <p>
              <a
                href="/api/account/export"
                download
                className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Download everything
              </a>
            </p>
          </section>

          <DeleteAccount email={user.email} resumeCount={rows.length} />
        </div>
      </details>
    </main>
  );
}
