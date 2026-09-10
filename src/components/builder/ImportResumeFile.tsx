"use client";

/**
 * Bringing an existing resume in (M2-T6, extended by P31-A3).
 *
 * Started as the JSON Resume import, and the reason it was built that way is
 * the reason it now carries PDF and DOCX too: a format you can only write to
 * is a one-way door with a nicer sign on it, and until P31 the only door in
 * was a format almost nobody has a file in. Every competitor accepts the
 * resume the visitor already has; we owned the extraction layer that does it
 * and did not point it at the front door.
 *
 * ## One file input, three formats
 *
 * Deliberately not a second control beside the JSON one. Two file inputs on
 * one page make `input[type="file"]` ambiguous — the selector `builder.spec`
 * uses, and one of the locked selectors in the implementation plan — and
 * more importantly it asks the visitor to classify their own file before the
 * app will read it. The extension already says which parser to run.
 *
 * ## Replacing the whole document is undoable, not confirmed
 *
 * The import goes through `importDocument` on the store, so it lands on the
 * normal history stack and Ctrl+Z brings the previous draft back. That is a
 * better guarantee than a confirmation dialog, which asks for a decision
 * before the user can see the result. The review that follows shows what was
 * actually recovered — see `components/import/ImportReview.tsx`.
 */

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/control";
import { Dialog } from "@/components/ui/dialog";
import { ImportReview } from "@/components/import/ImportReview";
import { fromJsonResume } from "@/lib/interop/json-resume";
import {
  importKindFromFilename,
  parseResumeFile,
  type ImportResult,
} from "@/lib/import/parse-resume";
import { useResumeStore } from "@/store/resume";

export function ImportResumeFile({
  onNavigateToStep,
}: {
  /** Lets the review jump to the step that fixes an uncertain field. */
  onNavigateToStep?: (stepId: string) => void;
}) {
  const importDocument = useResumeStore((state) => state.importDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [review, setReview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setReview(null);

    try {
      if (/\.json$/i.test(file.name)) {
        await importJson(file);
      } else {
        await importDocumentFile(file);
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "That file could not be read.",
      });
    } finally {
      setBusy(false);
      // Cleared so selecting the same file again re-triggers the change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const importJson = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setMessage({ tone: "error", text: "That file is not valid JSON." });
      return;
    }

    const result = fromJsonResume(parsed);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }

    importDocument(result.document);
    setMessage({
      tone: "ok",
      text: `Imported ${file.name}. Undo (Ctrl+Z) puts your previous draft back.`,
    });
  };

  const importDocumentFile = async (file: File) => {
    const kind = importKindFromFilename(file.name);
    if (!kind) {
      setMessage({
        tone: "error",
        text: "Choose a PDF, a Word .docx, or a JSON Resume file. The older .doc format has no text a parser can read.",
      });
      return;
    }

    setBusy(true);
    // Read in this tab. Nothing is uploaded — the whole parse runs here, which
    // is what lets a guest import without an account (D6).
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await parseResumeFile(bytes, kind);

    importDocument(result.document);
    setReview(result);
    setMessage({
      tone: "ok",
      text: `Imported ${file.name}. Undo (Ctrl+Z) puts your previous draft back.`,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".pdf,.docx,.json,application/pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        // Visually hidden, but still in the accessibility tree and still
        // focusable — so it needs a name of its own. Without one it announced
        // as an unnamed file input sitting just before the button that opens
        // it, which is the worst of both.
        aria-label="Import a resume file — PDF, Word .docx, or JSON Resume"
        className="sr-only"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <Button variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Reading your resume…" : "Import an existing resume"}
      </Button>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error" ? "text-danger text-xs font-medium" : "text-muted text-xs"
          }
        >
          {message.text}
        </p>
      ) : null}

      <Dialog
        open={review !== null}
        onClose={() => setReview(null)}
        title="What we read from your file"
        description="Import is lossy. Here is what came back, and how sure we are of each part."
        className="w-[min(48rem,calc(100vw-2rem))]"
        footer={
          <Button variant="primary" onClick={() => setReview(null)}>
            Done
          </Button>
        }
      >
        {review ? (
          <ImportReview
            result={review}
            onNavigateToStep={
              onNavigateToStep
                ? (stepId) => {
                    setReview(null);
                    onNavigateToStep(stepId);
                  }
                : undefined
            }
          />
        ) : null}
      </Dialog>
    </div>
  );
}
