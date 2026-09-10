/**
 * Vendors the local enhancement model into `public/`, so the browser fetches
 * it from this app's own origin and from nowhere else.
 *
 * ## Why this script has to exist
 *
 * The Content Security Policy is `connect-src 'self' blob: data:`. That is
 * deliberate and it is one of the product's load-bearing promises — there is
 * no endpoint this app can talk to except itself, which is what makes "no
 * telemetry" structural rather than a pledge (see `next.config.ts`).
 *
 * Transformers.js defaults to fetching model files from `huggingface.co`.
 * Under that policy the fetch is **blocked**, so the Enhance feature could
 * never have worked in a production build: the download fails, the error
 * path fires, and the user is told the feature is unavailable — forever, on
 * every device, with no indication why.
 *
 * Serving the files ourselves fixes that, and it is also what the feature
 * plan asked for in the first place: *"The only possible feature network
 * request is the one-time static model download from the app's configured
 * asset origin."* It is the better privacy answer as well — a third-party
 * host never sees the IP address of somebody writing a cover letter.
 *
 * ## Why it is not part of `prebuild`
 *
 * ~120MB on disk, ~100MB on the wire (measured, QA.md §11). Making every
 * `pnpm build` and every CI run pay for that would be
 * indefensible for an optional feature most users never press. So this is a
 * deliberate step for a deployment that wants Enhance, and the app degrades
 * honestly without it: `isEnhancementSupported()` probes for the files, and
 * the editor says the feature is unavailable on this deployment while
 * Recompose keeps working exactly as before.
 *
 * ## Pinned, and verified
 *
 * Every file is fetched at the immutable commit in `LOCAL_ENHANCEMENT_MODEL`,
 * never from `main`. The digest of each download is printed so a deployment
 * can record what it shipped.
 *
 *   pnpm enhance:fetch
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

/**
 * Kept in step with `src/lib/cover-letter/enhance.browser.ts` by a test.
 * Two places naming one revision is two places that will disagree.
 */
const MODEL_ID = "Xenova/flan-t5-small";
const REVISION = "ec15bc2d425022b2de62f639b15cfea4bd9b8b3b";

/**
 * Exactly the files the `q8` text2text pipeline opens, and no others.
 *
 * The repository also holds fp32 and fp16 weights — together well over half a
 * gigabyte — and the unquantized decoder variants. Fetching the lot "to be
 * safe" would quadruple the download for files that are never read.
 */
const FILES = [
  "config.json",
  "generation_config.json",
  "special_tokens_map.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "spiece.model",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

const TARGET_DIR = path.join(ROOT, "public", "models", MODEL_ID);

/**
 * The ONNX Runtime, copied out of the installed package.
 *
 * ## Every `ort-*` file, not a named one
 *
 * `env.backends.onnx.wasm.wasmPaths = "/ort/"` relocates a **directory**, and
 * ONNX Runtime Web loads two things from it: the `.wasm` binary and the
 * `.mjs` glue module that instantiates it. An earlier version of this script
 * copied only the binary, which meant `/ort/ort-wasm-simd-threaded.jsep.mjs`
 * 404ed — after the browser had already downloaded 96MB of weights — and the
 * user was told "Local enhancement is unavailable right now". The feature had
 * never once run.
 *
 * A pattern rather than a list, because the failure was a hand-maintained
 * list falling one file behind the runtime. An ONNX upgrade that splits the
 * build again is then vendored automatically instead of silently breaking the
 * feature, and `enhance.hosting.test.ts` asserts the pattern still covers
 * everything the installed package ships.
 */
const ORT_SOURCE_DIR = path.join(ROOT, "node_modules", "@huggingface", "transformers", "dist");
export const ORT_RUNTIME_PATTERN = /^ort-.*\.(mjs|wasm)$/;
const ORT_TARGET_DIR = path.join(ROOT, "public", "ort");

function megabytes(bytes) {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

async function download(file) {
  const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${file}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(TARGET_DIR, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);

  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  console.log(`  ${file.padEnd(44)} ${megabytes(bytes.length).padStart(8)}  sha256:${digest}`);
  return bytes.length;
}

console.log(`Fetching ${MODEL_ID} at ${REVISION.slice(0, 8)} into public/models/…`);

let total = 0;
try {
  for (const file of FILES) total += await download(file);
} catch (error) {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(
    "Nothing else changed. The app still builds and runs; Enhance stays unavailable\n" +
      "and the deterministic Recompose is unaffected.",
  );
  process.exit(1);
}

// The runtime must be same-origin for the same CSP reason the weights are:
// Transformers.js otherwise loads it from a CDN, which `connect-src 'self'`
// blocks.
await mkdir(ORT_TARGET_DIR, { recursive: true });
const runtimeFiles = (await readdir(ORT_SOURCE_DIR)).filter((name) =>
  ORT_RUNTIME_PATTERN.test(name),
);
if (runtimeFiles.length === 0) {
  console.error(
    `\nFound no ONNX runtime files in ${ORT_SOURCE_DIR}.\n` +
      "Enhance cannot work without them. Is @huggingface/transformers installed?",
  );
  process.exit(1);
}

let runtimeBytes = 0;
for (const name of runtimeFiles) {
  const bytes = await readFile(path.join(ORT_SOURCE_DIR, name));
  await writeFile(path.join(ORT_TARGET_DIR, name), bytes);
  runtimeBytes += bytes.length;
  console.log(`  ${`ort/${name}`.padEnd(44)} ${megabytes(bytes.length).padStart(8)}`);
}

console.log(`\nDone — ${megabytes(total + runtimeBytes)} in public/models and public/ort.`);
console.log("Both are gitignored. Re-run this after a fresh clone or a model revision change.");
