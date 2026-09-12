"use client";

import { useEffect, useMemo, useState } from "react";
import { STEPS, DEFAULT_STEP_ID } from "./steps-config";
import { StepNav } from "./StepNav";
import { SectionManager } from "./SectionManager";
import { IssuesPanel } from "./IssuesPanel";
import { CommandPalette, useCommandPalette, type Command } from "./CommandPalette";
import { Tab, TabList, Tabs } from "@/components/ui/tabs";
import { RedoIcon, UndoIcon } from "@/components/ui/icons";
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
import { ImportResumeFile } from "./ImportResumeFile";
import { ResumeTitleEditor, SaveAsNewResumeButton } from "./ResumeTitleEditor";
import { SyncStatus } from "./SyncStatus";
import { cn } from "@/lib/utils";
import { configureRemoteSync, installAutosaveFlush, useResumeStore } from "@/store/resume";
import { createDraftStore, idbBackend } from "@/store/persistence";
import { useOwnerKey } from "@/store/useOwnerKey";
import { safeMigrate } from "@/lib/resume/migrate";
import { takeCheckHandoff } from "@/lib/import/handoff";
import { takeTemplateHandoff } from "@/lib/resume/template-handoff";
import { ExperienceLevelPrompt } from "./ExperienceLevelPrompt";
import { ExperienceLevelProvider, useStoredExperienceLevel } from "./useExperienceLevel";
import {
  stepOrderFor,
  writeExperienceLevel,
  EXPERIENCE_LEVEL_OPTIONS,
  type ExperienceLevel,
} from "@/lib/resume/experience-level";
import { getTemplate } from "@/lib/resume/templates";

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

export function BuilderShell({
  remote,
  signedIn = false,
}: {
  remote?: RemoteResume;
  /** Gates "Save as new resume" (P24) — a signed-in visitor can copy any
   *  open document, remote or the local guest draft, into a new resume. */
  signedIn?: boolean;
}) {
  const [activeStep, setActiveStep] = useState(DEFAULT_STEP_ID);
  const [mobileView, setMobileView] = useState<MobileView>("edit");

  /**
   * The experience band (P35).
   *
   * Read straight from storage through `useSyncExternalStore`, so the first
   * client render already has the right step order — an effect that read it
   * afterwards would rearrange the rail under the cursor of someone already
   * reading it.
   *
   * `dismissed` is separate because **skipping is a real answer**: it leaves
   * the default order, and it must not re-prompt on the next paint.
   */
  const level = useStoredExperienceLevel();
  const [dismissed, setDismissed] = useState(false);
  const [levelPromptReopened, setLevelPromptReopened] = useState(false);
  const levelPromptOpen = levelPromptReopened || (level === null && !dismissed);
  const levelAsked = level !== null || dismissed;
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
  const importDocument = useResumeStore((s) => s.importDocument);
  const applyTemplate = useResumeStore((s) => s.applyTemplate);

  /**
   * Whose local storage this is (§10.1).
   *
   * In the dependency list below rather than merely read, and that is the
   * point of it. This effect used to decide what to open from the `remote`
   * prop alone; identity was not part of the decision, so a sign-out that
   * left the builder mounted would keep the previous person's document on
   * screen and keep writing to it. Signing in or out changes this value,
   * the effect re-runs, and the document is re-read from the slot that now
   * belongs to whoever is here.
   */
  const owner = useOwnerKey();

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
  }, [hydrate, attachRemote, remote, owner]);

  /**
   * A resume parsed on `/check` and handed over for editing (P31-A4).
   *
   * Applied after hydration rather than instead of it, and through
   * `importDocument`, so it lands on the history stack: whatever draft was
   * in this browser is one Ctrl+Z away, exactly as it is for a file imported
   * from inside the builder. The handoff is read once and cleared, so a
   * refresh does not re-import over work done since.
   */
  useEffect(() => {
    if (!hydrated) return;
    const handoff = takeCheckHandoff();
    if (handoff === null) return;
    const migrated = safeMigrate(handoff);
    if (migrated.ok) importDocument(migrated.document);
  }, [hydrated, importDocument]);

  /**
   * A template chosen on `/templates` and handed over (P32-B3).
   *
   * Applied through `applyTemplate`, so it is one history entry and one
   * Ctrl+Z — the visitor who clicked a thumbnail to see what it looked like
   * gets their previous design back in one press. Read once and cleared, so
   * a refresh does not restyle a document they have since adjusted by hand.
   */
  useEffect(() => {
    if (!hydrated) return;
    const templateId = takeTemplateHandoff();
    if (templateId === null) return;
    const template = getTemplate(templateId);
    if (template) applyTemplate(template.settings, template.sectionOrder);
  }, [hydrated, applyTemplate]);

  /**
   * Asked once. A returning visitor gets their order applied silently, which
   * is the whole point of storing it.
   */
  const chooseLevel = (next: ExperienceLevel) => {
    writeExperienceLevel(next);
    setLevelPromptReopened(false);
  };

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
        <p className="text-muted text-sm">Loading your draft…</p>
      </div>
    );
  }

  return (
    // The band is read once here and shared down; see `useExperienceLevel.ts`
    // for why it is a context rather than a `localStorage` read per step.
    <ExperienceLevelProvider value={level}>
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {/*
        Mobile-only switch between editing and previewing, now on the real
        `Tabs` primitive rather than a hand-rolled `role="tab"` div. The
        practical difference is keyboard behaviour: arrow keys move between
        the two options, where before every element with `role="tab"` was
        also a tab stop and arrow keys did nothing. No test names this
        tablist directly, so the swap carries no selector risk.
      */}
        {/*
          On a phone this *is* the primary navigation of the whole product —
          it decides whether you are looking at the form or at the document —
          and it was a small inline pill in the corner of a bar. Full width,
          two equal halves, and it stays put while the form scrolls under it.

          `sticky` here cannot touch the header's height contract with this
          component: it sticks inside the builder's own column, below a header
          that is `position: sticky` in its own right.
        */}
        <div className="border-line bg-surface-1/85 sticky top-14 z-20 border-b px-4 py-2 backdrop-blur-md xl:hidden">
          <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as MobileView)}>
            <TabList label="Editor or preview" className="flex w-full">
              <Tab value="edit" className="flex-1">
                Edit
              </Tab>
              <Tab value="preview" className="flex-1">
                Preview
              </Tab>
            </TabList>
          </Tabs>
        </div>

        <div
          className={cn(
            "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 lg:flex-row lg:px-6",
            mobileView === "preview" && "hidden xl:flex",
          )}
        >
          {/*
            The rail recedes; the workspace is the page ground; the canvas
            beyond it is darker still. Three grounds, spatially separated —
            `design.md` §3.5. It used to be one continuous near-white plane
            with hairlines drawn on it, which is why nothing on the screen
            looked further away than anything else.

            Sticky from `lg`, with its own scroll: the rail is navigation for
            a form that is taller than the viewport, and navigation that
            scrolls away is navigation you have to scroll back for.
          */}
          <aside
            className={cn(
              "flex shrink-0 flex-col gap-5",
              "lg:border-line lg:bg-surface-2 lg:sticky lg:top-0 lg:w-64 lg:self-start",
              "lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain",
              "lg:rounded-xl lg:border lg:p-4",
            )}
          >
            {remote ? <ResumeTitleEditor resumeId={remote.id} title={remote.title} /> : null}
            <StepNav
              activeStep={activeStep}
              onSelect={setActiveStep}
              order={stepOrderFor(level)}
              footer={
                <div className="flex flex-col gap-3">
                  {/*
                    Undo and redo live here rather than in the step header,
                    where they were competing with the step title for the top
                    right of the workspace. They are document-level actions —
                    the same scope as the rail — and the keyboard shortcut
                    that does the real work is registered on the window.
                  */}
                  <div className="border-line flex items-center gap-1 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={undo}
                      disabled={!canUndo}
                      icon={<UndoIcon className="h-4 w-4" />}
                    >
                      Undo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={redo}
                      disabled={!canRedo}
                      icon={<RedoIcon className="h-4 w-4" />}
                    >
                      Redo
                    </Button>
                  </div>
                  {levelAsked ? (
                    <button
                      type="button"
                      onClick={() => setLevelPromptReopened(true)}
                      className="text-muted hover:text-text focus-visible:ring-accent rounded text-left text-xs transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Experience:{" "}
                      {EXPERIENCE_LEVEL_OPTIONS.find((option) => option.id === level)?.label ??
                        "not set"}
                      <span className="sr-only"> — change how much work experience you have</span>
                    </button>
                  ) : null}
                </div>
              }
            />
            <IssuesPanel onNavigate={setActiveStep} />
            <div className="hidden lg:block">
              <SectionManager />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {loadError ? (
              <div
                role="alert"
                className="border-warn/40 bg-warn-weak text-warn mb-4 rounded-md border p-3 text-sm"
              >
                Your saved draft could not be opened: {loadError} Starting a new one — nothing has
                been overwritten yet.
              </div>
            ) : null}

            {/*
              Above the step, inline, and never a modal — see the component
              for why. It is the first thing on the page and it blocks
              nothing.
            */}
            <ExperienceLevelPrompt
              open={levelPromptOpen}
              current={level}
              onChoose={chooseLevel}
              onSkip={() => {
                setLevelPromptReopened(false);
                setDismissed(true);
              }}
            />

            {/* The step title has the row to itself now that undo and redo
                have moved to the rail. `h1`, and the name is exactly
                `step.label`: `BuilderShell.test.tsx` and `builder.spec.ts`
                both match it by role, level and exact name. */}
            <header className="mb-6">
              <h1 className="text-text text-2xl font-semibold tracking-tight">{step.label}</h1>
              <p className="text-muted mt-1.5 max-w-prose text-sm leading-relaxed">
                {step.description}
              </p>
            </header>

            <StepComponent key={`${step.id}-${externalRevision}`} />

            <div className="border-line mt-8 border-t pt-6 lg:hidden">
              <SectionManager />
            </div>

            <footer className="border-line mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
              <p className="text-muted text-xs">
                <SyncStatus /> <kbd className="border-line-strong rounded border px-1">Ctrl</kbd>
                {" + "}
                <kbd className="border-line-strong rounded border px-1">K</kbd> to jump sections.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {signedIn ? <SaveAsNewResumeButton /> : null}
                <ImportResumeFile onNavigateToStep={setActiveStep} />
                <ClearAllButton onConfirm={clearAll} />
              </div>
            </footer>
          </main>
        </div>

        <PreviewPane
          signedIn={signedIn}
          // The Match tab's "this requirement is missing" rows jump here, so
          // the finding and the place to act on it are one click apart. On
          // mobile the two live in different tabs, so the switch comes too.
          onNavigateToStep={(stepId) => {
            setActiveStep(stepId);
            setMobileView("edit");
          }}
          className={cn(
            "border-line min-h-0 flex-1 xl:max-w-2xl xl:border-l",
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
    </ExperienceLevelProvider>
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
      <span className="text-muted text-xs">Delete this draft permanently?</span>
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
