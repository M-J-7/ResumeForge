/**
 * Reading facts back out of a rendered PDF.
 *
 * Per D3, page count is *measured from the artifact*, never estimated — so
 * this module exists to answer "how many pages did react-pdf actually
 * produce?" by parsing the bytes we just wrote.
 *
 * It uses pdfjs-dist's `legacy` build, which is the one that runs under plain
 * Node with no DOM and no worker setup, as well as in the browser. The same
 * loader backs the preview (M0-T9) and, later, the X-Ray extraction layer
 * (M1-T1) — which is why it lives in `lib/pdf/` rather than inside the PDF
 * emitter.
 *
 * Lines are reconstructed from item geometry rather than from pdfjs's
 * `hasEOL` flag. `hasEOL` marks where a *text run* ended, which is not the
 * same as where a visual line ended: two separately positioned runs sitting
 * on different baselines can both report `hasEOL: false` and get
 * concatenated. Since the pagination invariants are statements about visual
 * lines ("no page ends on a section heading"), grouping by baseline is the
 * only correct basis for them.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// Imported for its side effect: pdfjs needs a worker before any call below.
import "./worker";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

type PdfDocument = Awaited<ReturnType<typeof getDocument>["promise"]>;

export { PDF_WORKER_URL } from "./worker";

/** One positioned text run, with the geometry the invariants reason about. */
export interface PdfTextItem {
  text: string;
  /** Baseline y in PDF user space; larger is higher up the page. */
  y: number;
  x: number;
  /** Rendered glyph height in points. */
  height: number;
}

export interface PdfLine {
  text: string;
  y: number;
  height: number;
  items: PdfTextItem[];
}

export interface PdfPage {
  pageNumber: number;
  lines: PdfLine[];
  /** All lines joined with newlines — the plain-text view of the page. */
  text: string;
  /** Page box in points, as the artifact declares it. */
  widthPt: number;
  heightPt: number;
}

/**
 * Baselines within this many points are treated as the same visual line.
 * Generous enough to absorb the sub-point differences between runs of
 * different sizes sharing a line (a role title and its right-aligned date),
 * tight enough not to merge genuinely adjacent lines.
 */
const LINE_TOLERANCE_PT = 2.5;

async function withDocument<T>(
  bytes: Uint8Array,
  fn: (doc: PdfDocument) => Promise<T>,
): Promise<T> {
  // pdfjs takes ownership of the buffer it is handed and leaves the caller's
  // copy detached, so every entry point copies first — otherwise rendering
  // then reading a blob would silently empty it.
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    // Our PDFs embed every font they use, so pdfjs must never substitute a
    // system face — that would mask a missing-glyph bug rather than surface it.
    useSystemFonts: false,
  });
  const doc = await task.promise;
  try {
    return await fn(doc);
  } finally {
    await task.destroy();
  }
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

function groupIntoLines(items: PdfTextItem[]): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfLine[] = [];

  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current.y - item.y) <= LINE_TOLERANCE_PT) {
      current.items.push(item);
      current.height = Math.max(current.height, item.height);
    } else {
      lines.push({ text: "", y: item.y, height: item.height, items: [item] });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = normalizeText(line.items.map((i) => i.text).join(" "));
  }

  return lines.filter((l) => l.text.length > 0);
}

export async function readPages(bytes: Uint8Array): Promise<PdfPage[]> {
  return withDocument(bytes, async (doc) => {
    const pages: PdfPage[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!isTextItem(item)) continue;
        if (item.str.trim().length === 0) continue;
        items.push({
          text: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          height: item.height,
        });
      }

      const lines = groupIntoLines(items);
      const [, , widthPt, heightPt] = page.view;
      pages.push({
        pageNumber: i,
        lines,
        text: lines.map((l) => l.text).join("\n"),
        widthPt: widthPt ?? 0,
        heightPt: heightPt ?? 0,
      });
      page.cleanup();
    }
    return pages;
  });
}

export async function readPageCount(bytes: Uint8Array): Promise<number> {
  return withDocument(bytes, async (doc) => doc.numPages);
}

/** The text of each page, one string per page. */
export async function readTextByPage(bytes: Uint8Array): Promise<string[]> {
  return (await readPages(bytes)).map((p) => p.text);
}

/** Collapses whitespace so comparisons ignore wrapping and kerning-driven splits. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
