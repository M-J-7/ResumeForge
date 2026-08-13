/**
 * Glyph coverage.
 *
 * The cheapest high-value test in the project. A missing glyph renders as an
 * empty box in the user's own name — an unrecoverable trust failure, and one
 * that reaches production silently because development happens with ASCII
 * names. Subsetting (scripts/fetch-fonts.mjs) makes the risk real rather than
 * theoretical, so this test guards the subset.
 */

import { describe, expect, it } from "vitest";
// fontkit v2 is named-exports only — it has no default export.
import { create, type Font } from "fontkit";
import { REQUIRED_GLYPHS, charsetCodePoints } from "./charset";
import { allFontFiles } from "./files";
import { readFontFile } from "./paths.node";

function openFont(fileName: string): Font {
  const font = create(readFontFile(fileName));
  if (!("hasGlyphForCodePoint" in font)) {
    throw new Error(`${fileName} is a font collection, not a single font`);
  }
  return font;
}

const files = allFontFiles();

describe("vendored font files", () => {
  it("ships four styles for each of the five pairs", () => {
    expect(files).toHaveLength(20);
  });

  it.each(files.map((f) => f.file))("%s parses as a valid font", (fileName) => {
    expect(() => openFont(fileName)).not.toThrow();
  });
});

describe("required glyph coverage", () => {
  for (const { file } of files) {
    describe(file, () => {
      const font = openFont(file);

      // Both tuple entries feed the test name; only the character is asserted.
      it.each(REQUIRED_GLYPHS.map((g) => [g.char, g.note] as const))("renders %s (%s)", (char) => {
        const codePoint = char.codePointAt(0);
        expect(codePoint).toBeDefined();
        expect(font.hasGlyphForCodePoint(codePoint as number)).toBe(true);
      });
    });
  }
});

describe("declared charset coverage", () => {
  /**
   * The charset ranges are what we *claim* to support. Source fonts do not all
   * cover every range completely, so this reports a coverage ratio rather than
   * demanding perfection — while the per-character test above stays strict
   * about the characters we actually promise.
   */
  it.each(files.map((f) => f.file))("%s covers most of the declared charset", (fileName) => {
    const font = openFont(fileName);
    const points = charsetCodePoints();
    const covered = points.filter((cp) => font.hasGlyphForCodePoint(cp)).length;
    const ratio = covered / points.length;
    expect(ratio).toBeGreaterThan(0.5);
  });
});
