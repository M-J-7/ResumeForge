/**
 * The browser-safe half of the extraction layer.
 *
 * Split out of `./extract.ts` for P31, and the split is a dependency
 * boundary rather than a tidying exercise. `extractDocx` uses `mammoth` and
 * `Buffer.from`, both Node-only; every other function here runs unchanged in
 * a browser. Keeping them in one module meant any client component that
 * wanted geometric PDF extraction dragged the whole `mammoth` tree into the
 * bundle behind it — and resume import (P31) needs exactly these functions
 * on the client, on a public route, with no server round trip.
 *
 * `./extract.ts` re-exports everything below, so the existing imports and
 * the X-Ray test suite are unaffected: it is still the module you import
 * from when you want the Node-only DOCX path as well.
 *
 * The two PDF strategies and why there are two are documented in
 * `./extract.ts`; that reasoning is unchanged by where the code lives.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { unzipSync, strFromU8 } from "fflate";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
// Landmine 6. This module reads PDFs, so it is one of the modules that must
// name the worker itself rather than hoping something else on the page did.
// Under Node the import is a no-op; in a browser it is the difference
// between extraction working and pdfjs throwing on the first call.
import "@/lib/pdf/worker";

export type ExtractionStrategy = "pdf-stream-order" | "pdf-geometric" | "docx";

export interface ExtractedDocument {
  strategy: ExtractionStrategy;
  /** Reading order as this strategy recovers it, one entry per visual line. */
  lines: string[];
  /** `lines` joined with newlines — the plain text a parser would work from. */
  text: string;
  pageCount: number;
}

/** Baselines within this many points belong to the same visual line. */
const LINE_TOLERANCE_PT = 2.5;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isTextItem(item: unknown): item is TextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

interface PositionedItem {
  text: string;
  x: number;
  y: number;
}

async function readItems(
  bytes: Uint8Array,
): Promise<{ pages: PositionedItem[][]; pageCount: number }> {
  // pdfjs takes ownership of the buffer it is given, so copy first.
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
  });
  const doc = await task.promise;
  try {
    const pages: PositionedItem[][] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: PositionedItem[] = [];
      for (const item of content.items) {
        if (!isTextItem(item)) continue;
        if (item.str.trim().length === 0) continue;
        items.push({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 });
      }
      pages.push(items);
      page.cleanup();
    }
    return { pages, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}

/**
 * Strategy A — content-stream order.
 *
 * Items are taken exactly as emitted, and a new line is started whenever the
 * baseline changes at all. No sorting: that is the whole point. If our
 * emitter ever produced content out of reading order, this is the strategy
 * that would show it.
 */
export async function extractPdfStreamOrder(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { pages, pageCount } = await readItems(bytes);
  const lines: string[] = [];

  for (const items of pages) {
    let current: string[] = [];
    let currentY: number | null = null;

    for (const item of items) {
      if (currentY !== null && Math.abs(currentY - item.y) > LINE_TOLERANCE_PT) {
        const line = normalize(current.join(" "));
        if (line) lines.push(line);
        current = [];
      }
      current.push(item.text);
      currentY = item.y;
    }

    const last = normalize(current.join(" "));
    if (last) lines.push(last);
  }

  return { strategy: "pdf-stream-order", lines, text: lines.join("\n"), pageCount };
}

/**
 * Strategy B — geometric.
 *
 * Sorts by descending y, clusters into lines within a tolerance, then orders
 * each line left to right. Recovers reading order from the page rather than
 * from the file.
 */
export async function extractPdfGeometric(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { pages, pageCount } = await readItems(bytes);
  const lines: string[] = [];

  for (const items of pages) {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const clusters: PositionedItem[][] = [];

    for (const item of sorted) {
      const current = clusters[clusters.length - 1];
      const anchor = current?.[0];
      if (current && anchor && Math.abs(anchor.y - item.y) <= LINE_TOLERANCE_PT) {
        current.push(item);
      } else {
        clusters.push([item]);
      }
    }

    for (const cluster of clusters) {
      const line = normalize(
        [...cluster]
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join(" "),
      );
      if (line) lines.push(line);
    }
  }

  return { strategy: "pdf-geometric", lines, text: lines.join("\n"), pageCount };
}

export interface DocxParagraph {
  /** The paragraph's named style, e.g. `Heading1`. Empty when unstyled. */
  style: string;
  text: string;
  /** True when the paragraph belongs to a numbering definition (a bullet). */
  isListItem: boolean;
}

/**
 * The paragraph structure a style-aware parser sees.
 *
 * This is the thing DOCX offers that PDF cannot: the document says what each
 * paragraph *is*, rather than leaving a parser to infer it from size and
 * weight.
 *
 * Uses `fflate`, which runs in a browser — unlike `extractDocx`, which is
 * `mammoth` and `Buffer` and therefore Node-only. Import (P31) goes through
 * this function for that reason, and gets more signal for it.
 */
export function extractDocxStructure(bytes: Uint8Array): DocxParagraph[] {
  const files = unzipSync(bytes);
  const documentXml = files["word/document.xml"];
  if (!documentXml) return [];

  const xml = strFromU8(documentXml);
  const paragraphs: DocxParagraph[] = [];

  for (const match of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const body = match[1] ?? "";
    const style = body.match(/<w:pStyle\s+w:val="([^"]+)"/)?.[1] ?? "";
    const isListItem = body.includes("<w:numPr>");
    // Tabs and breaks are whitespace the paragraph genuinely contains, and
    // dropping them glues two fields into one word: an entry heading sets
    // its date at a right tab stop, so ignoring `<w:tab/>` yields
    // "Senior Backend EngineerMar 2022 – Present" and every downstream
    // reader sees one unparseable string where the document has two fields.
    const text = normalize(
      [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)\b[^>]*>/g)]
        .map((t) => (t[1] === undefined ? " " : decodeXmlEntities(t[1])))
        .join(""),
    );
    if (text.length === 0) continue;
    paragraphs.push({ style, text, isListItem });
  }

  return paragraphs;
}

/**
 * A DOCX read as plain lines, without `mammoth`.
 *
 * Produces the same `ExtractedDocument` shape `extractDocx` does, so the
 * X-Ray displays and `recoverFields` work against a browser-read DOCX
 * unchanged. `pageCount` stays 0 for the reason `extractDocx` documents: a
 * DOCX declares no page count, and guessing one would be a claim we cannot
 * substantiate.
 */
export function extractDocxBrowser(bytes: Uint8Array): ExtractedDocument {
  const lines = extractDocxStructure(bytes)
    .map((p) => p.text)
    .filter((line) => line.length > 0);

  return { strategy: "docx", lines, text: lines.join("\n"), pageCount: 0 };
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Lines where the two PDF strategies disagree — where real parsers diverge. */
export function strategyDisagreements(a: ExtractedDocument, b: ExtractedDocument): string[] {
  const disagreements: string[] = [];
  const length = Math.max(a.lines.length, b.lines.length);
  for (let i = 0; i < length; i += 1) {
    const left = a.lines[i];
    const right = b.lines[i];
    if (left !== right) disagreements.push(`${i + 1}: "${left ?? "—"}" vs "${right ?? "—"}"`);
  }
  return disagreements;
}
