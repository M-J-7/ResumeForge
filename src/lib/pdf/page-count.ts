/**
 * Page count read straight from a PDF's page tree.
 *
 * This exists so `renderPdf` needs nothing but the bytes it just produced.
 * The alternative — asking pdfjs — drags in its web worker, and `renderPdf`
 * already runs *inside* our own worker during preview, so that would mean
 * spawning a nested worker purely to read one integer. Reading the page tree
 * is what pdfjs does for `numPages` anyway.
 *
 * This is still "measured from the artifact, never estimated" (D3): the
 * number comes from the rendered file's own catalog, not from anything the
 * layout model predicted. `page-count.test.ts` asserts it agrees with pdfjs
 * on every fixture, so the cheap path stays honest.
 */

/** The root node of the page tree carries the total in `/Count`. */
const PAGES_NODE = /\/Type\s*\/Pages\b/;
const COUNT_ENTRY = /\/Count\s+(\d+)/;
/** `/Type /Page` but not `/Type /Pages`. */
const PAGE_LEAF = /\/Type\s*\/Page(?![s\w])/g;
const OBJECT_START = /\n(\d+) 0 obj\n/g;

function objectBodies(raw: string): string[] {
  const starts: number[] = [];
  OBJECT_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OBJECT_START.exec(raw)) !== null) {
    starts.push(match.index);
    OBJECT_START.lastIndex = match.index + match[0].length;
  }
  return starts.map((start, i) => raw.slice(start, starts[i + 1] ?? raw.length));
}

export function countPages(bytes: Uint8Array): number {
  // latin1 round-trips arbitrary bytes; utf8 would mangle the binary streams.
  const raw = Buffer.from(bytes).toString("latin1");

  const pagesNodes = objectBodies(raw).filter((body) => PAGES_NODE.test(body));
  if (pagesNodes.length === 1) {
    const count = pagesNodes[0]?.match(COUNT_ENTRY)?.[1];
    if (count !== undefined) return Number(count);
  }

  // A nested page tree, or a shape this does not recognise. Counting leaf
  // page objects is slower and cruder but does not depend on tree structure.
  const leaves = raw.match(PAGE_LEAF);
  return leaves ? leaves.length : 0;
}
