/**
 * The builder loads what it draws, and nothing it only needs on a click.
 *
 * ## What this stops
 *
 * On 2026-10-01 `pnpm qa:budget` had the builder over its three-second
 * budget, and the static import graph from `BuilderShell` showed why it was
 * heavier than it needed to be: it reached react-pdf (a main-thread copy, for
 * a fallback the render worker makes rare), the `docx` library (for the Word
 * button), and the resume importer with pdfjs's text layer and libphonenumber
 * (for a file nobody had chosen). Each is now an `import()` at the moment it
 * is needed. This keeps it that way: one convenient static import puts any of
 * them back, with no error and a build that still passes.
 *
 * pdfjs itself is allowed: the preview canvas draws with it on every open.
 */

import { describe, expect, it } from "vitest";
import { importGraph } from "@/test/import-graph";

/** Loaded on demand, never with the builder. */
const ON_DEMAND_PACKAGES = ["@react-pdf/renderer", "docx", "mammoth", "fflate", "libphonenumber-js"];

const ON_DEMAND_MODULES = [
  "src/lib/emit/pdf/render.ts",
  "src/lib/emit/docx/render.ts",
  "src/lib/import/parse-resume.ts",
  "src/lib/xray/extract-browser.ts",
  "src/lib/xray/scorecard.ts",
];

describe("the builder's static import graph", () => {
  const graph = importGraph("src/components/builder/BuilderShell.tsx");

  it("reaches none of the libraries that are only needed on a click", () => {
    const reached = ON_DEMAND_PACKAGES.filter((name) => graph.packages.has(name)).map(
      (name) => `${name} via ${graph.packages.get(name)!.join(" > ")}`,
    );
    expect(reached, "load these with import() at the point of use").toEqual([]);
  });

  it("reaches none of our modules built on them", () => {
    expect(ON_DEMAND_MODULES.filter((file) => graph.modules.has(file))).toEqual([]);
  });

  it("still walks into the builder — a walk that stops at the entry passes silently", () => {
    expect(graph.modules.size).toBeGreaterThan(60);
    expect(graph.modules.has("src/components/preview/PreviewPane.tsx")).toBe(true);
    expect(graph.packages.has("pdfjs-dist")).toBe(true);
  });
});
