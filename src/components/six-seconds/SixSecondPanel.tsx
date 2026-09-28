"use client";

/**
 * The Six-Second View (ROADMAP F1): page one of the real PDF, with the facts
 * a first read looks for marked where they actually landed.
 *
 * The measuring is `lib/six-seconds/scan.ts`, on the same bytes the preview
 * shows and the download delivers (D3). This panel draws it: the checklist
 * first, because it is what can be acted on, then the page — the quick-read
 * zone filling from the top while a line sweeps down it, and each fact marked
 * in turn. The animation replays whenever the tab is opened, which is the
 * moment worth showing somebody over their shoulder.
 *
 * The page and its overlay are one picture with a label; everything the
 * picture says is also in the list, which is what a screen reader gets.
 */

import { useEffect, useRef, useState } from "react";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// For its side effect — see `PdfCanvas`: without it pdfjs has no worker here.
import "@/lib/pdf/worker";
import { readPages } from "@/lib/pdf/read";
import {
  CURRENT_ROLE_ZONE,
  SIX_SECOND_SOURCE,
  scanDocument,
  type ScanResult,
  type ScanStatus,
  type ScanTarget,
} from "@/lib/six-seconds/scan";
import { useResumeStore } from "@/store/resume";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Rendered at this multiple of 1pt = 1px, then scaled by CSS to the pane. */
const RENDER_SCALE = 1.5;

/** Roughly one line of body text, as a fraction of an A4 or Letter page. */
const MARK_HEIGHT = 0.028;

async function renderFirstPage(bytes: Uint8Array): Promise<HTMLCanvasElement | null> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.display = "block";
    return canvas;
  } finally {
    await task.destroy();
  }
}

const STATUS_BADGE: Record<ScanStatus, { tone: BadgeTone; label: (t: ScanTarget) => string }> = {
  ok: { tone: "ok", label: () => "Near the top" },
  low: { tone: "warn", label: () => "Low on page one" },
  "later-page": {
    tone: "warn",
    label: (target) => `Page ${target.page ?? "?"}`,
  },
  "not-found": { tone: "neutral", label: () => "Not measured" },
};

function badgeFor(target: ScanTarget): { tone: BadgeTone; label: string } {
  const entry = STATUS_BADGE[target.status];
  // A later page is only a problem for a fact that belongs on page one.
  const tone = target.status === "later-page" && !target.flagged ? "neutral" : entry.tone;
  return { tone, label: entry.label(target) };
}

export function SixSecondPanel({ bytes, active }: { bytes: Uint8Array | null; active: boolean }) {
  const resume = useResumeStore((s) => s.history.present);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped whenever the tab opens or the measurement changes, so the overlay
  // remounts and its animation plays again.
  const [take, setTake] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  // Read through a ref so a keystroke does not re-measure: the effect runs
  // when the *PDF* changes, which the preview already debounces. The resume
  // it is compared with is whatever is current when the new bytes arrive.
  const resumeRef = useRef(resume);
  useEffect(() => {
    resumeRef.current = resume;
  }, [resume]);

  useEffect(() => {
    if (!active || !bytes) return;
    let cancelled = false;

    const run = async () => {
      const [pages, canvas] = await Promise.all([readPages(bytes), renderFirstPage(bytes)]);
      if (cancelled) return;
      setResult(scanDocument(resumeRef.current, pages));
      setError(null);
      if (canvas && pageRef.current) pageRef.current.replaceChildren(canvas);
      setTake((n) => n + 1);
    };

    void run().catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    });

    return () => {
      cancelled = true;
    };
  }, [active, bytes]);

  if (error) {
    return (
      <div role="alert" className="text-danger p-4 text-sm">
        Could not read the document back: {error}
      </div>
    );
  }

  const onFirstPage = result?.targets.filter((t) => t.page === 1 && t.depth !== null) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-text text-title font-semibold">What a six-second read reaches</h2>
          <p className="text-muted text-small mt-1 leading-relaxed">
            {result === null
              ? "Measuring where each fact landed on your PDF…"
              : result.issues === 0
                ? "Nothing to look at: the facts a first read looks for are where it looks."
                : `${result.issues} ${result.issues === 1 ? "thing" : "things"} to look at.`}
          </p>
        </div>

        {result ? (
          <ol className="flex flex-col gap-2" aria-label="Facts a first read looks for">
            {result.targets.map((target, index) => {
              const badge = badgeFor(target);
              return (
                <li
                  key={target.id}
                  className="border-line bg-surface-0 flex gap-3 rounded-lg border p-3"
                >
                  <span
                    aria-hidden
                    className="bg-accent text-on-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-text text-sm font-medium">{target.label}</p>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <p className="text-muted mt-0.5 truncate text-xs">{target.text}</p>
                    <p className="text-muted mt-1 text-xs leading-relaxed">{target.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}

        <p className="text-faint text-xs leading-relaxed">{SIX_SECOND_SOURCE}</p>
      </div>

      <div className="bg-canvas p-4">
        <div
          role="img"
          aria-label="Page one of your resume, with the quick-read zone shaded and each fact above marked where it landed"
          className="bg-paper ring-paper-edge relative mx-auto w-full max-w-[34rem] overflow-hidden rounded-sm shadow-[var(--shadow-page)] ring-1"
        >
          {/* A4-shaped until the real page arrives; then the canvas sets the
              height, so the overlay lines up on Letter as well as A4. */}
          <div ref={pageRef} className={cn("w-full", !result && "aspect-[210/297]")} />

          {result ? (
            <div key={take} aria-hidden className="pointer-events-none absolute inset-0">
              {/* The zone a quick read covers easily, filling from the top. */}
              <div
                className="six-zone bg-accent/10 absolute inset-x-0 top-0"
                style={{ height: `${CURRENT_ROLE_ZONE * 100}%` }}
              >
                <div className="six-sweep bg-accent absolute inset-x-0 h-0.5 shadow-[0_0_12px_var(--accent)]" />
              </div>

              {onFirstPage.map((target) => {
                const index = result.targets.indexOf(target);
                const warn = target.status !== "ok";
                return (
                  <div
                    key={target.id}
                    className={cn(
                      "six-mark absolute inset-x-[4%] flex items-center rounded-sm border-l-4",
                      warn ? "border-warn bg-warn/20" : "border-accent bg-accent/15",
                    )}
                    style={{
                      top: `${(target.depth ?? 0) * 100}%`,
                      height: `${MARK_HEIGHT * 100}%`,
                      // In order, after the sweep has passed.
                      animationDelay: `${1.2 + index * 0.25}s`,
                    }}
                  >
                    <span
                      className={cn(
                        "ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        // The pairs the palette test already measures.
                        warn
                          ? "border-warn bg-warn-weak text-warn border"
                          : "bg-accent text-on-accent",
                      )}
                    >
                      {index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
