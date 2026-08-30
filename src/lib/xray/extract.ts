/**
 * The extraction layer (M1-T1).
 *
 * Re-reads our own output the way a parser would, so we can show the user
 * what a machine actually recovers from their resume. Every competitor
 * *claims* ATS-friendliness; this is the machinery that lets us demonstrate
 * it, because we hold the ground truth the extraction can be graded against.
 *
 * ## Two deliberately different PDF strategies
 *
 * **A — stream order** takes text items in the order they appear in the
 * content stream. This is what a naive parser sees, and it is what breaks on
 * multi-column layouts: two side-by-side columns interleave into nonsense.
 *
 * **B — geometric** clusters items by baseline and sorts within a line by x.
 * This is what a good parser does, and it recovers reading order from
 * position rather than trusting emission order.
 *
 * We ship both because *where they disagree* is precisely where real-world
 * parsers diverge from each other (M1-T3, layer 3). A document the two agree
 * on is one whose reading order is unambiguous.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import { unzipSync, strFromU8 } from "fflate";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

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

/**
 * DOCX extraction.
 *
 * `mammoth` gives the text; parsing `word/document.xml` directly gives the
 * paragraph *styles*, which is the structural signal DOCX is good at and PDF
 * has no equivalent for. Knowing a line was marked `Heading1` is what lets
 * the scorecard tell a section heading from a job title that happens to be
 * bold — the reason D4 treats DOCX as the more reliably parsed format.
 */
export async function extractDocx(bytes: Uint8Array): Promise<ExtractedDocument> {
  const buffer = Buffer.from(bytes);
  const result = await mammoth.extractRawText({ buffer });
  const lines = result.value
    .split("\n")
    .map(normalize)
    .filter((line) => line.length > 0);

  return {
    strategy: "docx",
    lines,
    text: lines.join("\n"),
    // A DOCX declares no page count — pagination is the word processor's
    // decision, not the file's. Reporting 0 is honest; guessing is not.
    pageCount: 0,
  };
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
    const text = normalize(
      [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((t) => decodeXmlEntities(t[1] ?? ""))
        .join(""),
    );
    if (text.length === 0) continue;
    paragraphs.push({ style, text, isListItem });
  }

  return paragraphs;
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
