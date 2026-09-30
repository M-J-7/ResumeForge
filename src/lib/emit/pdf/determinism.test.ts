/**
 * `pdfContentFingerprint` is blind to the compressor and to nothing else.
 *
 * It exists for comparisons across machines — the template gallery's pictures
 * are pinned on one and checked on another — where the same page can deflate
 * to different bytes. These cases prove both halves of that on a real render:
 * recompressing every stream, which is what a different zlib amounts to,
 * leaves it alone, and a change a reader could see does not.
 */

import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { nodeFontResolver } from "@/lib/fonts/paths.node";
import { midCareerResume } from "@/test/fixtures/resumes";
import type { ResumeDocument } from "@/lib/resume/schema";
import { pdfContentFingerprint, pdfFingerprint } from "./determinism";
import { renderPdf } from "./render";

async function render(resume: ResumeDocument): Promise<Uint8Array> {
  return (await renderPdf(resume, { resolveFont: nodeFontResolver })).bytes;
}

/**
 * The same PDF with every Flate stream re-deflated at another level, and its
 * `/Length` rewritten to match — the file a differently built zlib would
 * have produced from the same document. Offsets in the xref go stale, which
 * both fingerprints discard anyway.
 */
function recompressed(bytes: Uint8Array): Uint8Array {
  const raw = Buffer.from(bytes).toString("latin1");
  // pdfkit writes one dictionary entry per line.
  const stream = /\/Length (\d+)\n\/Filter \/FlateDecode\n>>\nstream\n/g;
  let out = "";
  let from = 0;
  let match: RegExpExecArray | null;
  while ((match = stream.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = start + Number(match[1]);
    const inflated = inflateSync(Buffer.from(raw.slice(start, end), "latin1"));
    const again = deflateSync(inflated, { level: 1 }).toString("latin1");
    out += raw.slice(from, match.index);
    out += `/Length ${again.length}\n/Filter /FlateDecode\n>>\nstream\n${again}`;
    from = end;
    stream.lastIndex = end;
  }
  return Buffer.from(out + raw.slice(from), "latin1");
}

describe("pdfContentFingerprint", () => {
  it("agrees on two renders of one document", async () => {
    const resume = midCareerResume;
    expect(pdfContentFingerprint(await render(resume))).toBe(
      pdfContentFingerprint(await render(resume)),
    );
  });

  it("does not see how the streams were compressed", async () => {
    const bytes = await render(midCareerResume);
    const other = recompressed(bytes);

    // The premise: the bytes really did change, enough that the stricter
    // fingerprint tells the two apart.
    expect(Buffer.from(other).equals(Buffer.from(bytes))).toBe(false);
    expect(pdfFingerprint(other)).not.toBe(pdfFingerprint(bytes));

    expect(pdfContentFingerprint(other)).toBe(pdfContentFingerprint(bytes));
  });

  it("sees a change a reader would see", async () => {
    const resume = midCareerResume;
    const recoloured: ResumeDocument = {
      ...resume,
      settings: { ...resume.settings, accent: "#7C2D12" },
    };
    expect(recoloured.settings.accent).not.toBe(resume.settings.accent);
    expect(pdfContentFingerprint(await render(recoloured))).not.toBe(
      pdfContentFingerprint(await render(resume)),
    );
  });
});
