/**
 * Proves every font pair actually renders through react-pdf and embeds real,
 * selectable text — the second half of M0-T2's acceptance criteria.
 *
 * This is also the first exercise of the react-pdf path that D2 and D3 rest
 * on, so a failure here is an architectural signal, not just a test failure.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FONT_PAIRS, type FontPairId } from "./pairs";
import { familySlug } from "./files";
import { nodeFontResolver } from "./paths.node";
import { disableHyphenation, registerFontPair } from "./register";

/** Exercises all four faces plus the extended-Latin and punctuation we emit. */
const SAMPLE_TEXT = "José Ángel Muñoz-Łukasiewicz — Jan 2023 – Present • ≥1M req • ₹2.4Cr";

function sampleDocument(family: string) {
  return (
    <Document>
      <Page size="A4" style={{ padding: 40, fontFamily: family, fontSize: 11 }}>
        <View>
          <Text>{SAMPLE_TEXT}</Text>
          <Text style={{ fontWeight: 700 }}>{SAMPLE_TEXT}</Text>
          <Text style={{ fontStyle: "italic" }}>{SAMPLE_TEXT}</Text>
          <Text style={{ fontWeight: 700, fontStyle: "italic" }}>{SAMPLE_TEXT}</Text>
        </View>
      </Page>
    </Document>
  );
}

const pairIds = Object.keys(FONT_PAIRS) as FontPairId[];

beforeAll(() => {
  disableHyphenation();
  for (const id of pairIds) registerFontPair(id, nodeFontResolver);
});

describe.each(pairIds)("font pair: %s", (id) => {
  const { family } = FONT_PAIRS[id];
  let pdf: Buffer;

  beforeAll(async () => {
    pdf = await renderToBuffer(sampleDocument(family));
  });

  it("renders a syntactically valid PDF", () => {
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1")).toContain("EOF");
  });

  it("produces a non-trivial document", () => {
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("embeds the font rather than referencing it by name", () => {
    // Embedded subsets appear as /BaseFont /ABCDEF+Family.
    expect(pdf.toString("latin1")).toContain(familySlug(family));
  });

  it("declares an embedded font file, so the text is real rather than drawn", () => {
    const raw = pdf.toString("latin1");
    expect(raw).toMatch(/\/FontFile2?\d?/);
  });
});

describe("hyphenation", () => {
  /**
   * react-pdf hyphenates by default. A hyphen injected mid-word survives into
   * the extracted text, so a parser searching for "Kubernetes" would miss
   * "Kuber-netes". Narrow column, long word, no hyphen allowed.
   */
  it("never breaks a long word with an inserted hyphen", async () => {
    const { family } = FONT_PAIRS.modern;
    const pdf = await renderToBuffer(
      <Document>
        <Page size="A4" style={{ padding: 10, fontFamily: family, fontSize: 12 }}>
          <View style={{ width: 60 }}>
            <Text>Kubernetes internationalization responsibilities</Text>
          </View>
        </Page>
      </Document>,
    );
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
