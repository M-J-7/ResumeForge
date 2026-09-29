"use client";

/**
 * The free ATS check (P31-A4).
 *
 * Drop in a resume — anyone's, made with anything — and see what a machine
 * recovers from it. Free, no account, and nothing leaves the browser: the
 * extraction, the recovery and the rendering all happen in this tab, which
 * is why the page can promise it rather than merely assert it.
 *
 * ## Why it does not reuse `XRayPanel` wholesale
 *
 * X-Ray *grades*: it compares what a parser recovered against the document
 * we generated the file from, and the grade is meaningful precisely because
 * we hold the ground truth. Here we do not. The visitor's file was written
 * by someone else, and there is no correct answer to compare against.
 *
 * Running the scorecard anyway would grade a stranger's resume against
 * whatever empty draft happens to be in this browser, and report a
 * confident-looking percentage that means nothing at all. So this shows the
 * same three layers — what was recovered, where the two readings diverge,
 * and the raw text — without the number. Within D14: describe what a parser
 * recovered, never claim what an employer's system will do.
 *
 * The recovery display itself is shared with the builder's import review, so
 * there is one definition of "here is what we read and how sure we are".
 */

import { useRef, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/control";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangleIcon, FileTextIcon } from "@/components/ui/icons";
import { ImportReview } from "@/components/import/ImportReview";
import {
  importKindFromFilename,
  parseResumeFile,
  type ImportResult,
} from "@/lib/import/parse-resume";
import {
  extractPdfGeometric,
  extractPdfStreamOrder,
  strategyDisagreements,
} from "@/lib/xray/extract-browser";
import { CHECK_HANDOFF_KEY } from "@/lib/import/handoff";

interface CheckState {
  fileName: string;
  result: ImportResult;
  /** Empty for DOCX: there is one reading of a DOCX, not two. */
  disagreements: string[];
}

export function CheckTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CheckState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const run = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setState(null);

    const kind = importKindFromFilename(file.name);
    if (!kind) {
      setError(
        "Choose a PDF or a Word .docx. The older .doc format stores no text a parser can read, which is a finding in itself.",
      );
      return;
    }

    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await parseResumeFile(bytes, kind);

      // Layer 3, and only for PDFs: a DOCX states its own reading order, so
      // there are not two readings of it to disagree.
      let disagreements: string[] = [];
      if (kind === "pdf") {
        const naive = await extractPdfStreamOrder(bytes);
        const careful = await extractPdfGeometric(bytes);
        disagreements = strategyDisagreements(naive, careful);
      }

      setState({ fileName: file.name, result, disagreements });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be read.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  /**
   * Hands the parsed draft to the builder through session storage rather
   * than a query string or the server. A resume does not go in a URL — it
   * would land in browser history, in any referrer header the next
   * navigation sends, and in the server access log for a page that is
   * supposed to have received nothing at all.
   *
   * Written in the click handler of a real `<a href>`, whose navigation then
   * proceeds normally. A plain link is the right answer for a cross-route
   * link anyway, and it avoids `useRouter()`, which throws in jsdom.
   */
  const stashForBuilder = () => {
    if (!state) return;
    try {
      sessionStorage.setItem(CHECK_HANDOFF_KEY, JSON.stringify(state.result.document));
    } catch {
      // A browser with storage disabled still gets a working builder; it
      // just starts empty, which is the pre-P31 behaviour.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void run(event.dataTransfer.files?.[0]);
        }}
        /*
         * The highest-value acquisition surface on the site, and it used to
         * look like a form field: a dashed grey rectangle with an icon in it.
         * It is now the parser's own surface — slate ground, slate border,
         * slate light under the pointer — which is the same rule the rest of
         * the app follows about whose voice a thing is in. `--machine` leads
         * everywhere a machine is about to read something.
         *
         * `data-dragging` rather than another class in the string: one
         * attribute, and the border, the ground and the disc all answer it.
         */
        data-dragging={dragging ? "" : undefined}
        className="machine-panel spot spot-machine lift group border-machine/45 hover:border-machine data-dragging:border-machine flex flex-col items-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-[var(--dur)] sm:p-12"
      >
        {/* The icon in a lit disc rather than floating on the ground. It is
            what makes the zone read as a *place to put something* rather than
            as a decorated boundary. */}
        <span
          aria-hidden
          className="bg-machine-weak text-machine elev-1 border-line flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:-rotate-6"
        >
          <FileTextIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-text text-title font-semibold">Drop a PDF or Word .docx here</p>
          <p className="text-muted text-small max-w-measure mx-auto mt-2 leading-relaxed">
            It is read in this tab. Nothing is uploaded, there is no account, and there is nothing
            to pay for.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-label="Choose a resume file to check"
          className="sr-only"
          onChange={(event) => void run(event.target.files?.[0])}
        />
        <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Reading your resume…" : "Choose a file"}
        </Button>
        {/* The formats, in the machine's face, because they are a statement
            about what a parser here can open. */}
        <p aria-hidden className="text-faint text-micro font-mono tracking-wider uppercase">
          .pdf&ensp;·&ensp;.docx
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-danger flex gap-2 text-sm">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {state ? (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">What a parser recovered from {state.fileName}</CardTitle>
            </CardHeader>
            <CardBody>
              <ImportReview result={state.result} />
            </CardBody>
          </Card>

          {state.disagreements.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Where two parsers would read it differently</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                <p className="text-muted text-sm">
                  {state.disagreements.length}{" "}
                  {state.disagreements.length === 1 ? "line reads" : "lines read"} differently
                  depending on how carefully the parser works. Some of that is normal — a date set
                  to the right of a job title reads as one line to a careful parser and two to a
                  naive one. A lot of it is a sign the layout puts reading order in doubt.
                </p>
                <ul className="border-line text-muted max-h-48 overflow-y-auto rounded-md border p-2 font-mono text-xs">
                  {state.disagreements.slice(0, 20).map((line) => (
                    <li key={line} className="py-0.5">
                      {line}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/builder"
              onClick={stashForBuilder}
              className={buttonClassName({ variant: "primary" })}
            >
              Fix this in the builder
            </a>
            <p className="text-muted text-xs">
              Opens the builder with what was read above already filled in. Still nothing uploaded.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
