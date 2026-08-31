"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfCanvas } from "./PdfCanvas";
import { ExportPanel } from "./ExportPanel";
import { usePdfPreview } from "./usePdfPreview";
import { XRayPanel } from "@/components/xray/XRayPanel";
import { Button, Select } from "@/components/ui/control";
import { analyzeFit, fitInputsFromPages, suggestFit, type PageFit } from "@/lib/layout/fit";
import { readPages } from "@/lib/pdf/read";
import { useResumeStore } from "@/store/resume";
import { cn } from "@/lib/utils";

type ZoomMode = "fit-width" | "fit-page" | "actual";

/** The preview shows the document; X-Ray shows what a parser reads from it. */
type ViewMode = "preview" | "xray";

/** A4 and Letter are both ~600pt wide; used to size fit-width before measuring. */
const NOMINAL_PAGE_WIDTH_PT = 595;
const NOMINAL_PAGE_HEIGHT_PT = 842;

export function PreviewPane({ className }: { className?: string }) {
  const { bytes, pageCount, rendering, error } = usePdfPreview();
  const resume = useResumeStore((s) => s.history.present);
  const update = useResumeStore((s) => s.update);
  const setMeasuredPageCount = useResumeStore((s) => s.setMeasuredPageCount);

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [fit, setFit] = useState<PageFit | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The page count the account stores comes from here, not from an estimate:
  // it is read back out of the PDF that was actually produced (D3), so the
  // dashboard column and the download can never disagree.
  useEffect(() => {
    setMeasuredPageCount(pageCount > 0 ? pageCount : null);
  }, [pageCount, setMeasuredPageCount]);

  // Fit is measured from the rendered artifact, never predicted (D3).
  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    void readPages(bytes)
      .then((pages) => {
        if (cancelled) return;
        const inputs = fitInputsFromPages(
          pages,
          resume.settings.margins,
          resume.settings.fontSizePt * resume.settings.lineHeight,
        );
        setFit(inputs ? analyzeFit(inputs) : null);
      })
      .catch(() => {
        if (!cancelled) setFit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bytes, resume.settings.margins, resume.settings.fontSizePt, resume.settings.lineHeight]);

  const scale = useMemo(() => {
    const padding = 48;
    switch (zoomMode) {
      case "actual":
        return 1;
      case "fit-page":
        return containerHeight > 0
          ? Math.max(0.2, (containerHeight - padding) / NOMINAL_PAGE_HEIGHT_PT)
          : 1;
      case "fit-width":
      default:
        return containerWidth > 0
          ? Math.max(0.2, (containerWidth - padding) / NOMINAL_PAGE_WIDTH_PT)
          : 1;
    }
  }, [zoomMode, containerWidth, containerHeight]);

  const suggestion = fit ? suggestFit(resume, fit) : null;

  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label="Document preview">
      <div
        role="tablist"
        aria-label="Document view"
        className="flex gap-1 border-b border-zinc-200 px-4 pt-2 dark:border-zinc-800"
      >
        {(["preview", "xray"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={viewMode === mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "rounded-t-md px-3 py-1.5 text-sm font-medium transition",
              viewMode === mode
                ? "bg-white text-zinc-900 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-800"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {mode === "preview" ? "Preview" : "X-Ray"}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800",
          viewMode !== "preview" && "hidden",
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {fit ? fit.summary : pageCount > 0 ? `${pageCount} pages` : "—"}
          </span>
          <span
            aria-live="polite"
            className={cn(
              "text-xs text-zinc-500 transition-opacity dark:text-zinc-400",
              rendering ? "opacity-100" : "opacity-0",
            )}
          >
            Updating…
          </span>
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          Zoom
          <Select
            className="w-32 py-1 text-xs"
            value={zoomMode}
            onChange={(e) => setZoomMode(e.target.value as ZoomMode)}
          >
            <option value="fit-width">Fit width</option>
            <option value="fit-page">Fit page</option>
            <option value="actual">100%</option>
          </Select>
        </label>
      </div>

      {suggestion && viewMode === "preview" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            You are {fit?.linesOver} {fit?.linesOver === 1 ? "line" : "lines"} onto page{" "}
            {fit?.pageCount}.
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{suggestion.rationale}</p>
          {suggestion.kind !== "bullet" ? (
            <Button className="mt-2" onClick={() => update(suggestion.apply)}>
              {suggestion.label}
            </Button>
          ) : (
            <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200">
              {suggestion.label}
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          The preview could not be generated: {error}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-auto bg-zinc-200 p-6 dark:bg-zinc-900",
          viewMode !== "preview" && "hidden",
        )}
      >
        {bytes ? (
          <PdfCanvas bytes={bytes} scale={scale} />
        ) : (
          <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {rendering ? "Rendering your resume…" : "Start typing to see your resume."}
          </p>
        )}
      </div>

      {/* Kept mounted so switching tabs does not discard the extraction. */}
      <div className={cn("min-h-0 flex-1", viewMode !== "xray" && "hidden")}>
        <XRayPanel bytes={bytes} active={viewMode === "xray"} />
      </div>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <ExportPanel pdfBytes={bytes} />
      </div>
    </section>
  );
}
