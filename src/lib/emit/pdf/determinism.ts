/**
 * Determinism support for M0-T4's "identical input yields identical output"
 * requirement.
 *
 * `ResumePdf` pins everything pdfkit uses to build the document info
 * dictionary, which also pins the trailer `/ID` (pdfkit derives it from an
 * MD5 of that dictionary). Two things remain outside our control, and both
 * are artifacts of *serialization*, not of the document's content:
 *
 * 1. **Font subset tags.** pdfkit labels each embedded subset with six
 *    random uppercase letters (`/BaseFont /ABCDEF+Arimo`), generated with
 *    `Math.random()` in `@react-pdf/pdfkit` with no seed or override
 *    exposed. The tag is an internal label; two PDFs differing only in it
 *    are the same document.
 *
 * 2. **Object write order.** react-pdf subsets and embeds fonts
 *    asynchronously, so the font streams are flushed in completion order,
 *    which varies run to run. The object *numbers* are stable and so is the
 *    total byte length — only the order the objects appear in the file
 *    moves.
 *
 * `pdfFingerprint` therefore normalizes the subset tags and re-sorts the
 * objects by number, producing a canonical projection for equality
 * comparison. It is deliberately *not* a valid PDF; it exists only to be
 * compared. Anything that genuinely differs — text, positions, pagination,
 * which glyphs got subsetted — still changes the fingerprint, so the test
 * retains its power to catch nondeterministic layout.
 */

import { inflateSync } from "node:zlib";

/** `/BaseFont /ABCDEF+Arimo` and `/FontName /ABCDEF+Arimo`. */
const SUBSET_TAG = /\/([A-Z]{6})\+/g;
const PLACEHOLDER_TAG = "/AAAAAA+";

/** Start of an indirect object: `\n12 0 obj\n`. */
const OBJECT_START = /\n(\d+) 0 obj\n/g;

interface PdfObject {
  number: number;
  body: string;
}

/**
 * Drops the trailing cross-reference table and trailer.
 *
 * The xref stores an absolute byte offset for every object, so reordering
 * the objects rewrites it wholesale even though the document is unchanged.
 * It is pure serialization bookkeeping — derived entirely from the objects
 * we are already comparing — so excluding it loses no signal.
 */
function stripTrailer(raw: string): string {
  const start = raw.lastIndexOf("\nxref\n");
  // Guard against a compressed stream that happens to contain the marker:
  // the real table sits at the very end of the file.
  if (start === -1 || start < raw.length * 0.5) return raw;
  return raw.slice(0, start);
}

function splitObjects(raw: string): PdfObject[] | null {
  const starts: { number: number; index: number }[] = [];
  OBJECT_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OBJECT_START.exec(raw)) !== null) {
    starts.push({ number: Number(match[1]), index: match.index });
    // Resume scanning from the end of the header rather than inside it, so
    // overlapping matches are impossible.
    OBJECT_START.lastIndex = match.index + match[0].length;
  }
  if (starts.length === 0) return null;

  // A stream's compressed bytes could in principle contain something that
  // looks like an object header. Duplicated numbers are the signal that
  // happened; bail out rather than silently comparing garbage.
  const numbers = starts.map((s) => s.number);
  if (new Set(numbers).size !== numbers.length) return null;

  return starts.map((start, i) => ({
    number: start.number,
    body: raw.slice(start.index, starts[i + 1]?.index ?? raw.length),
  }));
}

/**
 * `pdfFingerprint` with every Flate stream inflated and its compressed length
 * dropped — the fingerprint to use when the two renders being compared did not
 * happen on the same machine.
 *
 * `pdfFingerprint` compares renders within one process, and there it is
 * exact. Across machines it is too strict: pdfkit deflates with Node's own
 * zlib, and deflate output is not a function of its input alone — it can move
 * with the zlib build and with the CPU features that build detects — so the
 * same page may compress to different bytes in CI than on the laptop that
 * wrote the pin. Inflating is exact everywhere. What remains is every drawing
 * operator, every glyph and every font program the page is made of, so a real
 * change still changes it; only the compressor's choices do not.
 *
 * Subset tags are normalized *after* inflation. Doing it first would rewrite
 * any six capitals and a `+` that happened to occur inside compressed bytes,
 * and the inflate would fail on the data it had corrupted.
 */
export function pdfContentFingerprint(bytes: Uint8Array): string {
  const raw = stripTrailer(Buffer.from(bytes).toString("latin1"));
  const objects = splitObjects(raw);
  const body = objects
    ? objects
        .sort((a, b) => a.number - b.number)
        .map((object) => inflateStream(object.body))
        .join("\n")
    : raw;
  return body.replace(SUBSET_TAG, PLACEHOLDER_TAG);
}

/** How pdfkit ends a stream dictionary and starts its data. */
const STREAM_HEAD = ">>\nstream\n";

/** `/Length 123`, and not `/Length1`, which is a font's uncompressed size. */
const STREAM_LENGTH = /\/Length (\d+) ?/;

function inflateStream(body: string): string {
  const at = body.indexOf(STREAM_HEAD);
  if (at === -1) return body;
  const dictionary = body.slice(0, at + 2);
  const length = STREAM_LENGTH.exec(dictionary);
  if (!length) return body;

  // The length says where the data ends; scanning for `endstream` instead
  // would stop early on compressed bytes that happen to spell it.
  const start = at + STREAM_HEAD.length;
  const end = start + Number(length[1]);
  const data = body.slice(start, end);
  const content = dictionary.includes("/Filter /FlateDecode")
    ? inflateSync(Buffer.from(data, "latin1")).toString("latin1")
    : data;
  return `${dictionary.replace(STREAM_LENGTH, "")}\nstream\n${content}${body.slice(end)}`;
}

/**
 * A canonical, comparable projection of a rendered PDF. Equal fingerprints
 * mean the two renders produced the same document.
 */
export function pdfFingerprint(bytes: Uint8Array): string {
  // latin1 is a byte-preserving round-trip for arbitrary binary data, unlike
  // utf8 which would mangle bytes above 0x7F.
  const raw = stripTrailer(
    Buffer.from(bytes).toString("latin1").replace(SUBSET_TAG, PLACEHOLDER_TAG),
  );
  const objects = splitObjects(raw);
  if (!objects) return raw;
  return objects
    .sort((a, b) => a.number - b.number)
    .map((o) => o.body)
    .join("\n");
}
