"use client";

/**
 * "Word" and "PDF" under a template's card on the public gallery.
 *
 * Buttons, and outside the card's link: a control inside an `<a>` is invalid
 * markup and an ambiguous target, and `e2e/templates.spec.ts` counts the links
 * in each group to prove every template has exactly one. Each button's
 * accessible name says which template and which format, because "Word" read
 * out twenty-four times in a row identifies nothing.
 *
 * The file is made on the click — see `lib/templates/download.ts`.
 */

import { useState } from "react";
import { Button } from "@/components/ui/control";
import type { TemplateDefinition } from "@/lib/resume/templates";
import { track } from "@/lib/track";

type Format = "docx" | "pdf";

const LABEL: Record<Format, string> = { docx: "Word", pdf: "PDF" };
const SPOKEN: Record<Format, string> = { docx: "a Word file", pdf: "a PDF" };

export function TemplateDownloads({ template }: { template: TemplateDefinition }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);

  const download = async (format: Format) => {
    setBusy(format);
    setFailed(false);
    try {
      const { downloadTemplate } = await import("@/lib/templates/download");
      await downloadTemplate(template, format);
      track(format === "docx" ? "template:word" : "template:pdf");
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
      <span className="text-faint text-xs">Download free:</span>
      {(["docx", "pdf"] as const).map((format) => (
        <Button
          key={format}
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => void download(format)}
          aria-label={`Download the ${template.name} template as ${SPOKEN[format]}`}
        >
          {busy === format ? "Preparing…" : LABEL[format]}
        </Button>
      ))}
      {failed ? (
        <span className="text-danger text-xs">That file could not be made. Try again.</span>
      ) : null}
    </div>
  );
}
