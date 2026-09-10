/**
 * The feature's hosting contract, asserted against the files that implement it.
 *
 * ## The bug this suite exists because of
 *
 * The app's CSP is `connect-src 'self' blob: data:`, and Transformers.js
 * fetches weights from `huggingface.co` by default. Those two facts are in
 * different files written months apart, and together they meant Enhance could
 * never work in a production build: the download was blocked, the error path
 * fired, and the user was told the feature was unavailable — on every device,
 * with nothing anywhere saying why.
 *
 * Nothing caught it, because every unit test stubbed the model and the e2e
 * suite never pressed the button. So the relationship is asserted directly:
 * the policy, the runtime configuration and the vendoring script have to keep
 * agreeing, and this fails if any one of them moves.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

const ADAPTER = read("src/lib/cover-letter/enhance.browser.ts");
const SCRIPT = read("scripts/fetch-enhancement-model.mjs");
const CONFIG = read("next.config.ts");
const IGNORED = read(".gitignore");
const PACKAGE = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

/** The pinned commit, as each file spells it. */
const REVISION = /ec15bc2d425022b2de62f639b15cfea4bd9b8b3b/;

describe("the model is served from this origin and nowhere else", () => {
  it("forbids the library reaching a remote host", () => {
    // Not a preference — it removes the code path. With `connect-src 'self'`
    // there is then no configuration and no failure mode that sends a user's
    // cover letter to a third party.
    expect(ADAPTER).toContain("env.allowRemoteModels = false");
  });

  it("points the loader at a same-origin path", () => {
    expect(ADAPTER).toContain("env.localModelPath = LOCAL_MODEL_BASE");
    expect(ADAPTER).toContain('export const LOCAL_MODEL_BASE = "/models/"');
  });

  it("relocates the ONNX runtime to this origin too", () => {
    // The library otherwise loads it from a CDN, which the same policy blocks.
    expect(ADAPTER).toContain('wasmPaths = "/ort/"');
  });

  /**
   * ## The second bug this suite exists because of
   *
   * The first version of this test asserted that the fetch script contained
   * the string `"ort-wasm-simd-threaded.jsep.wasm"`. It did, and the feature
   * was still broken: `wasmPaths` relocates a *directory*, and ONNX Runtime
   * Web loads the `.mjs` glue module from it as well as the `.wasm` binary.
   * The script vendored one of the two, so every run downloaded 96MB of
   * weights and then 404ed on a 44KB loader.
   *
   * Asserting the presence of a string in a script is not asserting that the
   * script does the right thing. What is checked now is the set: every ONNX
   * runtime file the installed package ships has to be one the script would
   * copy, so an upgrade that adds or renames one fails here rather than in
   * somebody's browser.
   */
  it("vendors every ONNX runtime file the installed package ships", () => {
    const dist = path.join(ROOT, "node_modules", "@huggingface", "transformers", "dist");
    const shipped = readdirSync(dist).filter((name) => /^ort-/.test(name));

    // The package must actually carry a runtime; an empty set would make the
    // assertion below vacuously true.
    expect(shipped.length).toBeGreaterThan(0);
    expect(shipped).toContain("ort-wasm-simd-threaded.jsep.wasm");
    expect(shipped).toContain("ort-wasm-simd-threaded.jsep.mjs");

    // Exactly the rule in the script, kept here as a literal on purpose: this
    // test fails if the script's pattern narrows, which is the regression.
    const vendored = shipped.filter((name) => /^ort-.*\.(mjs|wasm)$/.test(name));
    expect(vendored.sort()).toEqual(shipped.sort());
    expect(SCRIPT).toContain("ORT_RUNTIME_PATTERN = /^ort-.*\\.(mjs|wasm)$/");
  });

  it("keeps the policy that makes all of the above necessary", () => {
    // If this directive ever gains a host, the reasoning above changes and
    // somebody should have to come and read this test to find that out.
    expect(CONFIG).toContain("\"connect-src 'self' blob: data:\"");
  });
});

describe("the backend", () => {
  /**
   * ## The third bug this suite exists because of
   *
   * The adapter used to prefer `device: "webgpu"` and fall back to WASM. The
   * §11 measured pass — the first time this model was ever run in a browser —
   * found the WebGPU path returning one byte-identical string for every input:
   * `"comunicat cabluvêtement this this this…"`. The encoder's output was not
   * reaching the decoder. int8 weights on ONNX Runtime Web's JSEP provider are
   * a known-bad pairing, and the guardrail hid it by rejecting the result as
   * "stopped mid-sentence" — a plausible message for a completely broken
   * backend.
   *
   * So the fast path is gone, and this is what stops it coming back on the
   * reasonable-sounding grounds that WebGPU is faster. It is; it is also
   * wrong here. Re-enabling it means running `pnpm qa:enhance` and *reading
   * the proposals*, not checking that nothing threw.
   */
  it("runs on WASM only, with no WebGPU path", () => {
    expect(ADAPTER).not.toContain('device: "webgpu"');
    expect(ADAPTER).not.toContain("hasUsableWebGpu");
    // The reasoning has to travel with the constraint.
    expect(ADAPTER).toContain("WASM only");
  });
});

describe("the pinned revision", () => {
  it("is the same commit in the adapter and in the fetch script", () => {
    // Two places naming one revision is two places that will disagree, and
    // the failure would be a model whose behaviour does not match its tests.
    expect(ADAPTER).toMatch(REVISION);
    expect(SCRIPT).toMatch(REVISION);
  });

  it("is a full commit hash, never a branch", () => {
    // `main` moves. A cover letter's wording should not change because
    // somebody else pushed to a model repository.
    expect(ADAPTER).not.toMatch(/revision:\s*["']main["']/);
    expect(SCRIPT).not.toMatch(/REVISION\s*=\s*["']main["']/);
  });
});

describe("the vendored files", () => {
  it("are gitignored rather than committed", () => {
    expect(IGNORED).toContain("/public/models/");
    expect(IGNORED).toContain("/public/ort/");
  });

  it("are fetched by an explicit command, not by every build", () => {
    // ~120MB on every `pnpm build` and every CI run, for a feature most users
    // never press, would be indefensible. The app degrades instead.
    expect(PACKAGE.scripts["enhance:fetch"]).toBe("node scripts/fetch-enhancement-model.mjs");
    expect(PACKAGE.scripts.prebuild).not.toContain("enhance");
    expect(PACKAGE.scripts.predev).not.toContain("enhance");
  });

  it("are probed at runtime, so a build without them says so", () => {
    expect(ADAPTER).toContain("isEnhancementInstalled");
    const editor = read("src/components/letters/LetterEditor.tsx");
    expect(editor).toContain("isEnhancementInstalled");
    expect(editor).toContain("does not ship the local enhancement model");
  });

  it("fetches only the quantized weights the pipeline actually opens", () => {
    // The repository also holds fp32 and fp16 variants — over half a gigabyte
    // together — that `dtype: "q8"` never reads.
    expect(SCRIPT).toContain("onnx/encoder_model_quantized.onnx");
    expect(SCRIPT).toContain("onnx/decoder_model_merged_quantized.onnx");
    expect(SCRIPT).not.toContain("encoder_model_fp16.onnx");
    expect(SCRIPT).not.toContain('"onnx/decoder_model.onnx"');
  });
});
