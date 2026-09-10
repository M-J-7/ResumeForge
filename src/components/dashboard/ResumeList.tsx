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
 *
 * ## What the redesign changed, and what it could not
 *
 * The list became a card grid with a page-1 thumbnail per resume (P22-E4).
 * The structure underneath did not: this is still a `<ul>` of `<li>`s, each
 * title is still a heading, and every button and link keeps its exact
 * accessible name — `e2e/auth.spec.ts` matches all of that directly, down to
 * `getByRole("listitem").filter({ hasText: … })` and `getByRole("link", {
 * name: "Open", exact: true })`.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/control";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { FileTextIcon } from "@/components/ui/icons";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { ResumeThumbnail } from "./ResumeThumbnail";
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
  /** How many cover letters were written from this resume (P29-J3). */
  coverLetterCount: number;
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
      <EmptyState
        icon={<FileTextIcon className="h-8 w-8" />}
        title="No resumes saved to this account yet"
        body="Anything you build stays in your browser until you save it here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}

      {/* One light across the grid, the same as every other card grid in the
          app. `<ul>`/`<li>` is unchanged: `auth.spec.ts` nth-indexes
          `getByRole("listitem")`, and the group is a wrapper around the list
          rather than the list itself. */}
      <SpotlightGroup>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className="border-line bg-surface-0 spot lift hover:border-line-strong flex flex-col gap-3 rounded-lg border p-3"
            >
              <ResumeThumbnail resumeId={resume.id} updatedAt={resume.updatedAt} />

              {renaming === resume.id ? (
                <form
                  className="flex flex-col gap-2"
                  action={(formData) =>
                    run(() => renameResumeAction(resume.id, String(formData.get("title") ?? "")))
                  }
                >
                  <label>
                    <span className="sr-only">New title for {resume.title}</span>
                    <Input name="title" defaultValue={resume.title} autoFocus maxLength={120} />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" size="sm" disabled={pending}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setRenaming(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <h3 className="text-text truncate text-sm font-semibold">{resume.title}</h3>
                  <p className="text-muted text-xs">Updated {formatUpdated(resume.updatedAt)}</p>
                </div>
              )}

              <dl className="flex flex-wrap gap-1.5">
                <Badge tone="neutral">{resume.wordCount ?? "—"} words</Badge>
                <Badge tone="neutral">{resume.pageCount ?? "—"} pages</Badge>
                {resume.lastScore !== null ? (
                  <Badge tone="accent">Match {resume.lastScore}</Badge>
                ) : null}
                {/*
                A cross-link rather than a count for its own sake: someone
                who has written three letters from a resume is applying with
                it, and the letters are the thing they are most likely to
                come back for.
              */}
                {resume.coverLetterCount > 0 ? (
                  <Link
                    href="/letters"
                    className="focus-visible:ring-accent rounded-full focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Badge tone="neutral" className="hover:border-accent/40 hover:text-accent">
                      {resume.coverLetterCount} cover letter
                      {resume.coverLetterCount === 1 ? "" : "s"}
                    </Badge>
                  </Link>
                ) : null}
              </dl>

              {confirming === resume.id ? (
                <div className="bg-danger-weak flex flex-col gap-2 rounded-md px-3 py-2">
                  <p className="text-danger text-sm">
                    Delete <strong className="font-medium">{resume.title}</strong> permanently?
                    There is no trash and no backup copy we can restore for you.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => deleteResumeAction(resume.id))}
                    >
                      Delete permanently
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/builder?resume=${encodeURIComponent(resume.id)}`}
                    className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Open
                  </Link>
                  <Button size="sm" disabled={pending} onClick={() => setRenaming(resume.id)}>
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => duplicateResumeAction(resume.id))}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
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
      </SpotlightGroup>
    </div>
  );
}
