"use client";

/**
 * "Word" and "PDF" on an example page: the example, as a file to write over.
 *
 * The same shape as `TemplateDownloads`, and for the same query family — the
 * search for a role's resume "format" or "template" is a search for a file.
 * Each button's accessible name says which example and which format, so a
 * screen reader hears what it will get rather than "Word".
 *
 * The file is made on the click — see `lib/examples/download.ts`.
 */

import { useState } from "react";
import { Button } from "@/components/ui/control";
import { DownloadIcon } from "@/components/ui/icons";
import type { ResumeDocument } from "@/lib/resume/schema";
import { track } from "@/lib/track";

type Format = "docx" | "pdf";

const LABEL: Record<Format, string> = { docx: "Word", pdf: "PDF" };
const SPOKEN: Record<Format, string> = { docx: "a Word file", pdf: "a PDF" };

export function ExampleDownloads({ role, resume }: { role: string; resume: ResumeDocument }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);

  const download = async (format: Format) => {
    setBusy(format);
    setFailed(false);
    try {
      const { downloadExample } = await import("@/lib/examples/download");
      await downloadExample(role, resume, format);
      track(format === "docx" ? "example:word" : "example:pdf");
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted text-small">Download this example free:</span>
      {(["docx", "pdf"] as const).map((format) => (
        <Button
          key={format}
          size="sm"
          disabled={busy !== null}
          onClick={() => void download(format)}
          aria-label={`Download the ${role} resume example as ${SPOKEN[format]}`}
        >
          <DownloadIcon className="size-3.5" />
          {busy === format ? "Preparing…" : LABEL[format]}
        </Button>
      ))}
      {failed ? (
        <span className="text-danger text-xs">That file could not be made. Try again.</span>
      ) : null}
    </div>
  );
}
