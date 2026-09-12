"use client";

/**
 * The `/letters` grid (P29-J2).
 *
 * One client component for both audiences. A signed-in user's letters come
 * from the account through Server Actions; a guest's come from IndexedDB and
 * never leave the browser (D6). The grid does not branch on which — it holds
 * a `CoverLetterStore` and the page decided which one that is.
 *
 * `initial` exists only so a signed-in visitor sees their letters in the
 * server-rendered HTML instead of after a round trip. The store is still the
 * authority: every mutation re-lists from it.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui/control";
import { Card, CardBody } from "@/components/ui/card";
import { SpotlightGroup } from "@/components/ui/Spotlight";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { CopyIcon, MailIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { createLocalCoverLetterStore, type CoverLetterStore } from "@/store/cover-letters";
import type { CoverLetterSummaryRecord } from "@/lib/cover-letter/record";

export function LettersBrowser({
  signedIn,
  initial = [],
}: {
  signedIn: boolean;
  /** Server-rendered first paint for a signed-in visitor. */
  initial?: CoverLetterSummaryRecord[];
}) {
  const [store, setStore] = useState<CoverLetterStore | null>(null);
  const [letters, setLetters] = useState<CoverLetterSummaryRecord[]>(initial);
  const [loaded, setLoaded] = useState(signedIn);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedIn) {
        if (!cancelled) setStore(createLocalCoverLetterStore());
        return;
      }
      const { createServerCoverLetterStore } = await import("./serverCoverLetters");
      if (!cancelled) setStore(createServerCoverLetterStore());
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // A guest's list is only knowable in the browser, so the first paint for
  // them is deliberately empty and fills in here.
  useEffect(() => {
    if (!store || signedIn) return;
    let cancelled = false;
    void store
      .list()
      .then((records) => {
        if (!cancelled) {
          setLetters(records);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [store, signedIn]);

  const refresh = useCallback(async () => {
    if (!store) return;
    setLetters(await store.list());
  }, [store]);

  const commitRename = useCallback(
    async (id: string) => {
      if (!store) return;
      const result = await store.rename(id, draftTitle);
      setRenaming(null);
      if (!result) {
        setError("That letter no longer exists.");
        return;
      }
      await refresh();
    },
    [store, draftTitle, refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      if (!store) return;
      await store.duplicate(id);
      await refresh();
    },
    [store, refresh],
  );

  const remove = useCallback(
    async (id: string, title: string) => {
      if (!store) return;
      // Hard delete, no trash and no undo — so it is worth one question.
      if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
      await store.remove(id);
      await refresh();
    },
    [store, refresh],
  );

  if (loaded && letters.length === 0) {
    return (
      <EmptyState
        icon={<MailIcon className="h-6 w-6" aria-hidden="true" />}
        title="No cover letters yet"
        body="A letter here is assembled from sentences already in your resume — never invented, and yours to edit. Start one against a job description you have pasted."
        action={
          <Link
            href="/letters/new"
            className="bg-accent text-on-accent hover:bg-accent-hover focus-visible:ring-accent inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none"
          >
            Write a cover letter
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}

      <SpotlightGroup>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {letters.map((letter) => (
            <li key={letter.id}>
              <Card className="spot lift hover:border-line-strong flex h-full flex-col">
                <CardBody className="flex flex-1 flex-col gap-3">
                  {renaming === letter.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void commitRename(letter.id);
                      }}
                      className="flex flex-col gap-2"
                    >
                      <Input
                        autoFocus
                        aria-label={`New name for ${letter.title}`}
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" type="submit">
                          Save name
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="min-w-0">
                      <h2 className="text-text truncate text-sm font-semibold">{letter.title}</h2>
                      <p className="text-muted mt-1 truncate text-xs">
                        {[letter.company, letter.roleTitle].filter(Boolean).join(" · ") ||
                          "No job description linked"}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {letter.resumeTitle ? (
                      <Badge tone="neutral">From {letter.resumeTitle}</Badge>
                    ) : null}
                    <span className="text-muted text-xs">
                      Updated {new Date(letter.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <Link
                      href={`/letters/${letter.id}`}
                      className="border-line-strong text-text hover:bg-surface-2 focus-visible:ring-accent inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Open
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => {
                        setRenaming(letter.id);
                        setDraftTitle(letter.title);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => void duplicate(letter.id)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:text-danger"
                      icon={<TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => void remove(letter.id, letter.title)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </SpotlightGroup>
    </div>
  );
}
