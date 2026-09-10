"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfCanvas } from "./PdfCanvas";
import { ExportPanel } from "./ExportPanel";
import { usePdfPreview } from "./usePdfPreview";
import { XRayPanel } from "@/components/xray/XRayPanel";
import { MatchPanel } from "@/components/match/MatchPanel";
import { Button, Select } from "@/components/ui/control";
import { Tab, TabList, Tabs } from "@/components/ui/tabs";
import { DesignPanel } from "@/components/builder/DesignPanel";
import { analyzeFit, fitInputsFromPages, suggestFit, type PageFit } from "@/lib/layout/fit";
import { readPages } from "@/lib/pdf/read";
import { useResumeStore } from "@/store/resume";
import { cn } from "@/lib/utils";

type ZoomMode = "fit-width" | "fit-page" | "actual";

/**
 * The preview shows the document; X-Ray shows what a parser reads from it;
 * Match shows what one specific posting asks for and how the document
 * answers it (P27).
 */
type ViewMode = "preview" | "xray" | "match";

/** A4 and Letter are both ~600pt wide; used to size fit-width before measuring. */
const NOMINAL_PAGE_WIDTH_PT = 595;
const NOMINAL_PAGE_HEIGHT_PT = 842;

export function PreviewPane({
  className,
  signedIn = false,
  onNavigateToStep,
}: {
  className?: string;
  /** Decides where the Match tab keeps a saved posting — account, or D6 browser-only. */
  signedIn?: boolean;
  /** Lets a match finding jump the editor to the step that would fix it. */
  onNavigateToStep?: (stepId: string) => void;
}) {
  const { bytes, pageCount, rendering, error } = usePdfPreview();
  const resume = useResumeStore((s) => s.history.present);
  const update = useResumeStore((s) => s.update);
  const setMeasuredPageCount = useResumeStore((s) => s.setMeasuredPageCount);

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [fit, setFit] = useState<PageFit | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
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
      {/*
        `Tabs` only needs to wrap the `Tab` elements themselves — `TabList` is
        a plain container and everything below reads `viewMode` from this
        component's own state, not from the tab context. Wrapping the whole
        section would work too, but would suggest every child depends on
        which tab is selected, which only the two blocks below actually do.
      */}
      {/*
        One bar, not two.

        The view tabs sat on their own row above a second row holding the page
        count, Design and zoom — two full-width rules across the top of a pane
        that is already narrow, for six controls. They are one toolbar: the
        tabs choose what the pane shows, the rest operates what it is showing,
        and the second group simply disappears when it has nothing to operate.
      */}
      <div className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabList label="Document view">
            <Tab value="preview">Preview</Tab>
            <Tab value="xray">X-Ray</Tab>
            <Tab value="match">Match</Tab>
          </TabList>
        </Tabs>

        {viewMode === "preview" ? (
          <>
            <span className="text-muted text-xs tabular-nums">
              {fit ? fit.summary : pageCount > 0 ? pageLabel(pageCount) : "—"}
            </span>
            {/*
              The live region holds *no text* when idle rather than holding
              invisible text.

              It used to be a permanent "Updating…" faded between `opacity-0`
              and `opacity-100`, and `e2e/a11y.spec.ts` flaked on it: axe
              occasionally scanned mid-fade and measured the contrast of
              half-transparent text, which is a failure. An empty live region
              also announces correctly — a screen reader reads the change,
              and there is nothing there to read when there is no change.
            */}
            <span aria-live="polite" className="text-faint text-xs">
              {rendering ? "Updating…" : ""}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" onClick={() => setDesignOpen(true)}>
                Design
              </Button>
              <label className="text-faint flex items-center gap-2 text-xs">
                Zoom
                <Select
                  className="w-28 py-1 text-xs"
                  value={zoomMode}
                  onChange={(e) => setZoomMode(e.target.value as ZoomMode)}
                >
                  <option value="fit-width">Fit width</option>
                  <option value="fit-page">Fit page</option>
                  <option value="actual">100%</option>
                </Select>
              </label>
            </div>
          </>
        ) : null}
      </div>

      {suggestion && viewMode === "preview" ? (
        <div className="border-warn/30 bg-warn-weak border-b px-4 py-3">
          <p className="text-warn text-sm font-medium">
            You are {fit?.linesOver} {fit?.linesOver === 1 ? "line" : "lines"} onto page{" "}
            {fit?.pageCount}.
          </p>
          <p className="text-warn mt-1 text-xs opacity-90">{suggestion.rationale}</p>
          {suggestion.kind !== "bullet" ? (
            <Button size="sm" className="mt-2" onClick={() => update(suggestion.apply)}>
              {suggestion.label}
            </Button>
          ) : (
            <p className="text-warn mt-2 text-xs font-medium">{suggestion.label}</p>
          )}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-weak text-danger border-b px-4 py-3 text-sm"
        >
          The preview could not be generated: {error}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
          "bg-canvas min-h-0 flex-1 overflow-auto p-6",
          viewMode !== "preview" && "hidden",
        )}
      >
        {bytes ? <PdfCanvas bytes={bytes} scale={scale} /> : <EmptyPage rendering={rendering} />}
      </div>

      {/* Kept mounted so switching tabs does not discard the extraction. */}
      <div className={cn("min-h-0 flex-1", viewMode !== "xray" && "hidden")}>
        <XRayPanel bytes={bytes} active={viewMode === "xray"} />
      </div>

      {/*
        Also kept mounted: the analysis is expensive (a ~1.2 MB vocabulary
        load on first use) and explicitly on-demand per D12, so unmounting
        would silently throw away a result the user asked for and make them
        ask again.
      */}
      <div className={cn("flex min-h-0 flex-1 flex-col", viewMode !== "match" && "hidden")}>
        <MatchPanel
          active={viewMode === "match"}
          signedIn={signedIn}
          onNavigateToStep={onNavigateToStep}
        />
      </div>

      <div className="border-line border-t px-4 py-3">
        <ExportPanel pdfBytes={bytes} />
      </div>

      <DesignPanel open={designOpen} onClose={() => setDesignOpen(false)} />
    </section>
  );
}

/** `1 page`, `2 pages` — the count is an integer here, so it must agree. */
function pageLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

/**
 * What the canvas shows before there is a document.
 *
 * Half the screen, on first load, used to be a blank white rectangle with one
 * grey sentence in the middle of it — which reads as something failing to
 * load rather than as something waiting for you. This is a page: the right
 * proportions, the same paper treatment the real one gets, and a ghost of the
 * block structure a resume has, so the shape of what is coming is legible
 * before any of it exists.
 *
 * `aria-hidden` on the ghost and one real sentence beneath it: a screen
 * reader needs the sentence and gains nothing from eleven decorative bars.
 */
function EmptyPage({ rendering }: { rendering: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        aria-hidden
        className="bg-paper ring-paper-edge aspect-[210/297] w-full max-w-[26rem] rounded-sm p-[9%] shadow-[var(--shadow-page)] ring-1"
      >
        <div className="flex flex-col gap-[3.5%]">
          <div className="flex flex-col items-center gap-[1.5%]">
            <div className="bg-surface-2 h-[2.6%] w-2/5 rounded-full" />
            <div className="bg-surface-2/70 h-[1.4%] w-3/5 rounded-full" />
          </div>
          {[0, 1].map((section) => (
            <div key={section} className="flex flex-col gap-[1.6%] pt-[2%]">
              <div className="bg-surface-2 h-[1.6%] w-1/4 rounded-full" />
              <div className="bg-surface-2/60 h-px w-full" />
              <div className="bg-surface-2/70 h-[1.4%] w-3/4 rounded-full" />
              <div className="bg-surface-2/70 h-[1.4%] w-11/12 rounded-full" />
              <div className="bg-surface-2/70 h-[1.4%] w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <p className="text-faint text-sm">
        {rendering ? "Rendering your resume…" : "Your document appears here as you type."}
      </p>
    </div>
  );
}
