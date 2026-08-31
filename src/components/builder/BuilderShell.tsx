"use client";

import { useEffect, useMemo, useState } from "react";
import { STEPS, DEFAULT_STEP_ID } from "./steps-config";
import { StepNav } from "./StepNav";
import { SectionManager } from "./SectionManager";
import { IssuesPanel } from "./IssuesPanel";
import { CommandPalette, useCommandPalette, type Command } from "./CommandPalette";
import { ContactStep } from "./steps/ContactStep";
import { SummaryStep } from "./steps/SummaryStep";
import { ExperienceStep } from "./steps/ExperienceStep";
import { EducationStep } from "./steps/EducationStep";
import { SkillsStep } from "./steps/SkillsStep";
import { ProjectsStep } from "./steps/ProjectsStep";
import { CertificationsStep } from "./steps/CertificationsStep";
import { CustomStep } from "./steps/CustomStep";
import { Button } from "@/components/ui/control";
import { PreviewPane } from "@/components/preview/PreviewPane";
import { ImportJsonResume } from "./ImportJsonResume";
import { SyncStatus } from "./SyncStatus";
import { cn } from "@/lib/utils";
import { configureRemoteSync, installAutosaveFlush, useResumeStore } from "@/store/resume";
import { createDraftStore, idbBackend } from "@/store/persistence";
import { safeMigrate } from "@/lib/resume/migrate";

const STEP_COMPONENTS: Record<string, () => React.JSX.Element | null> = {
  contact: ContactStep,
  summary: SummaryStep,
  experience: ExperienceStep,
  education: EducationStep,
  skills: SkillsStep,
  projects: ProjectsStep,
  certifications: CertificationsStep,
  custom: CustomStep,
};

/**
 * Desktop shows the editor and preview side by side; a phone has no room for
 * both, so it tabs between them (M0-T9). The preview stays mounted either
 * way — unmounting it would throw away the rendered PDF and make every tab
 * switch pay for a fresh render.
 */
type MobileView = "edit" | "preview";

/** A resume opened from the signed-in account, if there is one (M2-T4). */
export interface RemoteResume {
  id: string;
  title: string;
  /** The server's copy, serialized. */
  document: string;
}

export function BuilderShell({ remote }: { remote?: RemoteResume }) {
  const [activeStep, setActiveStep] = useState(DEFAULT_STEP_ID);
  const [mobileView, setMobileView] = useState<MobileView>("edit");
  const { open, setOpen } = useCommandPalette();

  const hydrate = useResumeStore((s) => s.hydrate);
  const hydrated = useResumeStore((s) => s.hydrated);
  const loadError = useResumeStore((s) => s.loadError);
  const canUndo = useResumeStore((s) => s.history.past.length > 0);
  const canRedo = useResumeStore((s) => s.history.future.length > 0);
  const undo = useResumeStore((s) => s.undo);
  const redo = useResumeStore((s) => s.redo);
  const clearAll = useResumeStore((s) => s.clearAll);
  // Remounting the step on an external change (undo, redo, rehydrate) is what
  // re-syncs uncontrolled inputs without touching the caret mid-keystroke.
  const externalRevision = useResumeStore((s) => s.externalRevision);

  const attachRemote = useResumeStore((s) => s.attachRemote);

  useEffect(() => {
    const teardown = installAutosaveFlush();

    if (!remote) {
      configureRemoteSync(null);
      void hydrate();
      return teardown;
    }

    void (async () => {
      // Imported here rather than at the top of the file so a guest session
      // never loads it. It reaches a Server Action, and through it the whole
      // `next-auth` tree — which a signed-out visitor has no use for, and
      // which cannot be resolved under the jsdom component tests at all.
      const { createServerSyncTarget } = await import("./serverSync");
      configureRemoteSync(createServerSyncTarget());

      // The local draft is consulted *before* the server copy is adopted.
      // If this browser holds edits that never reached the account — made
      // offline, or with the tab closed mid-push — they are newer than what
      // the server has, and overwriting them with a stale server copy would
      // be the one unrecoverable outcome in the whole sync design.
      const draft = await createDraftStore(idbBackend).read();
      const unsyncedLocal =
        draft?.remoteId === remote.id && draft.pendingSync === true
          ? safeMigrate(draft.document)
          : null;

      if (unsyncedLocal?.ok) {
        attachRemote({ id: remote.id, document: unsyncedLocal.document, unsynced: true });
        return;
      }

      const server = safeMigrate(JSON.parse(remote.document));
      if (server.ok) attachRemote({ id: remote.id, document: server.document });
      else void hydrate();
    })();

    return teardown;
  }, [hydrate, attachRemote, remote]);

  // Undo/redo shortcuts. Registered on the window so they work wherever
  // focus happens to be, which is the point of a document-level action.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const extraCommands = useMemo<Command[]>(
    () => [
      { id: "undo", label: "Undo", hint: "Ctrl/Cmd + Z", run: undo },
      { id: "redo", label: "Redo", hint: "Ctrl/Cmd + Shift + Z", run: redo },
    ],
    [undo, redo],
  );

  const step = STEPS.find((s) => s.id === activeStep) ?? STEPS[0]!;
  const StepComponent = STEP_COMPONENTS[step.id] ?? ContactStep;

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your draft…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      {/* Mobile-only switch between editing and previewing. */}
      <div
        role="tablist"
        aria-label="Editor or preview"
        className="flex gap-1 border-b border-zinc-200 px-4 py-2 xl:hidden dark:border-zinc-800"
      >
        {(["edit", "preview"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => setMobileView(view)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              mobileView === view
                ? "bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {view === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 lg:flex-row lg:px-6",
          mobileView === "preview" && "hidden xl:flex",
        )}
      >
        <aside className="flex shrink-0 flex-col gap-6 lg:w-60">
          <StepNav activeStep={activeStep} onSelect={setActiveStep} />
          <IssuesPanel onNavigate={setActiveStep} />
          <div className="hidden lg:block">
            <SectionManager />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {loadError ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              Your saved draft could not be opened: {loadError} Starting a new one — nothing has
              been overwritten yet.
            </div>
          ) : null}

          <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {step.label}
              </h1>
              <p className="mt-1 max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
                {step.description}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
                Undo
              </Button>
              <Button variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
                Redo
              </Button>
            </div>
          </header>

          <StepComponent key={`${step.id}-${externalRevision}`} />

          <div className="mt-8 border-t border-zinc-200 pt-6 lg:hidden dark:border-zinc-800">
            <SectionManager />
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <SyncStatus />{" "}
              <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-700">Ctrl</kbd>
              {" + "}
              <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-700">K</kbd> to
              jump sections.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ImportJsonResume />
              <ClearAllButton onConfirm={clearAll} />
            </div>
          </footer>
        </main>
      </div>

      <PreviewPane
        className={cn(
          "min-h-0 flex-1 border-zinc-200 xl:max-w-2xl xl:border-l dark:border-zinc-800",
          mobileView === "edit" && "hidden xl:flex",
        )}
      />

      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onSelectStep={setActiveStep}
        extraCommands={extraCommands}
      />
    </div>
  );
}

/**
 * Clearing is the one genuinely irreversible action here — it empties
 * IndexedDB, so undo cannot bring it back. Hence a real confirm step rather
 * than the optimistic one used for removing an entry.
 */
function ClearAllButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Clear all data
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">
        Delete this draft permanently?
      </span>
      <Button
        variant="danger"
        onClick={async () => {
          await onConfirm();
          setConfirming(false);
        }}
      >
        Delete
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
