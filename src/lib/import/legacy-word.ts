/**
 * Reading a `.doc` — the Word 97–2003 binary format, and the other things
 * that routinely arrive with that name: RTF, HTML and Word's XML.
 *
 * `/check` used to turn every `.doc` away with "the older .doc format stores
 * no text a parser can read". That was not true. A `.doc` stores its text
 * plainly enough; it is wrapped in a container nobody had written a reader
 * for here. Recruiters still ask for `.doc`, applicant tracking systems still
 * read it, and job boards and older templates still produce it, so a visitor
 * with one was turned away for a reason that was ours, not theirs.
 *
 * ## What a `.doc` is
 *
 * A Compound File (Office 97's little FAT file system inside a file) holding
 * a `WordDocument` stream and a table stream. The text sits in the
 * `WordDocument` stream in runs ("pieces"), each either one byte per
 * character (Windows-1252) or two (UTF-16), and the piece table in the table
 * stream says where each run is. Everything below follows [MS-CFB] and
 * [MS-DOC], and reads only what the import needs:
 *
 * - the main document's text, in order — not headers, footers, footnotes or
 *   text boxes, which is also what the DOCX reader takes;
 * - which paragraphs are list items, from each paragraph's own properties,
 *   because Word's bullets are numbering rather than characters and are not
 *   in the text at all;
 * - table rows, so a row that sets a title in one cell and its dates in the
 *   next reads as one line, the way it looks and the way a PDF of it reads.
 *
 * Styles are not read, so headings are found by shape, the way a PDF's are.
 *
 * ## The others
 *
 * Word's "Save as Web Page" output and many online builders' "Word"
 * downloads are HTML with a `.doc` name; others are RTF, or Word 2003 XML.
 * Word opens every one of them without complaint, so their owners have no way
 * to know. Each is read here rather than reported as damaged.
 *
 * Nothing here throws a low-level message at a person: every failure is a
 * `LegacyWordError` whose message says what to do about it.
 */

import { paragraphsFromWordXml, type DocxParagraph } from "@/lib/xray/extract-browser";

export type LegacyWordFormat = "doc" | "rtf" | "html" | "xml";

export interface LegacyWordDocument {
  format: LegacyWordFormat;
  paragraphs: DocxParagraph[];
}

/** A failure whose message is written for the person who chose the file. */
export class LegacyWordError extends Error {
  override name = "LegacyWordError";
}

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function isCompoundFile(bytes: Uint8Array): boolean {
  return CFB_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** RTF, allowing for a byte-order mark or whitespace before it. */
export function isRtf(bytes: Uint8Array): boolean {
  return /^\s*\{\\rtf/.test(asciiHead(bytes, 64));
}

/** Word 2003 XML or Flat OPC: WordprocessingML in a single XML file. */
export function isWordXml(bytes: Uint8Array): boolean {
  const head = asciiHead(bytes, 4096);
  return (
    /^\s*</.test(head) && /<w:wordDocument\b|<pkg:package\b|progid="Word\.Document"/.test(head)
  );
}

/** An HTML page, including Word's own "Save as Web Page" output. */
export function isHtml(bytes: Uint8Array): boolean {
  const head = asciiHead(bytes, 2048).toLowerCase();
  return /^\s*</.test(head) && /<(?:!doctype\s+html|html|body|head|meta|p\b|div\b)/.test(head);
}

function asciiHead(bytes: Uint8Array, length: number): string {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let out = "";
  for (let i = start; i < Math.min(bytes.length, start + length); i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

export function extractLegacyWord(bytes: Uint8Array): LegacyWordDocument {
  if (isCompoundFile(bytes)) return { format: "doc", paragraphs: readWordBinary(bytes) };
  if (isRtf(bytes)) return { format: "rtf", paragraphs: readRtf(bytes) };
  if (isWordXml(bytes)) {
    return { format: "xml", paragraphs: paragraphsFromWordXml(decodeText(bytes)) };
  }
  if (isHtml(bytes)) return { format: "html", paragraphs: readHtml(bytes) };
  if (/^MIME-Version:/i.test(asciiHead(bytes, 256).trimStart())) {
    throw new LegacyWordError(
      "That file is a single-file web page (MHTML) with a Word name. Open it in Word and save " +
        "it as .docx or PDF, then check that.",
    );
  }
  throw new LegacyWordError(
    "That file could not be read as a Word document. If it opens in Word, save it again as " +
      ".docx or PDF and check that.",
  );
}

const DAMAGED_DOC =
  "That Word file looks damaged and could not be read. If it opens in Word, save it again as " +
  ".docx or PDF and check that.";

export const PROTECTED_WORD =
  "That Word file is password-protected, so nothing in it can be read — not here, and not by " +
  "an applicant tracking system either. Save a copy without the password and check that.";

/* -------------------------------------------------------------------------- */
/* Paragraph tokens, shared by the binary and RTF readers                      */
/* -------------------------------------------------------------------------- */

/**
 * One paragraph as a format reader sees it, before table rows are joined.
 * `cellEnd` closes a table cell and `rowEnd` closes its row; `inTable` marks
 * a paragraph inside a cell that has not closed yet.
 */
interface Token {
  text: string;
  /** The paragraph style's name, where the format has one. */
  style: string;
  isListItem: boolean;
  inTable: boolean;
  cellEnd: boolean;
  rowEnd: boolean;
}

/**
 * A manual line break, held in the text until the paragraph is complete.
 * U+2028, LINE SEPARATOR: a character no resume's text contains.
 */
const LINE_BREAK = String.fromCharCode(0x2028);

/**
 * Adds one finished paragraph. A manual line break inside it starts a new
 * line, the way it looks — except in a list item, where it is the same
 * bullet carrying on and is joined back up.
 */
function pushParagraph(tokens: Token[], text: string, flags: Omit<Token, "text">): void {
  const lines = flags.isListItem ? [text.split(LINE_BREAK).join(" ")] : text.split(LINE_BREAK);
  lines.forEach((line, index) => {
    const last = index === lines.length - 1;
    tokens.push({
      text: line,
      style: flags.style,
      isListItem: flags.isListItem,
      inTable: flags.inTable || (!last && (flags.cellEnd || flags.rowEnd)),
      cellEnd: last && flags.cellEnd,
      rowEnd: last && flags.rowEnd,
    });
  });
}

/**
 * Tokens to paragraphs. A table row whose cells each hold one paragraph is
 * joined into one line, which is how it looks on the page and how a PDF of it
 * reads: "Acme Corp" in one cell and "2021 – 2024" in the next is the dated
 * line an entry starts with. A row with longer cells is left as its
 * paragraphs, in reading order, because joining those would interleave them.
 */
function assemble(tokens: readonly Token[]): DocxParagraph[] {
  const out: DocxParagraph[] = [];
  let row: Token[][] = [];
  let cell: Token[] = [];

  const push = (text: string, isListItem: boolean, style = "") => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length > 0) out.push({ style, text: normalized, isListItem });
  };
  const flushRow = () => {
    if (cell.length > 0) row.push(cell);
    const cells = row.map((c) => c.filter((t) => t.text.trim().length > 0));
    if (cells.every((c) => c.length <= 1)) {
      const texts = cells.flat();
      push(
        texts.map((t) => t.text).join(" "),
        texts.some((t) => t.isListItem),
      );
    } else {
      for (const t of cells.flat()) push(t.text, t.isListItem, t.style);
    }
    row = [];
    cell = [];
  };

  for (const token of tokens) {
    if (token.rowEnd) {
      if (token.text.trim()) cell.push(token);
      flushRow();
    } else if (token.cellEnd) {
      cell.push(token);
      row.push(cell);
      cell = [];
    } else if (token.inTable) {
      cell.push(token);
    } else {
      // A row the file never closed is closed by the first paragraph outside it.
      if (row.length > 0 || cell.length > 0) flushRow();
      push(token.text, token.isListItem, token.style);
    }
  }
  if (row.length > 0 || cell.length > 0) flushRow();
  return out;
}

/* -------------------------------------------------------------------------- */
/* Compound File Binary [MS-CFB]                                               */
/* -------------------------------------------------------------------------- */

const END_OF_CHAIN = 0xfffffffe;

interface DirectoryEntry {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  start: number;
  size: number;
}

class CompoundFile {
  private readonly view: DataView;
  private readonly sectorSize: number;
  private readonly fat: number[] = [];
  private readonly entries: DirectoryEntry[] = [];
  private miniFat: number[] = [];
  private miniStream: Uint8Array | null = null;

  constructor(private readonly bytes: Uint8Array) {
    if (bytes.length < 512) throw new LegacyWordError(DAMAGED_DOC);
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const shift = this.view.getUint16(0x1e, true);
    if (shift !== 9 && shift !== 12) throw new LegacyWordError(DAMAGED_DOC);
    this.sectorSize = 1 << shift;

    // The FAT's own sectors are listed by the DIFAT: 109 in the header, the
    // rest in a chain of DIFAT sectors.
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i += 1) {
      const sector = this.view.getUint32(0x4c + i * 4, true);
      if (sector < END_OF_CHAIN) fatSectors.push(sector);
    }
    const perDifat = this.sectorSize / 4 - 1;
    let difat = this.view.getUint32(0x44, true);
    for (let guard = 0; difat < END_OF_CHAIN; guard += 1) {
      if (guard > bytes.length / this.sectorSize) throw new LegacyWordError(DAMAGED_DOC);
      const view = viewOf(this.sector(difat));
      for (let i = 0; i < perDifat; i += 1) {
        const entry = view.getUint32(i * 4, true);
        if (entry < END_OF_CHAIN) fatSectors.push(entry);
      }
      difat = view.getUint32(perDifat * 4, true);
    }

    for (const index of fatSectors) {
      const view = viewOf(this.sector(index));
      for (let i = 0; i < this.sectorSize / 4; i += 1) this.fat.push(view.getUint32(i * 4, true));
    }

    const directory = viewOf(this.chain(this.view.getUint32(0x30, true), this.fat, false));
    for (let offset = 0; offset + 128 <= directory.byteLength; offset += 128) {
      const nameLength = Math.min(directory.getUint16(offset + 0x40, true), 64);
      let name = "";
      for (let i = 0; i + 2 < nameLength; i += 2) {
        name += String.fromCharCode(directory.getUint16(offset + i, true));
      }
      this.entries.push({
        name,
        type: directory.getUint8(offset + 0x42),
        left: directory.getUint32(offset + 0x44, true),
        right: directory.getUint32(offset + 0x48, true),
        child: directory.getUint32(offset + 0x4c, true),
        start: directory.getUint32(offset + 0x74, true),
        size: directory.getUint32(offset + 0x78, true),
      });
    }
  }

  private sector(index: number): Uint8Array {
    const start = (index + 1) * this.sectorSize;
    // The last sector of a file is allowed to be short.
    if (start >= this.bytes.length) throw new LegacyWordError(DAMAGED_DOC);
    return this.bytes.subarray(start, Math.min(start + this.sectorSize, this.bytes.length));
  }

  private miniSector(index: number): Uint8Array {
    const unit = 1 << this.view.getUint16(0x20, true);
    const stream = this.miniStream;
    if (!stream || (index + 1) * unit > stream.length) throw new LegacyWordError(DAMAGED_DOC);
    return stream.subarray(index * unit, (index + 1) * unit);
  }

  /** A chain of sectors, followed through `table`, joined end to end. */
  private chain(start: number, table: readonly number[], mini: boolean): Uint8Array {
    const parts: Uint8Array[] = [];
    let index = start;
    for (let count = 0; index < END_OF_CHAIN; count += 1) {
      if (count > table.length || index >= table.length) throw new LegacyWordError(DAMAGED_DOC);
      parts.push(mini ? this.miniSector(index) : this.sector(index));
      index = table[index]!;
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  /** The root storage's direct children, walking the directory's sibling tree. */
  private rootChildren(): DirectoryEntry[] {
    const root = this.entries[0];
    const found: DirectoryEntry[] = [];
    const seen = new Set<number>();
    const walk = (id: number) => {
      if (id >= this.entries.length || seen.has(id)) return;
      seen.add(id);
      const entry = this.entries[id]!;
      found.push(entry);
      walk(entry.left);
      walk(entry.right);
    };
    if (root) walk(root.child);
    return found;
  }

  rootNames(): string[] {
    return this.rootChildren().map((entry) => entry.name);
  }

  /** A stream directly under the root, or null if there is none by that name. */
  stream(name: string): Uint8Array | null {
    const root = this.entries[0];
    const entry = this.rootChildren().find((e) => e.type === 2 && e.name === name);
    if (!root || !entry) return null;

    // Small streams live in the mini stream, in 64-byte sectors of their own.
    if (entry.size < this.view.getUint32(0x38, true)) {
      if (!this.miniStream) {
        this.miniStream = this.chain(root.start, this.fat, false);
        const miniFat = viewOf(this.chain(this.view.getUint32(0x3c, true), this.fat, false));
        for (let i = 0; i + 4 <= miniFat.byteLength; i += 4) {
          this.miniFat.push(miniFat.getUint32(i, true));
        }
      }
      return this.chain(entry.start, this.miniFat, true).subarray(0, entry.size);
    }
    return this.chain(entry.start, this.fat, false).subarray(0, entry.size);
  }
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/* -------------------------------------------------------------------------- */
/* Word 97–2003 [MS-DOC]                                                       */
/* -------------------------------------------------------------------------- */

function readWordBinary(bytes: Uint8Array): DocxParagraph[] {
  const file = new CompoundFile(bytes);
  const names = file.rootNames();

  // A password-protected .docx is not a zip at all: it is a compound file
  // with the encrypted package inside it.
  if (names.includes("EncryptedPackage") || names.includes("EncryptionInfo")) {
    throw new LegacyWordError(PROTECTED_WORD);
  }

  const word = file.stream("WordDocument");
  if (!word) {
    const what =
      names.includes("Workbook") || names.includes("Book")
        ? "an Excel spreadsheet"
        : names.includes("PowerPoint Document")
          ? "a PowerPoint presentation"
          : "an Office file, but not a Word document";
    throw new LegacyWordError(
      `That file is ${what}. Save your resume from Word as .docx or PDF and check that.`,
    );
  }
  if (word.length < 0x22) throw new LegacyWordError(DAMAGED_DOC);

  const wv = viewOf(word);
  const ident = wv.getUint16(0, true);
  const nFib = wv.getUint16(2, true);
  const flags = wv.getUint16(0x0a, true);
  if (ident !== 0xa5ec && ident !== 0xa5dc) throw new LegacyWordError(DAMAGED_DOC);
  if (flags & 0x0100) throw new LegacyWordError(PROTECTED_WORD);

  // Word 6 and Word 95 (nFib 101–105) predate the piece table's layout here.
  // A file they saved in one go keeps its text in one run, between fcMin and
  // fcMac; a fast-saved one does not, and is turned away honestly.
  if (nFib < 0xc0) {
    if (flags & 0x0004 || word.length < 0x20) {
      throw new LegacyWordError(
        "That Word file was saved by Word 95 or earlier, in a form this cannot read. Open it in " +
          "Word and save it as .docx or PDF, then check that.",
      );
    }
    const fcMin = wv.getUint32(0x18, true);
    const fcMac = Math.min(wv.getUint32(0x1c, true), word.length);
    return assemble(
      tokenize(
        (function* () {
          for (let fc = fcMin; fc < fcMac; fc += 1) yield { code: cp1252(word[fc]!), fc };
        })(),
        () => null,
      ),
    );
  }

  const table = file.stream(flags & 0x0200 ? "1Table" : "0Table");
  if (!table) throw new LegacyWordError(DAMAGED_DOC);
  const tv = viewOf(table);

  // The FIB's variable-length parts: a run of 16-bit values, a run of 32-bit
  // values, then the (offset, length) pairs that locate everything else.
  const csw = wv.getUint16(0x20, true);
  const cslwAt = 0x22 + csw * 2;
  const cslw = wv.getUint16(cslwAt, true);
  const lwStart = cslwAt + 2;
  const cbRgFcLcb = wv.getUint16(lwStart + cslw * 4, true);
  const fcLcbStart = lwStart + cslw * 4 + 2;
  if (cslw < 4 || cbRgFcLcb < 34 || fcLcbStart + 34 * 8 > word.length) {
    throw new LegacyWordError(DAMAGED_DOC);
  }
  const ccpText = wv.getUint32(lwStart + 3 * 4, true);
  const pair = (index: number) => ({
    fc: wv.getUint32(fcLcbStart + index * 8, true),
    lcb: wv.getUint32(fcLcbStart + index * 8 + 4, true),
  });
  const clx = pair(33);
  const btePapx = pair(13);
  const stshf = pair(1);

  const pieces = readPieceTable(tv, clx.fc, clx.lcb);
  const styles = readStyleSheet(tv, stshf.fc, stshf.lcb);
  const propsAt = paragraphPropertyReader(word, tv, btePapx.fc, btePapx.lcb, styles);

  const characters = function* () {
    for (const piece of pieces) {
      const end = Math.min(piece.cpEnd, ccpText);
      for (let cp = piece.cpStart; cp < end; cp += 1) {
        if (piece.compressed) {
          const offset = piece.fc + (cp - piece.cpStart);
          if (offset >= word.length) return;
          yield { code: cp1252(word[offset]!), fc: offset };
        } else {
          const offset = piece.fc + (cp - piece.cpStart) * 2;
          if (offset + 1 >= word.length) return;
          yield { code: wv.getUint16(offset, true), fc: offset };
        }
      }
    }
  };

  return assemble(tokenize(characters(), propsAt));
}

interface Piece {
  cpStart: number;
  cpEnd: number;
  /** Byte offset of the piece's first character in the WordDocument stream. */
  fc: number;
  compressed: boolean;
}

function readPieceTable(tv: DataView, fcClx: number, lcbClx: number): Piece[] {
  let offset = fcClx;
  const end = Math.min(fcClx + lcbClx, tv.byteLength);
  while (offset + 5 <= end) {
    const kind = tv.getUint8(offset);
    if (kind === 0x01) {
      // A Prc: property modifiers, which this reader does not need.
      const size = tv.getInt16(offset + 1, true);
      if (size < 0) break;
      offset += 3 + size;
    } else if (kind === 0x02) {
      const lcb = tv.getUint32(offset + 1, true);
      const start = offset + 5;
      const count = Math.floor((lcb - 4) / 12);
      if (count <= 0 || start + lcb > tv.byteLength) break;
      const pieces: Piece[] = [];
      for (let i = 0; i < count; i += 1) {
        const pcd = start + (count + 1) * 4 + i * 8;
        const raw = tv.getUint32(pcd + 2, true);
        const compressed = (raw & 0x40000000) !== 0;
        const fc = raw & 0x3fffffff;
        pieces.push({
          cpStart: tv.getUint32(start + i * 4, true),
          cpEnd: tv.getUint32(start + (i + 1) * 4, true),
          fc: compressed ? fc / 2 : fc,
          compressed,
        });
      }
      return pieces;
    } else {
      break;
    }
  }
  throw new LegacyWordError(DAMAGED_DOC);
}

interface ParagraphProps {
  isListItem: boolean;
  inTable: boolean;
  /** The paragraph is a table row's end mark rather than a cell's. */
  rowEnd: boolean;
  /** The paragraph style's name — "heading 1", "List Bullet" — or "". */
  style: string;
}

/** What a run of property changes (sprms) says, before the style is consulted. */
interface Sprms {
  /** The list the paragraph is in; 0 is "none"; null is "not said here". */
  ilfo: number | null;
  inTable: boolean;
  rowEnd: boolean;
}

interface StyleInfo {
  name: string;
  /** The style this one is based on, or null. */
  base: number | null;
  ilfo: number | null;
}

/**
 * The stylesheet: each paragraph style's name, its base, and whether it puts
 * a paragraph in a list. Word's "List Bullet" and most templates' bullet
 * styles carry their numbering in the style, so a paragraph that only names
 * the style is a bullet all the same. The names give headings too: a `.doc`
 * styled "heading 1" declares its sections the way a DOCX does.
 *
 * Unreadable, it is an empty sheet: headings are then found by shape, and
 * only style-borne bullets are missed.
 */
function readStyleSheet(tv: DataView, fc: number, lcb: number): StyleInfo[] {
  const styles: StyleInfo[] = [];
  try {
    if (lcb < 4 || fc + lcb > tv.byteLength) return styles;
    const end = fc + lcb;
    const cbStshi = tv.getUint16(fc, true);
    const cstd = tv.getUint16(fc + 2, true);
    const cbBase = tv.getUint16(fc + 4, true);
    let at = fc + 2 + cbStshi;
    for (let istd = 0; istd < cstd && at + 2 <= end; istd += 1) {
      const cbStd = tv.getUint16(at, true);
      const std = at + 2;
      at = std + cbStd;
      if (cbStd === 0 || cbBase < 10 || std + cbBase + 2 > end) {
        styles.push({ name: "", base: null, ilfo: null });
        continue;
      }
      const stk = tv.getUint16(std + 2, true) & 0x000f;
      const istdBase = tv.getUint16(std + 2, true) >> 4;
      const nameAt = std + cbBase;
      const cch = tv.getUint16(nameAt, true);
      let name = "";
      for (let i = 0; i < cch && nameAt + 2 + i * 2 + 1 < end; i += 1) {
        name += String.fromCharCode(tv.getUint16(nameAt + 2 + i * 2, true));
      }
      let ilfo: number | null = null;
      // A paragraph style's first property block is its paragraph
      // properties: a length, the style index, then the sprms.
      const upx = nameAt + 2 + cch * 2 + 2;
      if (stk === 1 && upx + 4 <= std + cbStd) {
        const cbUpx = tv.getUint16(upx, true);
        if (cbUpx >= 2) ilfo = readSprms(tv, upx + 4, Math.min(upx + 2 + cbUpx, std + cbStd)).ilfo;
      }
      styles.push({ name, base: istdBase === 0x0fff ? null : istdBase, ilfo });
    }
  } catch {
    // What was read before the fault is kept.
  }
  return styles;
}

/** Whether a style, or one it is based on, puts a paragraph in a list. */
function styleIsList(styles: readonly StyleInfo[], istd: number): boolean {
  let current: number | null = istd;
  for (let depth = 0; current !== null && depth < 16; depth += 1) {
    const style: StyleInfo | undefined = styles[current];
    if (!style) return false;
    if (style.ilfo !== null) return style.ilfo > 0;
    current = style.base;
  }
  return false;
}

/**
 * Looks up a paragraph's properties by the stream offset of its paragraph
 * mark: the bin table points at a 512-byte page (an FKP) of paragraph runs,
 * and each run carries a style and a list of property changes (sprms). What
 * matters here: the list a paragraph belongs to — its own, or its style's —
 * whether it is in a table, whether it ends a table row, and its style.
 *
 * Any inconsistency in the file makes this answer "unknown" rather than fail
 * the read: losing the bullets is better than losing the resume.
 */
function paragraphPropertyReader(
  word: Uint8Array,
  tv: DataView,
  fcPlcf: number,
  lcbPlcf: number,
  styles: readonly StyleInfo[],
): (fc: number) => ParagraphProps | null {
  const resolve = (istd: number, sprms: Sprms): ParagraphProps => ({
    isListItem: sprms.ilfo !== null ? sprms.ilfo > 0 : styleIsList(styles, istd),
    inTable: sprms.inTable,
    rowEnd: sprms.rowEnd,
    style: styles[istd]?.name ?? "",
  });
  const count = Math.floor((lcbPlcf - 4) / 8);
  if (count <= 0 || fcPlcf + lcbPlcf > tv.byteLength) return () => null;
  const fcs: number[] = [];
  for (let i = 0; i <= count; i += 1) fcs.push(tv.getUint32(fcPlcf + i * 4, true));
  const pages: number[] = [];
  for (let i = 0; i < count; i += 1) {
    pages.push(tv.getUint32(fcPlcf + (count + 1) * 4 + i * 4, true) & 0x3fffff);
  }
  const wv = viewOf(word);

  return (fc) => {
    try {
      let i = -1;
      for (let k = 0; k < count; k += 1) {
        if (fc >= fcs[k]! && fc < fcs[k + 1]!) {
          i = k;
          break;
        }
      }
      if (i < 0) return null;
      const page = pages[i]! * 512;
      if (page + 512 > word.length) return null;
      const crun = word[page + 511]!;
      let run = -1;
      for (let k = 0; k < crun; k += 1) {
        if (fc >= wv.getUint32(page + k * 4, true) && fc < wv.getUint32(page + (k + 1) * 4, true)) {
          run = k;
          break;
        }
      }
      if (run < 0) return null;
      const bOffset = word[page + (crun + 1) * 4 + run * 13]!;
      if (bOffset === 0) return resolve(0, { ilfo: null, inTable: false, rowEnd: false });
      let at = page + bOffset * 2;
      const cb = word[at]!;
      let length: number;
      if (cb !== 0) {
        length = cb * 2 - 1;
        at += 1;
      } else {
        length = word[at + 1]! * 2;
        at += 2;
      }
      // Two bytes of style index, then the property changes.
      const istd = wv.getUint16(at, true);
      return resolve(istd, readSprms(wv, at + 2, Math.min(at + length, page + 511)));
    } catch {
      return null;
    }
  };
}

const SPRM_P_ILFO = 0x460b;
const SPRM_P_F_IN_TABLE = 0x2416;
const SPRM_P_F_TTP = 0x2417;
const SPRM_P_F_INNER_TTP = 0x244c;
const SPRM_T_DEF_TABLE = 0xd608;
const SPRM_P_CHG_TABS = 0xc615;

function readSprms(wv: DataView, from: number, to: number): Sprms {
  const props: Sprms = { ilfo: null, inTable: false, rowEnd: false };
  let at = from;
  while (at + 2 <= to) {
    const sprm = wv.getUint16(at, true);
    const operand = at + 2;
    let size: number;
    switch (sprm >> 13) {
      case 0:
      case 1:
        size = 1;
        break;
      case 2:
      case 4:
      case 5:
        size = 2;
        break;
      case 3:
        size = 4;
        break;
      case 7:
        size = 3;
        break;
      default:
        if (sprm === SPRM_T_DEF_TABLE) size = 2 + wv.getUint16(operand, true) - 1;
        else if (sprm === SPRM_P_CHG_TABS && wv.getUint8(operand) === 255) return props;
        else size = 1 + wv.getUint8(operand);
    }
    if (sprm === SPRM_P_ILFO) props.ilfo = wv.getInt16(operand, true);
    if (sprm === SPRM_P_F_IN_TABLE) props.inTable = wv.getUint8(operand) === 1;
    if ((sprm === SPRM_P_F_TTP || sprm === SPRM_P_F_INNER_TTP) && wv.getUint8(operand) === 1) {
      props.rowEnd = true;
    }
    at = operand + size;
  }
  return props;
}

/**
 * Characters to paragraph tokens, for the binary format.
 *
 * Paragraphs end at a paragraph mark (13), a cell mark (7), or a page,
 * section or column break. Field instructions — the `HYPERLINK "…"` half of
 * a link — are dropped and the text the field displays is kept, which is
 * what a reader of the page sees. Objects, drawings and note references have
 * no text.
 *
 * A cell mark counts as one only when the paragraph's properties say it is
 * in a table. Without them (Word 95, or properties that would not parse) it
 * is an ordinary paragraph end, so nothing can be joined that should not be.
 */
function tokenize(
  characters: Iterable<{ code: number; fc: number }>,
  propsAt: (fc: number) => ParagraphProps | null,
): Token[] {
  const tokens: Token[] = [];
  let text = "";
  const fields: boolean[] = [];

  const end = (fc: number, cellMark: boolean) => {
    const props = propsAt(fc);
    const inTable = props?.inTable ?? false;
    pushParagraph(tokens, text, {
      style: props?.style ?? "",
      isListItem: props?.isListItem ?? false,
      inTable,
      cellEnd: cellMark && inTable && !(props?.rowEnd ?? false),
      rowEnd: cellMark && inTable && (props?.rowEnd ?? false),
    });
    text = "";
  };

  for (const { code, fc } of characters) {
    if (code === 0x13) fields.push(true);
    else if (code === 0x14) {
      if (fields.length > 0) fields[fields.length - 1] = false;
    } else if (code === 0x15) fields.pop();
    else if (code === 0x0d || code === 0x0c || code === 0x0e) end(fc, false);
    else if (code === 0x07) end(fc, true);
    else if (fields.some((instruction) => instruction)) continue;
    else if (code === 0x0b) text += LINE_BREAK;
    else if (code === 0x09 || code === 0xa0) text += " ";
    else if (code === 0x1e) text += "-";
    else if (code >= 0x20) text += String.fromCharCode(code);
  }
  if (text.trim()) pushParagraph(tokens, text, NO_FLAGS);
  return tokens;
}

const NO_FLAGS = {
  style: "",
  isListItem: false,
  inTable: false,
  cellEnd: false,
  rowEnd: false,
} as const;

/** Windows-1252's 0x80–0x9F, the one range where it differs from Latin-1. */
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152,
  0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122,
  0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

function cp1252(byte: number): number {
  return byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80]! : byte;
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return Array.from(bytes, (b) => String.fromCharCode(cp1252(b))).join("");
  }
}

/* -------------------------------------------------------------------------- */
/* RTF                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Groups whose content is not body text: tables of fonts and colours,
 * metadata, pictures, headers and footers, field instructions. Any group
 * opened with `\*` is skipped as well, which the format reserves for exactly
 * this — content a reader that does not know it may ignore.
 */
const RTF_SKIP = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
  "footnote",
  "annotation",
  "fldinst",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "generator",
  "themedata",
  "colorschememapping",
  "datastore",
  "latentstyles",
  "xmlnstbl",
  "revtbl",
  "filetbl",
  "pgdsctbl",
  "nonshppict",
  "pnseclvl",
  "pntxta",
  "pntxtb",
]);

const RTF_SYMBOLS: Record<string, string> = {
  emdash: "—",
  endash: "–",
  bullet: "•",
  lquote: "‘",
  rquote: "’",
  ldblquote: "“",
  rdblquote: "”",
  emspace: " ",
  enspace: " ",
  qmspace: " ",
};

function readRtf(bytes: Uint8Array): DocxParagraph[] {
  let source = "";
  for (let i = 0; i < bytes.length; i += 1) source += String.fromCharCode(bytes[i]!);

  interface GroupState {
    skip: boolean;
    uc: number;
    /** The font in use, whose character set decides what a `'hh` byte is. */
    font: number | null;
    /** Inside `onttbl`, where fonts are defined rather than text written. */
    fontTable: boolean;
  }
  const initial: GroupState = { skip: false, uc: 1, font: null, fontTable: false };
  const stack: GroupState[] = [];
  let group: GroupState = initial;
  const tokens: Token[] = [];
  let text = "";
  let codePage = 1252;
  let defaultFont: number | null = null;
  // Each font's character set, from the font table. Word writes "Ł" as the
  // byte A3 in a Central European font, which is "£" in any other.
  const fontCharsets = new Map<number, number>();
  let definingFont: number | null = null;
  let hexBytes: number[] = [];
  let pendingSkip = 0;
  // Paragraph properties last until `\pard`; a `\listtext` group marks only
  // the paragraph it is in.
  let paraList = false;
  let paraInTable = false;
  let listText = false;
  // True between a `{` and the first thing in its group, which is where a
  // destination names itself.
  let groupStart = false;

  const flushHex = () => {
    if (hexBytes.length === 0) return;
    const charset = fontCharsets.get(group.font ?? defaultFont ?? -1);
    text += decodeBytes(hexBytes, charsetCodePage(charset) ?? codePage);
    hexBytes = [];
  };
  const emit = (chars: string) => {
    if (group.skip) return;
    if (pendingSkip > 0) {
      pendingSkip -= 1;
      return;
    }
    flushHex();
    text += chars;
  };
  const end = (cellEnd: boolean, rowEnd: boolean) => {
    flushHex();
    pushParagraph(tokens, text, {
      style: "",
      isListItem: paraList || listText,
      inTable: paraInTable,
      cellEnd: cellEnd && !rowEnd,
      rowEnd,
    });
    text = "";
    listText = false;
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === "{" || ch === "}") {
      flushHex();
      if (ch === "{") {
        stack.push(group);
        group = { ...group };
      } else {
        group = stack.pop() ?? initial;
      }
      groupStart = ch === "{";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch !== "\\") {
      groupStart = false;
      emit(ch);
      i += 1;
      continue;
    }

    const next = source[i + 1] ?? "";
    if (next === "'") {
      const byte = parseInt(source.slice(i + 2, i + 4), 16);
      i += 4;
      groupStart = false;
      if (group.skip) continue;
      if (pendingSkip > 0) {
        pendingSkip -= 1;
        continue;
      }
      if (!Number.isNaN(byte)) hexBytes.push(byte);
      continue;
    }
    if (next === "*") {
      group.skip = true;
      i += 2;
      continue;
    }
    if (!/[a-zA-Z]/.test(next)) {
      i += 2;
      groupStart = false;
      if (next === "\\" || next === "{" || next === "}") emit(next);
      else if (next === "~") emit(" ");
      else if (next === "_") emit("-");
      else if ((next === "\n" || next === "\r") && !group.skip) end(false, false);
      continue;
    }

    const match = /^([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(i + 1, i + 48));
    const word = match?.[1] ?? "";
    const param = match?.[2] === undefined ? null : Number(match[2]);
    i += 1 + (match?.[0].length ?? 1);
    const opensGroup = groupStart;
    groupStart = false;

    if (word === "bin") {
      i += Math.max(0, param ?? 0);
      continue;
    }
    if (opensGroup && (word === "pntext" || word === "listtext")) {
      // The bullet a list paragraph shows to readers that do not understand
      // Word's lists. Its presence is the signal; its content is the glyph.
      if (!group.skip) listText = true;
      group.skip = true;
      continue;
    }
    if (opensGroup && word === "fonttbl") {
      group.skip = true;
      group.fontTable = true;
      continue;
    }
    if (group.fontTable) {
      if (word === "f" && param !== null) definingFont = param;
      else if (word === "fcharset" && param !== null && definingFont !== null) {
        fontCharsets.set(definingFont, param);
      }
      continue;
    }
    if (opensGroup && RTF_SKIP.has(word)) {
      group.skip = true;
      continue;
    }
    if (word === "deff" && param !== null) defaultFont = param;
    if (group.skip) continue;

    switch (word) {
      case "f":
        flushHex();
        group.font = param;
        break;
      case "plain":
        flushHex();
        group.font = null;
        break;
      case "par":
      case "sect":
      case "page":
        end(false, false);
        break;
      case "line":
        emit(LINE_BREAK);
        break;
      case "cell":
      case "nestcell":
        end(true, false);
        break;
      case "row":
      case "nestrow":
        end(false, true);
        break;
      case "pard":
        paraList = false;
        paraInTable = false;
        break;
      case "intbl":
        paraInTable = true;
        break;
      case "ls":
        if (param !== null && param > 0) paraList = true;
        break;
      case "tab":
        emit(" ");
        break;
      case "u":
        if (param !== null) {
          emit(String.fromCharCode(param < 0 ? param + 65536 : param));
          pendingSkip = group.uc;
        }
        break;
      case "uc":
        if (param !== null) group.uc = param;
        break;
      case "ansicpg":
        if (param !== null) codePage = param;
        break;
      default: {
        const symbol = RTF_SYMBOLS[word];
        if (symbol) emit(symbol);
      }
    }
  }
  flushHex();
  if (text.trim()) pushParagraph(tokens, text, NO_FLAGS);
  return assemble(tokens);
}

/** An RTF font character set (`\fcharset`) as a Windows code page. */
const CHARSET_CODE_PAGES: Readonly<Record<number, number>> = {
  0: 1252,
  77: 10000,
  128: 932,
  129: 949,
  134: 936,
  136: 950,
  161: 1253,
  162: 1254,
  163: 1258,
  177: 1255,
  178: 1256,
  186: 1257,
  204: 1251,
  222: 874,
  238: 1250,
};

function charsetCodePage(charset: number | undefined): number | undefined {
  return charset === undefined ? undefined : CHARSET_CODE_PAGES[charset];
}

/** Code pages the Encoding Standard names differently from `windows-N`. */
const CODE_PAGE_LABELS: Readonly<Record<number, string>> = {
  932: "shift_jis",
  936: "gbk",
  949: "euc-kr",
  950: "big5",
  10000: "macintosh",
};

function decodeBytes(bytes: number[], codePage: number): string {
  if (codePage !== 1252 && typeof TextDecoder !== "undefined") {
    try {
      const label = CODE_PAGE_LABELS[codePage] ?? `windows-${codePage}`;
      return new TextDecoder(label).decode(new Uint8Array(bytes));
    } catch {
      // An unknown code page falls through to Windows-1252, which is right
      // for every Western European resume and wrong only by a character for
      // the rest.
    }
  }
  return bytes.map((b) => String.fromCharCode(cp1252(b))).join("");
}

/* -------------------------------------------------------------------------- */
/* HTML                                                                        */
/* -------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  middot: "·",
  bull: "•",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** Marks a line as a list item between the tag pass and the split into lines. */
const LIST_MARK = "\u0001";

function readHtml(bytes: Uint8Array): DocxParagraph[] {
  const body = decodeText(bytes)
    // A line break in HTML source is a space. Word wraps its output at about
    // 80 columns, mid-sentence, so only the tags below may end a line.
    .replace(/[ \t\r\n\f]+/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|script|style|xml|title)\b[\s\S]*?<\/\1>/gi, "")
    // Word marks a list paragraph with an `mso-list` style; a builder uses `<li>`.
    .replace(/<p\b[^>]*mso-list:\s*l\d[^>]*>/gi, `\n${LIST_MARK}`)
    .replace(/<li\b[^>]*>/gi, `\n${LIST_MARK}`)
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/table|\/ul|\/ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name.startsWith("#")) {
        const hex = name[1] === "x" || name[1] === "X";
        const code = hex ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    });

  return assemble(
    body.split("\n").map((line) => ({
      ...NO_FLAGS,
      text: line.replaceAll(LIST_MARK, ""),
      isListItem: line.includes(LIST_MARK),
    })),
  );
}
