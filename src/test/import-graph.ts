/**
 * A walk of the static import graph from one source file.
 *
 * The same walk `src/app/site-weight.test.ts` does for the public pages,
 * shared here for tests written after it. It is copied rather than imported
 * because that file is a test, and existing test files are not edited to
 * share their helpers (IMPLEMENTATION.md §2.3) — the same reason
 * `src/test/claims.ts` exists.
 *
 * `import type` and type-only specifiers are skipped (the compiler erases
 * them), and so is `import()`: a dynamic import is exactly the boundary these
 * tests ask for.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

/** The specifiers a module imports statically, erased and dynamic ones skipped. */
export function staticImports(source: string): string[] {
  const found: string[] = [];
  const fromClause = /^\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm;
  for (const match of source.matchAll(fromClause)) {
    const [, , typeKeyword, clause, specifier] = match;
    if (typeKeyword) continue;
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
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push(match[1]!);
  return found;
}

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

export interface ImportGraph {
  /** Every local module reached, as repository-relative paths with `/`. */
  readonly modules: ReadonlySet<string>;
  /** Every package reached, with the chain of local files that led to it. */
  readonly packages: ReadonlyMap<string, readonly string[]>;
}

const relative = (file: string) => path.relative(ROOT, file).replaceAll("\\", "/");

export function importGraph(entry: string): ImportGraph {
  const modules = new Set<string>();
  const packages = new Map<string, string[]>();
  const queue: { file: string; chain: string[] }[] = [
    { file: path.join(ROOT, entry), chain: [relative(path.join(ROOT, entry))] },
  ];

  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    const name = relative(file);
    if (modules.has(name)) continue;
    modules.add(name);
    if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue;

    for (const specifier of staticImports(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
        const pkg = packageName(specifier);
        if (!packages.has(pkg)) packages.set(pkg, chain);
        continue;
      }
      const resolved = resolveLocal(file, specifier);
      if (resolved) queue.push({ file: resolved, chain: [...chain, relative(resolved)] });
    }
  }

  return { modules, packages };
}
