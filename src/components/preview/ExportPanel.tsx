/**
 * Download controls (M0-T12).
 *
 * All three formats, never paywalled (D13). The PDF handed over here is the
 * very blob the preview is showing (D2), so what the user saw is what they
 * get — DOCX and TXT are generated on demand from the same document model.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/control";
import { DESTINATION_ADVICE, resumeFileName, type ExportFormat } from "@/lib/emit/filename";
import { renderDocx } from "@/lib/emit/docx/render";
import { renderText } from "@/lib/emit/text/render";
import { toJsonResume } from "@/lib/interop/json-resume";
import { useResumeStore } from "@/store/resume";

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; a tick
  // is enough for the navigation to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPanel({ pdfBytes }: { pdfBytes: Uint8Array | null }) {
  const resume = useResumeStore((s) => s.history.present);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);

  const nameFor = (format: ExportFormat) => resumeFileName(resume.contact.fullName, format);

  const exportPdf = () => {
    if (!pdfBytes) return;
    // The exact bytes the preview rendered — not a second render (D2).
    download(new Blob([pdfBytes.slice()], { type: "application/pdf" }), nameFor("pdf"));
  };

  const exportDocx = async () => {
    setBusy("docx");
    try {
      const { blob } = await renderDocx(resume);
      download(blob, nameFor("docx"));
    } finally {
      setBusy(null);
    }
  };

  const exportText = () => {
    const blob = new Blob([renderText(resume)], { type: "text/plain;charset=utf-8" });
    download(blob, nameFor("txt"));
  };

  /**
   * JSON Resume (M2-T6): not a format to send an employer, but the one that
   * makes leaving possible. It carries everything — including the parts no
   * PDF can hold, like section order and settings — so this file can rebuild
   * the resume here or be read by any other tool that speaks the format.
   */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(toJsonResume(resume), null, 2)], {
      type: "application/json;charset=utf-8",
    });
    download(blob, nameFor("json"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={exportPdf} disabled={!pdfBytes}>
          Download PDF
        </Button>
        <Button onClick={exportDocx} disabled={busy !== null}>
          {busy === "docx" ? "Preparing…" : "Download DOCX"}
        </Button>
        <Button onClick={exportText}>Download TXT</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={exportJson}>
          Download JSON Resume
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Your data in an open format. Not for sending to an employer — for keeping, or for taking
          somewhere else.
        </span>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Saved as <code className="font-mono">{nameFor("pdf")}</code> — a filename convention for the
        recruiter&rsquo;s downloads folder, not something an ATS searches on.
      </p>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvice((v) => !v)}
          aria-expanded={showAdvice}
          className="text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400"
        >
          Which format should I use?
        </button>

        {showAdvice ? (
          <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Applying through
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Use
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {DESTINATION_ADVICE.map((advice) => (
                  <tr
                    key={advice.destination}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">{advice.destination}</td>
                    <td className="px-3 py-2 font-semibold uppercase">{advice.format}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{advice.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
