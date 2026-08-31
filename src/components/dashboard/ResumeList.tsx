"use client";

/**
 * The resume list (M2-T4): rename, duplicate, delete.
 *
 * Deletes are hard deletes with no trash, which the confirmation says
 * outright rather than softening. A product whose whole position is "we do
 * not hold your work hostage" cannot then keep a copy of something the user
 * asked to be rid of; the honest consequence is that the button needs to
 * mean it, and the user needs to be told before they press it.
 *
 * `pageCount` is often null and stays null. It is measured from the rendered
 * PDF (D3) and the server does not render, so a resume only acquires one
 * after the builder has previewed it. The column shows "—" rather than a
 * guess, because a predicted page count that disagreed with the download
 * would undermine the one number this product is supposed to get right.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/control";
import {
  deleteResumeAction,
  duplicateResumeAction,
  renameResumeAction,
} from "@/app/dashboard/actions";

/** Serializable mirror of `ResumeSummary` — dates cross as ISO strings. */
export interface ResumeRow {
  id: string;
  title: string;
  wordCount: number | null;
  pageCount: number | null;
  lastScore: number | null;
  updatedAt: string;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

export function ResumeList({ resumes }: { resumes: ResumeRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (work: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "That did not work. Try again.");
        return;
      }
      setRenaming(null);
      setConfirming(null);
      router.refresh();
    });
  };

  if (resumes.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No resumes saved to this account yet. Anything you build stays in your browser until you
        save it here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {resumes.map((resume) => (
          <li
            key={resume.id}
            className="flex flex-col gap-3 rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            {renaming === resume.id ? (
              <form
                className="flex flex-wrap items-end gap-2"
                action={(formData) =>
                  run(() => renameResumeAction(resume.id, String(formData.get("title") ?? "")))
                }
              >
                <label className="flex-1">
                  <span className="sr-only">New title for {resume.title}</span>
                  <Input name="title" defaultValue={resume.title} autoFocus maxLength={120} />
                </label>
                <Button type="submit" variant="primary" disabled={pending}>
                  Save
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setRenaming(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {resume.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Updated {formatUpdated(resume.updatedAt)}
                </p>
              </div>
            )}

            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex gap-1">
                <dt>Words</dt>
                <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                  {resume.wordCount ?? "—"}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Pages</dt>
                <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                  {resume.pageCount ?? "—"}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Last match score</dt>
                <dd className="font-medium text-zinc-700 dark:text-zinc-300">
                  {resume.lastScore ?? "—"}
                </dd>
              </div>
            </dl>

            {confirming === resume.id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 dark:bg-red-950">
                <p className="flex-1 text-sm text-red-900 dark:text-red-200">
                  Delete <strong className="font-medium">{resume.title}</strong> permanently? There
                  is no trash and no backup copy we can restore for you.
                </p>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => deleteResumeAction(resume.id))}
                >
                  Delete permanently
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/builder?resume=${encodeURIComponent(resume.id)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  Open
                </Link>
                <Button disabled={pending} onClick={() => setRenaming(resume.id)}>
                  Rename
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => run(() => duplicateResumeAction(resume.id))}
                >
                  Duplicate
                </Button>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => setConfirming(resume.id)}
                >
                  Delete
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
