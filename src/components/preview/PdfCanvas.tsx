/**
 * Paints the rendered PDF onto canvases, one per page.
 *
 * The page chrome matters more than it looks. M0-T9 calls it out
 * specifically: discrete pages with visible boundaries and a shadow, rather
 * than one continuous scroll of content, is most of what makes this feel
 * like a document tool instead of a form with a preview strip. A candidate
 * needs to see where page two starts, because that is the thing they are
 * actually deciding about.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// Imported for its side effect. Without it pdfjs throws
// `No "GlobalWorkerOptions.workerSrc" specified` on any route that does not
// also read text back out of the PDF — which the cover letter editor does not.
import "@/lib/pdf/worker";
import { cn } from "@/lib/utils";

interface RenderedPage {
  pageNumber: number;
  /** CSS pixel dimensions at the current zoom. */
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

/**
 * Rasterizes every page of `bytes` at `scale`.
 *
 * Canvases are built detached and handed over complete, so a half-painted
 * page is never on screen — part of the "never flash blank" rule.
 */
async function rasterize(bytes: Uint8Array, scale: number): Promise<RenderedPage[]> {
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  const pages: RenderedPage[] = [];
  // Cap the backing-store resolution: on a 3x phone an A4 page at 2x zoom
  // would otherwise allocate a canvas large enough to be refused outright.
  const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);

  try {
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pages.push({
        pageNumber: i,
        width: viewport.width / dpr,
        height: viewport.height / dpr,
        canvas,
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  return pages;
}

export function PdfCanvas({
  bytes,
  scale,
  className,
  label = "Resume",
}: {
  bytes: Uint8Array | null;
  scale: number;
  className?: string;
  /**
   * What each page announces itself as — "Resume page 2", "Cover letter
   * page 1". `e2e/builder.spec.ts` matches the resume wording exactly, which
   * is why the default stays "Resume" rather than becoming "Document".
   */
  label?: string;
}) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;

    void rasterize(bytes, scale)
      .then((next) => {
        // Only swap once the whole document is painted; the previous frame
        // stays up until then rather than blanking.
        if (!cancelled) setPages(next);
      })
      .catch(() => {
        // A rasterization failure leaves the last good frame on screen.
        // usePdfPreview surfaces generation errors; this is only painting.
      });

    return () => {
      cancelled = true;
    };
  }, [bytes, scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren(
      ...pages.map((page) => {
        const wrapper = document.createElement("div");
        // Tokens rather than literal Tailwind colours because this string
        // is assigned in JavaScript, not JSX — the redesign's one landmine
        // documented in the plan. `--paper` is the theme-invariant white a
        // rendered page always is; `--shadow-page` and `--paper-edge` are
        // the same page-chrome tokens the landing page's `PaperSample` uses,
        // so a resume looks the same object whether it's an illustration or
        // the real, live-rendered thing.
        wrapper.className = "relative bg-paper shadow-[var(--shadow-page)] ring-1 ring-[var(--paper-edge)]";
        wrapper.style.width = `${page.width}px`;
        wrapper.style.height = `${page.height}px`;
        page.canvas.style.width = `${page.width}px`;
        page.canvas.style.height = `${page.height}px`;
        page.canvas.setAttribute("role", "img");
        page.canvas.setAttribute("aria-label", `${label} page ${page.pageNumber}`);
        wrapper.appendChild(page.canvas);

        // A small "Page N" marker, so pagination reads at a glance instead
        // of being inferred from the gap between pages. Decorative and
        // outside the canvas's own accessible name: a screen reader user
        // already gets "Resume page 2" from the image role above, and a
        // second announcement of the same fact would be noise.
        if (pages.length > 1) {
          const marker = document.createElement("span");
          marker.setAttribute("aria-hidden", "true");
          marker.className =
            "text-muted bg-surface-0/90 border-line pointer-events-none absolute top-2 right-2 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums";
          marker.textContent = `${page.pageNumber} / ${pages.length}`;
          wrapper.appendChild(marker);
        }

        return wrapper;
      }),
    );
  }, [pages, label]);

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col items-center gap-6", className)}
      aria-live="off"
    />
  );
}
