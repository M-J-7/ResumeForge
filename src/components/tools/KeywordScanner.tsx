"use client";

/**
 * The keyword scanner's interactive half: a posting, a resume pasted as
 * text, and the builder's own match report comparing them.
 *
 * Every part of it is the builder's: `parseResumeText` (the importer `/check`
 * uses, with typed list markers normalised) turns the pasted text into a document, `useMatchAnalysis` runs the
 * match engine on it, and `MatchReport` draws the result exactly as the Match
 * tab does. So a result here is the result the builder would give, and the
 * "continue in the builder" link hands over the same document, through the
 * same one-time `sessionStorage` key `/check` uses — never a URL.
 *
 * Run on a button, not on every keystroke — D12, and the reason the Match tab
 * works the same way: a number that moves as you type trains you to type at
 * the number. Editing either box afterwards leaves the result on screen and
 * says it is from the earlier text.
 *
 * Nothing is sent anywhere. The skill vocabulary is part of the app and loads
 * from this origin; the posting and the resume stay in the tab.
 */

import { useState } from "react";
import { Button, Field, Textarea } from "@/components/ui/control";
import { MatchReport } from "@/components/match/MatchReport";
import { useMatchAnalysis } from "@/components/match/useMatchAnalysis";
import { CHECK_HANDOFF_KEY } from "@/lib/import/handoff";
import { track } from "@/lib/track";
import { MAX_JOB_DESCRIPTION_LENGTH } from "@/lib/match/job-target";
import type { ResumeDocument } from "@/lib/resume/schema";

/** Longer than any resume; past this the box is being used for something else. */
const MAX_RESUME_TEXT_LENGTH = 30_000;

export function KeywordScanner() {
  const [posting, setPosting] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [compared, setCompared] = useState<{
    posting: string;
    resumeText: string;
    document: ResumeDocument;
  } | null>(null);
  const { state, analyse } = useMatchAnalysis();

  const compare = async () => {
    if (!posting.trim() || !resumeText.trim()) {
      setProblem(
        !posting.trim()
          ? "Paste the job description first."
          : "Paste the text of your resume as well.",
      );
      return;
    }
    setProblem(null);
    // Loaded on the first comparison, not with the page. Reading pasted text
    // needs none of pdfjs, but `parse-resume.ts` imports it for the file
    // paths, and a static import here put it in this page's first load and
    // in the prefetch of every page that links here (`site-weight.test.ts`).
    const { parseResumeText } = await import("@/lib/import/parse-resume");
    const { document } = parseResumeText(resumeText);
    setCompared({ posting, resumeText, document });
    track("scanner:compare");
    void analyse(document, posting);
  };

  const stale =
    state.status === "done" &&
    compared !== null &&
    (compared.posting !== posting || compared.resumeText !== resumeText);

  const stashForBuilder = () => {
    if (!compared) return;
    track("scanner:handoff");
    try {
      sessionStorage.setItem(CHECK_HANDOFF_KEY, JSON.stringify(compared.document));
    } catch {
      // Storage disabled: the builder still opens, just empty.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Field
          label="The job description"
          hint="The whole posting, headings and all — the headings are how requirements are told apart from perks."
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={posting}
              maxLength={MAX_JOB_DESCRIPTION_LENGTH}
              onChange={(event) => setPosting(event.target.value)}
              rows={12}
            />
          )}
        </Field>
        <Field
          label="Your resume, as text"
          hint="Select all in Word or your PDF viewer, copy, and paste. Nothing you paste leaves this tab."
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={resumeText}
              maxLength={MAX_RESUME_TEXT_LENGTH}
              onChange={(event) => setResumeText(event.target.value)}
              rows={12}
            />
          )}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          onClick={() => void compare()}
          disabled={state.status === "running"}
        >
          {state.status === "running" ? "Comparing…" : "Compare"}
        </Button>
        {state.status === "running" ? (
          <p className="text-faint text-small">
            Loading the skill vocabulary — about a megabyte, the first time only.
          </p>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="text-danger text-small font-medium">
          {problem}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-weak text-danger rounded-lg border p-4 text-sm"
        >
          The comparison failed: {state.message}
        </div>
      ) : null}

      {state.status === "done" ? (
        <section aria-label="Comparison" className="flex flex-col gap-4">
          {stale ? (
            <p className="border-warn/30 bg-warn-weak text-text text-small rounded-md border px-3 py-2">
              This is the result for the text as it was when you pressed Compare. Press it again to
              include your changes.
            </p>
          ) : null}
          <MatchReport result={state.analysis.result} />
          <p className="text-muted text-small leading-relaxed">
            Want to act on it?{" "}
            <a
              href="/builder"
              onClick={stashForBuilder}
              className="text-accent rule-grow rounded-sm font-medium"
            >
              Continue in the builder with this resume
            </a>{" "}
            &mdash; it opens there as a draft in this browser. Paste the posting into its Match tab
            to see this report again as you edit.
          </p>
        </section>
      ) : null}
    </div>
  );
}
