"use client";

/**
 * The Match tab (P27-H2).
 *
 * Sits beside Preview and X-Ray in `PreviewPane`. Three states:
 *
 *   - **Empty** — saved postings, if any, plus a paste box and Analyse.
 *   - **Running** — the skill vocabulary is ~1.2 MB and loads on first use,
 *     so the first analysis in a session has a real wait to report.
 *   - **Done** — `MatchReport`, with the posting still editable above it.
 *
 * ## Nothing scores while you type
 *
 * D12. `useMatchAnalysis` is imperative and this is the only thing that calls
 * it. A resume edited after an analysis leaves the previous result on screen,
 * stamped with the posting it was run against — a stale number that says what
 * it is beats a live number that trains the wrong behaviour.
 *
 * ## Where a pasted posting goes
 *
 * Nowhere, until the user presses Save. Then: the account for a signed-in
 * user, IndexedDB for a guest, chosen once when the store is constructed
 * (D6). The panel itself never learns which it got.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui/control";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { TargetIcon, TrashIcon } from "@/components/ui/icons";
import { MatchReport } from "./MatchReport";
import { useMatchAnalysis } from "./useMatchAnalysis";
import { withLocalLoad, type RemoteJobTargetStore } from "./jobTargetStore";
import { createLocalJobTargetStore } from "@/store/job-targets";
import { suggestJobTargetTitle, type JobTargetRecord } from "@/lib/match/job-target";
import { useResumeStore } from "@/store/resume";

export function MatchPanel({
  active,
  signedIn,
  onNavigateToStep,
}: {
  /** Rendered but hidden when false; the panel does no work until it is shown. */
  active: boolean;
  signedIn: boolean;
  onNavigateToStep?: (stepId: string) => void;
}) {
  const resume = useResumeStore((s) => s.history.present);
  const { state, analyse, reset } = useMatchAnalysis();

  const [store, setStore] = useState<RemoteJobTargetStore | null>(null);
  const [saved, setSaved] = useState<JobTargetRecord[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The signed-in store is imported dynamically, because importing a Server
   * Action pulls the whole `next-auth` tree in behind it — a cost a guest
   * should never pay, and one the jsdom component tests cannot resolve at
   * all. Same reasoning as `builder/serverSync.ts`.
   */
  useEffect(() => {
    if (!active || store) return;
    let cancelled = false;

    void (async () => {
      if (!signedIn) {
        if (!cancelled) setStore(withLocalLoad(createLocalJobTargetStore()));
        return;
      }
      const { createServerJobTargetStore } = await import("./serverJobTargets");
      if (!cancelled) setStore(createServerJobTargetStore());
    })();

    return () => {
      cancelled = true;
    };
  }, [active, signedIn, store]);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    void store
      .list()
      .then((records) => {
        if (!cancelled) setSaved(records);
      })
      .catch(() => {
        // A failed list is not a reason to block pasting a new posting.
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const suggestedTitle = useMemo(
    () => suggestJobTargetTitle(company, roleTitle),
    [company, roleTitle],
  );

  const openSaved = useCallback(
    async (id: string) => {
      if (!store) return;
      setError(null);
      const record = await store.load(id);
      if (!record) {
        setError("That saved posting could not be opened.");
        return;
      }
      setSavedId(record.id);
      setTitle(record.title);
      setCompany(record.company ?? "");
      setRoleTitle(record.roleTitle ?? "");
      setDescription(record.description);
      reset();
    },
    [store, reset],
  );

  const runAnalysis = useCallback(() => {
    if (!description.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setError(null);
    void analyse(resume, description);
  }, [analyse, description, resume]);

  const savePosting = useCallback(async () => {
    if (!store || !description.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        title: title.trim() || suggestedTitle,
        company,
        roleTitle,
        description,
      };
      const record = savedId ? await store.save(savedId, input) : await store.create(input);
      if (!record) {
        setError("That posting no longer exists.");
        return;
      }
      setSavedId(record.id);
      setTitle(record.title);
      setSaved(await store.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [store, description, title, suggestedTitle, company, roleTitle, savedId]);

  /**
   * Save the posting, then go and write the letter (§10.2, 2.5).
   *
   * The cover-letter call to action used to render only once `savedId` was
   * set, so somebody who pasted a posting and pressed Analyse — the obvious
   * path, and the one the empty state invites — never saw that the feature
   * existed at all. It is always rendered now, and does the save itself.
   *
   * `window.location.assign` rather than `useRouter`: this component is
   * mounted in jsdom by `BuilderShell.test.tsx`, where there is no app router
   * to find, and that is the same reason the href below is a plain anchor.
   */
  const saveAndWriteLetter = useCallback(async () => {
    if (!store || !description.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = {
        title: title.trim() || suggestedTitle,
        company,
        roleTitle,
        description,
      };
      const record = savedId ? await store.save(savedId, input) : await store.create(input);
      if (!record) {
        setError("That posting no longer exists.");
        return;
      }
      setSavedId(record.id);
      /*
       * `useRouter().push` is what this rule wants, and it is the one thing
       * this component cannot have: `BuilderShell.test.tsx` renders the Match
       * tab in jsdom, where there is no app-router context to find, and the
       * existing "Write a cover letter" link is a plain anchor for the same
       * reason. The letter editor is a different route with its own layout
       * and its own data, so a full navigation costs nothing here.
       */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/letters/new?job=${encodeURIComponent(record.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }, [store, description, title, suggestedTitle, company, roleTitle, savedId]);

  const removeSaved = useCallback(
    async (id: string) => {
      if (!store) return;
      await store.remove(id);
      if (savedId === id) setSavedId(null);
      setSaved(await store.list());
    },
    [store, savedId],
  );

  const startOver = useCallback(() => {
    setSavedId(null);
    setDescription("");
    setTitle("");
    setCompany("");
    setRoleTitle("");
    setError(null);
    reset();
  }, [reset]);

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {saved.length > 0 ? (
          <section aria-labelledby="match-saved">
            <h3
              id="match-saved"
              className="text-muted text-xs font-semibold tracking-wide uppercase"
            >
              Saved postings
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {saved.map((record) => (
                <li key={record.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => void openSaved(record.id)}
                    aria-current={savedId === record.id ? "true" : undefined}
                    className={
                      "border-line bg-surface-1 hover:bg-surface-2 focus-visible:ring-accent rounded-l-md border py-1.5 pr-2 pl-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none " +
                      (savedId === record.id ? "text-accent" : "text-text")
                    }
                  >
                    {record.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSaved(record.id)}
                    aria-label={`Delete ${record.title}`}
                    className="border-line bg-surface-1 text-muted hover:text-danger focus-visible:ring-accent rounded-r-md border border-l-0 px-2 py-1.5 transition focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="match-posting" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="match-posting" className="text-text text-sm font-semibold">
              The posting
            </h3>
            {savedId ? <Badge tone="ok">Saved</Badge> : null}
          </div>

          <Field
            label="Job description"
            hint="Paste the whole posting. The requirements section is what carries the weight."
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={description ? 8 : 10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the job description here…"
              />
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company">
              {({ id }) => (
                <Input id={id} value={company} onChange={(e) => setCompany(e.target.value)} />
              )}
            </Field>
            <Field label="Role title">
              {({ id }) => (
                <Input id={id} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              )}
            </Field>
          </div>

          <Field
            label="Save this posting as"
            hint="Your own name for it. Nothing is derived silently — this is what you will see in the list."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                value={title}
                placeholder={suggestedTitle}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={runAnalysis} disabled={state.status === "running"}>
              {state.status === "running" ? "Analysing…" : "Analyse"}
            </Button>
            <Button onClick={() => void savePosting()} disabled={busy || !description.trim()}>
              {busy ? "Saving…" : savedId ? "Update saved posting" : "Save this posting"}
            </Button>
            {description || state.status !== "idle" ? (
              <Button variant="ghost" onClick={startOver}>
                Start over
              </Button>
            ) : null}
          </div>

          <p className="text-muted text-xs">
            {signedIn
              ? "Saved postings are stored on your account. Nothing is analysed until you press Analyse."
              : "You are not signed in, so saved postings stay in this browser and are never uploaded. Nothing is analysed until you press Analyse."}
          </p>

          {error ? (
            <p role="alert" className="text-danger text-xs font-medium">
              {error}
            </p>
          ) : null}
        </section>

        {state.status === "error" ? (
          <div
            role="alert"
            className="border-danger/30 bg-danger-weak text-danger rounded-lg border p-4 text-sm"
          >
            The analysis failed: {state.message}
          </div>
        ) : null}

        {state.status === "done" ? (
          <MatchReport
            result={state.analysis.result}
            onNavigateToStep={onNavigateToStep}
            /*
             * A plain href rather than a router push. The letter editor is a
             * different route with its own three-column layout and its own
             * data, so there is nothing to preserve across the transition —
             * and `useRouter` would put an app-router context requirement on
             * a component `BuilderShell.test.tsx` renders in jsdom, where
             * there is no router to find.
             */
            coverLetterHref={
              savedId ? `/letters/new?job=${encodeURIComponent(savedId)}` : undefined
            }
            /* Always offered, saving first when it has to. See above. */
            onSaveAndWriteLetter={() => void saveAndWriteLetter()}
            savingLetterPosting={busy}
          />
        ) : null}

        {state.status === "idle" && saved.length === 0 && !description ? (
          <EmptyState
            icon={<TargetIcon className="h-6 w-6" aria-hidden="true" />}
            title="See what a posting is actually asking for"
            body="Paste a job description and this will tell you which of its requirements your resume demonstrates, which it only lists, and which it misses — with the exact text behind every one."
          />
        ) : null}
      </div>
    </div>
  );
}
