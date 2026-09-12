import { describe, expect, it } from "vitest";
import {
  AA_CONTRAST_MINIMUM,
  contrastAgainstWhite,
  contrastRatio,
  meetsAccentContrast,
  parseHexColor,
  relativeLuminance,
} from "./contrast";

describe("parseHexColor", () => {
  it("parses six-digit hex", () => {
    expect(parseHexColor("#1F2937")).toEqual({ r: 0x1f, g: 0x29, b: 0x37 });
  });

  it("parses three-digit shorthand by doubling each digit", () => {
    expect(parseHexColor("#0af")).toEqual({ r: 0x00, g: 0xaa, b: 0xff });
  });

  it("is case-insensitive", () => {
    expect(parseHexColor("#abcdef")).toEqual(parseHexColor("#ABCDEF"));
  });

  it("returns null for anything that is not a hex colour", () => {
    for (const input of ["red", "#12345", "#gggggg", "1F2937", ""]) {
      expect(parseHexColor(input)).toBeNull();
    }
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white and 0 for black", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it("weighs green highest and blue lowest, per the WCAG coefficients", () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("is 21 between pure black and pure white", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it("is 1 for a colour against itself", () => {
    const grey = { r: 128, g: 128, b: 128 };
    expect(contrastRatio(grey, grey)).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = { r: 30, g: 90, b: 200 };
    const b = { r: 240, g: 240, b: 230 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe("contrastAgainstWhite", () => {
  it("matches the known ratio for the default accent, #1F2937", () => {
    // A dark slate against white — comfortably AA, the value this app has
    // shipped with since M0. If this regresses, the default itself broke.
    expect(contrastAgainstWhite("#1F2937")).toBeGreaterThan(12);
  });

  it("is null for a string that never reaches the schema's hex validator", () => {
    expect(contrastAgainstWhite("not-a-colour")).toBeNull();
  });

  it("is low for a colour close to white", () => {
    expect(contrastAgainstWhite("#F5F5F5")).toBeLessThan(1.2);
  });
});

describe("meetsAccentContrast — the picker's actual gate", () => {
  it("accepts the default accent", () => {
    expect(meetsAccentContrast("#1F2937")).toBe(true);
  });

  it("rejects a pale yellow that would be nearly invisible on the page", () => {
    // The failure mode this whole module exists to catch: a colour that
    // looks fine in a small swatch and vanishes once it is the accent on a
    // white resume page.
    expect(meetsAccentContrast("#FDF6B2")).toBe(false);
  });

  it("rejects an invalid colour rather than throwing", () => {
    expect(meetsAccentContrast("chartreuse")).toBe(false);
  });

  it("sits exactly on the documented AA floor", () => {
    expect(AA_CONTRAST_MINIMUM).toBe(4.5);
  });
});
