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
 *
 * ## Why the bulk of it lives in `./extract-browser.ts`
 *
 * `extractDocx` below is the only Node-only function in the layer —
 * `mammoth` and `Buffer` both are. Everything else runs in a browser, and
 * P31's import path and `/check` need it to, on the client, with nothing
 * uploaded. So the browser-safe functions moved to `./extract-browser.ts`
 * and are re-exported here: importing from this module still gets the whole
 * layer, importing from that one gets the half that costs no `mammoth`.
 */

import mammoth from "mammoth";
import type { ExtractedDocument } from "./extract-browser";

export * from "./extract-browser";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * DOCX extraction.
 *
 * `mammoth` gives the text; parsing `word/document.xml` directly gives the
 * paragraph *styles*, which is the structural signal DOCX is good at and PDF
 * has no equivalent for. Knowing a line was marked `Heading1` is what lets
 * the scorecard tell a section heading from a job title that happens to be
 * bold — the reason D4 treats DOCX as the more reliably parsed format.
 *
 * Node-only, and deliberately so: it is the independent second opinion the
 * X-Ray suite grades `extractDocxStructure` against. Anything that has to
 * run in a browser uses `extractDocxBrowser` instead.
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
