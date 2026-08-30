/**
 * Copies the vendored font files into `public/fonts/` so the browser can
 * fetch them by URL.
 *
 * The PDF emitter needs the same font binaries in two very different places.
 * Under Node (tests, any server-side render) it reads them off disk from
 * `src/lib/fonts/files/`. In the browser — where the preview renders the real
 * PDF, per D2 — react-pdf loads each face over HTTP, so the files have to be
 * reachable at a stable URL.
 *
 * They are copied rather than committed twice: `public/fonts/` is generated
 * and gitignored, so the ~2.8MB of fonts lives in the repository exactly once.
 * `predev` and `prebuild` run this, so a fresh clone needs no extra step.
 */

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(HERE, "..", "src", "lib", "fonts", "files");
const TARGET_DIR = path.join(HERE, "..", "public", "fonts");

const files = (await readdir(SOURCE_DIR)).filter((name) => name.endsWith(".ttf"));

if (files.length === 0) {
  console.error(
    `No .ttf files in ${SOURCE_DIR}. Run \`pnpm fonts:fetch\` first — the app cannot render a PDF without them.`,
  );
  process.exit(1);
}

// Removed first so a font dropped from the registry does not linger in
// `public/` and get served indefinitely.
await rm(TARGET_DIR, { recursive: true, force: true });
await mkdir(TARGET_DIR, { recursive: true });

for (const name of files) {
  await cp(path.join(SOURCE_DIR, name), path.join(TARGET_DIR, name));
}

// pdfjs refuses to run in a browser without a worker script, and there is no
// default it can guess. Serving it from a fixed path keeps it independent of
// how any given bundler decides to emit worker assets.
const PDF_WORKER = "pdf.worker.min.mjs";
const pdfWorkerSource = path.join(
  HERE,
  "..",
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  PDF_WORKER,
);
const publicDir = path.join(HERE, "..", "public");
await cp(pdfWorkerSource, path.join(publicDir, PDF_WORKER));

console.log(`Synced ${files.length} font files to public/fonts/ and ${PDF_WORKER}`);
