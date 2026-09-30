/**
 * The public pages never statically reach the PDF machinery.
 *
 * ## What this stops
 *
 * On 2026-09-30 Lighthouse measured 975 KiB of script on a guide page, on a
 * throttled phone, and more than half of it was react-pdf (with its layout
 * engine and hyphenation tables) and pdfjs. A guide renders neither. They
 * arrived because `/check` and `/templates` imported them *statically* — the
 * parser for a file nobody had chosen yet, the thumbnail renderer for a
 * gallery — and `<Link>` prefetches the routes it points at, so every page
 * whose header links to those two paid for them in its first seconds. Main
 * thread blocked for 300–500ms on every content page; 1.8s on `/templates`.
 *
 * The fix was two dynamic imports. This test is what keeps it fixed: one
 * convenient `import { parseResumeFile } …` in a component a public page
 * renders puts all of it back, with no error, no warning, and a build that
 * still passes.
 *
 * ## How
 *
 * It walks the static import graph from every route file under `(site)` and
 * from the root layout, which every route shares. `import type` and type-only
 * specifiers are skipped (the compiler erases them), and so is `import()` —
 * a dynamic import is precisely the boundary this is asking for. Anything the
 * walk reaches that is on the list below fails the test, with the chain of
 * files that led there.
 *
 * Deliberately a source walk rather than a read of the build output: it runs
 * in the unit suite in a second, and it names the import that broke the rule
 * rather than a chunk hash.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

/** Packages that must only ever arrive through a dynamic import. */
const FORBIDDEN_PACKAGES = ["@react-pdf/renderer", "pdfjs-dist", "mammoth", "docx"];

/** Our own modules that pull those in, named so a failure says where. */
const FORBIDDEN_MODULES = [
  "src/lib/emit/pdf/render.ts",
  "src/lib/thumbnail/render.ts",
  "src/lib/xray/extract-browser.ts",
  "src/lib/import/parse-resume.ts",
].map((file) => path.join(ROOT, file));

function routeEntries(): string[] {
  const entries = [path.join(SRC, "app", "layout.tsx"), path.join(SRC, "app", "not-found.tsx")];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/^(page|layout|not-found|error|loading|template)\.tsx$/.test(name)) entries.push(full);
    }
  };
  walk(path.join(SRC, "app", "(site)"));
  return entries;
}

/**
 * Every statically imported specifier in a file, type-only ones excluded.
 *
 * A regex rather than a parser, on the same reasoning as `build-escape.test.ts`:
 * one codebase, one Prettier config, and a dependency on a TypeScript AST to
 * find import lines would be a worse trade. Anchored at the start of a line so
 * the examples inside doc comments (` * import …`) are not read as imports.
 */
export function staticImports(source: string): string[] {
  const found: string[] = [];

  const fromClause = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(fromClause)) {
    const [, , typeKeyword, clause, specifier] = match;
    if (typeKeyword) continue;
    // `import { type A, type B } from` is erased entirely; one value
    // specifier among them keeps it.
    const braces = /^\{([\s\S]*)\}$/.exec(clause!.trim());
    if (braces) {
      const names = braces[1]!
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (names.length > 0 && names.every((name) => name.startsWith("type "))) continue;
    }
    found.push(specifier!);
  }

  const sideEffect = /^\s*import\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(sideEffect)) found.push(match[1]!);

  return found;
}

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : path.resolve(path.dirname(from), specifier);
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

interface Violation {
  entry: string;
  reached: string;
  chain: string[];
}

function findViolations(entry: string): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [entry] }];

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    if (FORBIDDEN_MODULES.includes(file)) {
      violations.push({ entry, reached: file, chain });
      continue;
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;

    for (const specifier of staticImports(readFileSync(file, "utf8"))) {
      const local = specifier.startsWith(".") || specifier.startsWith("@/");
      if (!local) {
        const name = packageName(specifier);
        if (FORBIDDEN_PACKAGES.includes(name)) {
          violations.push({ entry, reached: specifier, chain });
        }
        continue;
      }
      const resolved = resolveLocal(file, specifier);
      if (resolved) queue.push({ file: resolved, chain: [...chain, resolved] });
    }
  }
  return violations;
}

const relative = (file: string) => path.relative(ROOT, file).replaceAll("\\", "/");

describe("the public pages' static import graph", () => {
  it("never reaches react-pdf, pdfjs or the modules built on them", () => {
    const violations = routeEntries().flatMap(findViolations);
    const report = violations.map(
      (v) =>
        `${relative(v.entry)} reaches ${v.reached.includes(ROOT) ? relative(v.reached) : v.reached}\n` +
        v.chain.map((file) => `    ${relative(file)}`).join("\n"),
    );
    expect(
      report,
      "load these with import() at the point of use — see the header of this file:\n" +
        report.join("\n"),
    ).toEqual([]);
  });

  it("finds the routes and walks into their components", () => {
    // A walk that silently stops at the entry files is a test that silently
    // passes.
    const entries = routeEntries();
    expect(entries.length).toBeGreaterThan(12);
    expect(entries.map(relative)).toContain("src/app/(site)/check/page.tsx");
  });

  it("reads the import forms this codebase uses, and skips the erased ones", () => {
    const source = [
      'import { a } from "@/one";',
      'import type { B } from "@/two";',
      'import { type C, type D } from "@/three";',
      'import { type E, f } from "@/four";',
      'import "@/five";',
      'export { g } from "./six";',
      "export type { H } from './seven';",
      'const lazy = () => import("@/eight");',
      ' * import { nope } from "@/in-a-comment";',
      "import {",
      "  multi,",
      "  line,",
      '} from "@/nine";',
    ].join("\n");
    expect(staticImports(source).sort()).toEqual(
      ["@/one", "@/four", "@/five", "./six", "@/nine"].sort(),
    );
  });

  it("catches a static import of a forbidden module", () => {
    // The rule, demonstrated on the builder, which is allowed and does it.
    const builder = path.join(SRC, "app", "builder", "page.tsx");
    expect(findViolations(builder).length).toBeGreaterThan(0);
  });
});
